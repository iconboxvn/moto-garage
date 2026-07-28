package com.iconbox.motogarage;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.util.ArrayDeque;

public class RidingService extends Service {
    static final String CHANNEL_ID = "riding_fg";
    static final int    NOTIF_ID   = 2001;
    static final String ACTION_LOCATION = "com.iconbox.motogarage.LOCATION_UPDATE";
    static final String ACTION_CRASH_DETECTED = "com.iconbox.motogarage.CRASH_DETECTED";

    // ── 충격/낙차 감지 상태머신 임계값 ──
    // www/index*.html의 _FF_MAG/_FF_DUR/_IMP_MAG/_FF_IMP_MAG/_STILL_DUR, CLAUDE.md와
    // 반드시 동일하게 유지할 것 (JS 상태머신을 그대로 네이티브로 이식한 것).
    private static final float FF_MAG      = 3f;     // 자유낙하 감지 임계값 (m/s²)
    private static final long  FF_DUR      = 300L;   // 자유낙하 지속 시간 (ms)
    private static final float IMP_MAG     = 39.2f;  // 직접 충격 임계값 (4G, m/s²)
    private static final float FF_IMP_MAG  = 19.6f;  // 낙차 후 충격 임계값 (2G, m/s²)
    private static final long  STILL_DUR   = 5000L;  // 충격 후 정지 판정 시간 (ms)
    private static final float MIN_SPD_KMH = 20f;    // 감지 활성화 최소 속도 (km/h) ← 변경 금지
    private static final float MAX_POS_ACCURACY_M = 30f; // GPS 위치 정확도(m) 이보다 나쁘면 속도게이트 판단에서 제외

    private static final int PHASE_MONITORING = 0;
    private static final int PHASE_FREEFALL   = 1;
    private static final int PHASE_IMPACT     = 2;
    private static final int PHASE_COUNTDOWN  = 3; // JS가 카운트다운 진행 중 - resumeMonitoring() 올 때까지 대기

    private static RidingService instance;

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private SensorManager sensorManager;
    private SensorEventListener crashListener;
    private boolean speedOk = false;

    private int crashPhase = PHASE_MONITORING;
    private Long ffStart = null;
    private Long phaseT = null;
    private Long stillStart = null;
    private final ArrayDeque<float[]> magBuffer = new ArrayDeque<>(); // [mag, t] - 최근 1초 유지

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createChannel();
        fusedClient = LocationServices.getFusedLocationProviderClient(this);
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(@NonNull LocationResult result) {
                android.location.Location loc = result.getLastLocation();
                if (loc == null) return;
                updateSpeedGate(loc);
                Intent broadcast = new Intent(ACTION_LOCATION);
                broadcast.putExtra("lat", loc.getLatitude());
                broadcast.putExtra("lon", loc.getLongitude());
                broadcast.putExtra("speed", loc.hasSpeed() ? loc.getSpeed() : -1f);
                broadcast.putExtra("accuracy", loc.getAccuracy());
                // 속도값 자체의 신뢰도(m/s). API 26 미만이거나 값이 없으면 -1로 넘겨서
                // JS 쪽에서 "판단 불가"로 처리하게 한다.
                float speedAccuracy = -1f;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && loc.hasSpeedAccuracy()) {
                    speedAccuracy = loc.getSpeedAccuracyMetersPerSecond();
                }
                broadcast.putExtra("speedAccuracy", speedAccuracy);
                broadcast.putExtra("time", loc.getTime());
                // LocalBroadcastManager 사용 (앱 내부 통신, 보안 정책 우회)
                LocalBroadcastManager.getInstance(RidingService.this).sendBroadcast(broadcast);
            }
        };
        setupCrashDetection();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification());
        startLocationUpdates();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        if (fusedClient != null && locationCallback != null) {
            fusedClient.removeLocationUpdates(locationCallback);
        }
        if (sensorManager != null && crashListener != null) {
            sensorManager.unregisterListener(crashListener);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // GPS 위치 콜백에서 속도게이트(20km/h 이상 + 위치 정확도 양호)를 자체 계산.
    // JS의 _sos.speedOk와 같은 조건이지만 여기서는 왕복 없이 바로 판단한다.
    private void updateSpeedGate(android.location.Location loc) {
        if (loc.getAccuracy() > MAX_POS_ACCURACY_M) return; // 정확도 나쁜 샘플은 게이트 갱신 자체를 건너뜀 (이전 값 유지)
        if (loc.hasSpeed()) {
            speedOk = (loc.getSpeed() * 3.6f) >= MIN_SPD_KMH;
        }
    }

    // JS가 카운트다운 취소/발송 완료 후 호출 — 상태머신을 다시 감시 상태로 되돌린다.
    public static void resumeMonitoring() {
        if (instance != null) instance.resetCrashPhase();
    }

    // 디버그 빌드 전용 테스트 훅 - 실제 가속도계 없이 crashDetected 브로드캐스트 경로를 검증하기 위함.
    public static void debugTriggerCrash() {
        if (!BuildConfig.DEBUG) return;
        if (instance != null) instance.triggerCrashDetected(999f);
    }

    private void resetCrashPhase() {
        crashPhase = PHASE_MONITORING;
        ffStart = null; phaseT = null; stillStart = null;
        magBuffer.clear();
    }

    private void setupCrashDetection() {
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) return;
        Sensor accel = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        if (accel == null) return;
        crashListener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                handleAccel(event.values[0], event.values[1], event.values[2]);
            }
            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {}
        };
        sensorManager.registerListener(crashListener, accel, SensorManager.SENSOR_DELAY_GAME);
    }

    private void handleAccel(float x, float y, float z) {
        double mag = Math.sqrt(x*x + y*y + z*z);
        long now = System.currentTimeMillis();

        magBuffer.addLast(new float[]{(float) mag, (float) now});
        while (!magBuffer.isEmpty() && now - magBuffer.peekFirst()[1] > 1000) magBuffer.pollFirst();

        if (crashPhase == PHASE_COUNTDOWN) return; // JS가 카운트다운 진행 중 - resumeMonitoring() 대기

        if (crashPhase == PHASE_MONITORING) {
            if (!speedOk) { ffStart = null; return; }
            if (mag < FF_MAG) {
                if (ffStart == null) ffStart = now;
                if (now - ffStart >= FF_DUR) { crashPhase = PHASE_FREEFALL; phaseT = now; }
            } else {
                ffStart = null;
                if (mag > IMP_MAG) { crashPhase = PHASE_IMPACT; phaseT = now; stillStart = now; }
            }
            return;
        }

        if (crashPhase == PHASE_FREEFALL) {
            if (mag > FF_IMP_MAG) {
                crashPhase = PHASE_IMPACT; phaseT = now; stillStart = now;
            } else if (phaseT != null && now - phaseT > 2000) {
                crashPhase = PHASE_MONITORING; ffStart = null;
            }
            return;
        }

        if (crashPhase == PHASE_IMPACT) {
            if (magBuffer.size() >= 4) {
                float min = Float.MAX_VALUE, max = -Float.MAX_VALUE;
                for (float[] r : magBuffer) { if (r[0] < min) min = r[0]; if (r[0] > max) max = r[0]; }
                if (max - min > 3f) { resetCrashPhase(); return; }
            }
            if (stillStart != null && now - stillStart >= STILL_DUR) triggerCrashDetected((float) mag);
        }
    }

    private void triggerCrashDetected(float mag) {
        crashPhase = PHASE_COUNTDOWN; // resumeMonitoring() 올 때까지 중복 트리거 방지
        Intent broadcast = new Intent(ACTION_CRASH_DETECTED);
        broadcast.putExtra("mag", mag);
        LocalBroadcastManager.getInstance(this).sendBroadcast(broadcast);
    }

    private void startLocationUpdates() {
        LocationRequest req = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000)
            .setMinUpdateIntervalMillis(1000)
            .build();
        try {
            fusedClient.requestLocationUpdates(req, locationCallback, Looper.getMainLooper());
        } catch (SecurityException e) {
            e.printStackTrace();
        }
    }

    private Notification buildNotification() {
        Intent tap = new Intent(this, MainActivity.class);
        tap.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, tap,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_riding_notif)
            .setContentTitle("라이딩 모드 활성화")
            .setContentText("고속 감지 이상 발생시에 자동 SOS 발송")
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "라이딩 모드", NotificationManager.IMPORTANCE_LOW
            );
            ch.setDescription("활성화 모드 및 자동 SOS 서비스");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }
}
