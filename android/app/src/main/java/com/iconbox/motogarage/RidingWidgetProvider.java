package com.iconbox.motogarage;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

public class RidingWidgetProvider extends AppWidgetProvider {

    private static final String PREFS = "riding_widget_state";
    private static final String KEY_ACTIVE = "active";
    private static final String KEY_PAUSED = "paused";
    private static final String KEY_LANG = "lang";

    // status[0]=대기중, status[1]=자동일시정지, status[2]=기록중, [3]=시작 버튼, [4]=종료 버튼
    private static final java.util.Map<String, String[]> LANG_TEXT = new java.util.HashMap<>();
    static {
        LANG_TEXT.put("ko", new String[]{"대기중", "자동 일시정지", "기록중", "라이딩 시작", "라이딩 종료"});
        LANG_TEXT.put("en", new String[]{"Standby", "Auto-paused", "Recording", "Start Ride", "End Ride"});
        LANG_TEXT.put("vn", new String[]{"Chờ bắt đầu", "Tạm dừng tự động", "Đang ghi", "Bắt đầu", "Kết thúc"});
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
    }

    // RidingPlugin.setState()에서 JS 쪽 라이딩 상태가 바뀔 때마다 호출된다.
    public static void updateState(Context context, boolean active, boolean paused) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_ACTIVE, active).putBoolean(KEY_PAUSED, paused).apply();
        refreshAllWidgets(context);
    }

    // RidingPlugin.setLanguage()에서 앱 언어(KO/EN/VN)가 바뀔 때마다 호출된다.
    public static void updateLanguage(Context context, String lang) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_LANG, lang).apply();
        refreshAllWidgets(context);
    }

    private static void refreshAllWidgets(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        ComponentName cn = new ComponentName(context, RidingWidgetProvider.class);
        int[] ids = mgr.getAppWidgetIds(cn);
        for (int id : ids) {
            updateWidget(context, mgr, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int widgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean active = prefs.getBoolean(KEY_ACTIVE, false);
        boolean paused = prefs.getBoolean(KEY_PAUSED, false);
        String lang = prefs.getString(KEY_LANG, "ko");
        String[] t = LANG_TEXT.containsKey(lang) ? LANG_TEXT.get(lang) : LANG_TEXT.get("ko");

        String statusText;
        String btnText;
        String action;
        if (!active) {
            statusText = t[0];
            btnText = t[3];
            action = "start";
        } else if (paused) {
            statusText = t[1];
            btnText = t[4];
            action = "stop";
        } else {
            statusText = t[2];
            btnText = t[4];
            action = "stop";
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.riding_widget);
        views.setTextViewText(R.id.widget_status, statusText);
        views.setTextViewText(R.id.widget_action_btn, btnText);
        // 라이딩 진행 중(기록중/자동일시정지)이면 위젯 배경을 초록색으로 확 바꿔서 멀리서도 구분되게 한다.
        views.setInt(R.id.widget_root, "setBackgroundResource",
            active ? R.drawable.widget_bg_active : R.drawable.widget_bg);

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("widgetAction", action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, widgetId, intent, flags);
        views.setOnClickPendingIntent(R.id.widget_action_btn, pendingIntent);

        appWidgetManager.updateAppWidget(widgetId, views);
    }
}
