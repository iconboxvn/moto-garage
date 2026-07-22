package com.iconbox.motogarage;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Riding")
public class RidingPlugin extends Plugin {

    private BroadcastReceiver locationReceiver;

    // 홈 화면 위젯 → 앱 실행 시 전달되는 시작/종료 요청.
    // 콜드 스타트일 땐 이 이벤트가 JS 리스너가 붙기 전에 발생할 수 있어
    // notifyListeners(..., true)로 "retainUntilConsumed" 시켜서, JS가 나중에
    // addListener()를 호출하는 시점에 Capacitor가 자동으로 재전달하게 한다.
    private static RidingPlugin instance;
    // 일부 런처(Samsung HoneySpace 등)가 위젯 탭 하나에 대해 onCreate/onNewIntent를
    // 중복 발생시키는 경우가 있어, 아주 짧은 시간 안의 재호출은 무시한다.
    private static long lastWidgetActionAt = 0;

    @Override
    public void load() {
        instance = this;
        locationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject data = new JSObject();
                data.put("lat",      intent.getDoubleExtra("lat", 0));
                data.put("lon",      intent.getDoubleExtra("lon", 0));
                data.put("speed",    intent.getFloatExtra("speed", -1f));
                data.put("accuracy", intent.getFloatExtra("accuracy", 0f));
                data.put("time",     intent.getLongExtra("time", 0L));
                notifyListeners("locationUpdate", data);
            }
        };
        // LocalBroadcastManager로 수신 (RidingService와 동일)
        LocalBroadcastManager.getInstance(getContext())
            .registerReceiver(locationReceiver, new IntentFilter(RidingService.ACTION_LOCATION));
    }

    @Override
    protected void handleOnDestroy() {
        if (locationReceiver != null) {
            LocalBroadcastManager.getInstance(getContext())
                .unregisterReceiver(locationReceiver);
        }
        if (instance == this) instance = null;
    }

    // MainActivity.onCreate()/onNewIntent()에서 위젯발 인텐트를 넘겨받아 호출한다.
    public static void handleWidgetIntent(Intent intent) {
        if (intent == null || instance == null) return;
        String action = intent.getStringExtra("widgetAction");
        if (action == null) return;
        long now = System.currentTimeMillis();
        if (now - lastWidgetActionAt < 800) return;
        lastWidgetActionAt = now;
        JSObject data = new JSObject();
        data.put("action", action);
        instance.notifyListeners("widgetAction", data, true);
    }

    @PluginMethod
    public void setState(PluginCall call) {
        boolean active = Boolean.TRUE.equals(call.getBoolean("active", false));
        boolean paused = Boolean.TRUE.equals(call.getBoolean("paused", false));
        RidingWidgetProvider.updateState(getContext(), active, paused);
        call.resolve();
    }

    @PluginMethod
    public void setLanguage(PluginCall call) {
        String lang = call.getString("lang", "ko");
        RidingWidgetProvider.updateLanguage(getContext(), lang);
        call.resolve();
    }

    // 위젯 탭으로 시작/종료 처리를 끝낸 뒤, 앱을 다시 백그라운드로 내려서
    // 홈 화면으로 돌아온 것처럼 보이게 한다.
    @PluginMethod
    public void moveToBackground(PluginCall call) {
        if (getActivity() != null) getActivity().moveTaskToBack(true);
        call.resolve();
    }

    @PluginMethod
    public void startForeground(PluginCall call) {
        Intent svc = new Intent(getContext(), RidingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(svc);
        } else {
            getContext().startService(svc);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopForeground(PluginCall call) {
        getContext().stopService(new Intent(getContext(), RidingService.class));
        call.resolve();
    }

    @PluginMethod
    public void isDebugBuild(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isDebug", BuildConfig.DEBUG);
        call.resolve(ret);
    }
}
