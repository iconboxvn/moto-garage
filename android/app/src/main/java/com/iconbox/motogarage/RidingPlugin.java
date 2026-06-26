package com.iconbox.motogarage;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Riding")
public class RidingPlugin extends Plugin {

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
