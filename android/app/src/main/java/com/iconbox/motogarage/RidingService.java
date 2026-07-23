package com.iconbox.motogarage;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
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

public class RidingService extends Service {
    static final String CHANNEL_ID = "riding_fg";
    static final int    NOTIF_ID   = 2001;
    static final String ACTION_LOCATION = "com.iconbox.motogarage.LOCATION_UPDATE";

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        fusedClient = LocationServices.getFusedLocationProviderClient(this);
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(@NonNull LocationResult result) {
                android.location.Location loc = result.getLastLocation();
                if (loc == null) return;
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
        if (fusedClient != null && locationCallback != null) {
            fusedClient.removeLocationUpdates(locationCallback);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

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
