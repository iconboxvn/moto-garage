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

    @Override
    public void load() {
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
