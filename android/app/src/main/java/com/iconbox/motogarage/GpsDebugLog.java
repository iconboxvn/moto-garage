package com.iconbox.motogarage;

import android.content.Context;
import android.location.Location;
import android.os.Build;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Arrays;
import java.util.Locale;

// 디버그 빌드 전용 GPS 원시 로그 — 라이딩(서비스 수명)마다 files/gpslog/ride_<시작ms>.jsonl 한 개.
// 목적: 같은 주행 데이터로 현재 필터와 개선안(docs/gps-tracking-research.md)을 오프라인 재계산해 비교.
// JS _dbgLog는 화면 꺼진 백그라운드에서 WebView가 멈추면 빠지므로 네이티브에서 직접 파일에 쓴다.
// 꺼내기: adb exec-out run-as com.iconbox.motogarage cat files/gpslog/<파일> > ride.jsonl
//   (목록: adb shell run-as com.iconbox.motogarage ls files/gpslog)
// 릴리즈 빌드에서는 open()이 아무것도 안 하므로 다른 메서드도 전부 no-op.
final class GpsDebugLog {
    private static final int KEEP_FILES = 40;

    private BufferedWriter out;

    void open(Context ctx) {
        if (!BuildConfig.DEBUG || out != null) return;
        try {
            File dir = new File(ctx.getFilesDir(), "gpslog");
            if (!dir.exists() && !dir.mkdirs()) return;
            prune(dir);
            File f = new File(dir, "ride_" + System.currentTimeMillis() + ".jsonl");
            out = new BufferedWriter(new FileWriter(f, true));
            write(String.format(Locale.US,
                "{\"type\":\"start\",\"wall\":%d,\"model\":\"%s\",\"sdk\":%d,\"app\":\"%s\"}",
                System.currentTimeMillis(), esc(Build.MANUFACTURER + " " + Build.MODEL),
                Build.VERSION.SDK_INT, esc(BuildConfig.VERSION_NAME)));
        } catch (IOException e) {
            out = null;
        }
    }

    // 원시 위치 + 현재 필터 판정(posOk/거리 반영량/이동중). 필드 이름은 tools 재계산 스크립트와 맞출 것.
    void fix(Location loc, int batchIndex, int batchSize, boolean posOk, double addedKm, boolean moving, double totalKm) {
        if (out == null) return;
        StringBuilder sb = new StringBuilder(256);
        sb.append("{\"type\":\"fix\"");
        sb.append(",\"t\":").append(loc.getTime());
        sb.append(",\"et\":").append(loc.getElapsedRealtimeNanos() / 1_000_000L);
        sb.append(",\"lat\":").append(String.format(Locale.US, "%.7f", loc.getLatitude()));
        sb.append(",\"lon\":").append(String.format(Locale.US, "%.7f", loc.getLongitude()));
        sb.append(",\"acc\":").append(loc.hasAccuracy() ? r1(loc.getAccuracy()) : "null");
        sb.append(",\"spd\":").append(loc.hasSpeed() ? r2(loc.getSpeed()) : "null");
        sb.append(",\"brg\":").append(loc.hasBearing() ? r1(loc.getBearing()) : "null");
        sb.append(",\"alt\":").append(loc.hasAltitude() ? r1((float) loc.getAltitude()) : "null");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            sb.append(",\"sacc\":").append(loc.hasSpeedAccuracy() ? r2(loc.getSpeedAccuracyMetersPerSecond()) : "null");
            sb.append(",\"bacc\":").append(loc.hasBearingAccuracy() ? r1(loc.getBearingAccuracyDegrees()) : "null");
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) sb.append(",\"mock\":").append(loc.isMock());
        sb.append(",\"prov\":\"").append(esc(String.valueOf(loc.getProvider()))).append('"');
        sb.append(",\"bi\":").append(batchIndex).append(",\"bn\":").append(batchSize);
        sb.append(",\"posOk\":").append(posOk);
        sb.append(",\"addKm\":").append(String.format(Locale.US, "%.5f", addedKm));
        sb.append(",\"moving\":").append(moving);
        sb.append(",\"totKm\":").append(String.format(Locale.US, "%.4f", totalKm));
        sb.append(",\"recv\":").append(android.os.SystemClock.elapsedRealtime());
        sb.append('}');
        write(sb.toString());
    }

    // 라이딩 중간 복원(seedRideTracking) 등 흐름 표시용
    void event(String type, String json) {
        if (out == null) return;
        write("{\"type\":\"" + esc(type) + "\",\"wall\":" + System.currentTimeMillis()
            + ",\"et\":" + android.os.SystemClock.elapsedRealtime()
            + (json == null || json.isEmpty() ? "" : "," + json) + "}");
    }

    void close() {
        if (out == null) return;
        event("stop", null);
        try { out.close(); } catch (IOException ignored) {}
        out = null;
    }

    private void write(String line) {
        try {
            out.write(line);
            out.newLine();
            out.flush(); // 프로세스가 죽어도 여기까지는 남도록 (2초에 한 줄이라 부담 없음)
        } catch (IOException e) {
            try { out.close(); } catch (IOException ignored) {}
            out = null;
        }
    }

    private static void prune(File dir) {
        File[] files = dir.listFiles((d, n) -> n.startsWith("ride_") && n.endsWith(".jsonl"));
        if (files == null || files.length < KEEP_FILES) return;
        Arrays.sort(files, (a, b) -> a.getName().compareTo(b.getName()));
        for (int i = 0; i <= files.length - KEEP_FILES; i++) //noinspection ResultOfMethodCallIgnored
            files[i].delete();
    }

    private static String r1(float v) { return String.format(Locale.US, "%.1f", v); }
    private static String r2(float v) { return String.format(Locale.US, "%.2f", v); }
    private static String esc(String s) { return s.replace("\\", "\\\\").replace("\"", "\\\""); }
}
