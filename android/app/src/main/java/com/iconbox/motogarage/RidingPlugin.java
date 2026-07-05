package com.iconbox.motogarage;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Riding")
public class RidingPlugin extends Plugin {

    private BroadcastReceiver locationReceiver;

    @Override
    public void load() {
        // 서비스에서 보내는 위치 브로드캐스트를 수신해서 JS로 전달
        locationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject data = new JSObject();
                data.put("lat",      intent.getDoubleExtra("lat", 0));
                data.put("lon",      intent.getDoubleExtra("lon", 0));
                data.put("speed",    intent.getFloatExtra("speed", -1f));   // m/s, -1이면 없음
                data.put("accuracy", intent.getFloatExtra("accuracy", 0f));
                data.put("time",     intent.getLongExtra("time", 0L));
                notifyListeners("locationUpdate", data);
            }
        };
        IntentFilter filter = new IntentFilter(RidingService.ACTION_LOCATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(locationReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(locationReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (locationReceiver != null) {
            getContext().unregisterReceiver(locationReceiver);
        }
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
}
