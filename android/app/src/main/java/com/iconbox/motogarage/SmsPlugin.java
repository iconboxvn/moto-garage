package com.iconbox.motogarage;

import android.Manifest;
import android.os.Build;
import android.telephony.SmsManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "Sms",
    permissions = {
        @Permission(alias = "sms", strings = { Manifest.permission.SEND_SMS })
    }
)
public class SmsPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("granted", true);
            call.resolve(r);
        } else {
            requestPermissionForAlias("sms", call, "smsPermCallback");
        }
    }

    @PermissionCallback
    private void smsPermCallback(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void send(PluginCall call) {
        String phone = call.getString("phone", "").trim();
        String text  = call.getString("text", "").trim();

        if (phone.isEmpty()) { call.reject("phone_required"); return; }
        if (text.isEmpty())  { call.reject("text_required");  return; }
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("permission_denied"); return;
        }

        try {
            SmsManager mgr = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? getActivity().getSystemService(SmsManager.class)
                : SmsManager.getDefault();
            java.util.ArrayList<String> parts = mgr.divideMessage(text);
            if (parts.size() == 1) {
                mgr.sendTextMessage(phone, null, text, null, null);
            } else {
                mgr.sendMultipartTextMessage(phone, null, parts, null, null);
            }
            JSObject r = new JSObject();
            r.put("success", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("send_failed: " + e.getMessage());
        }
    }
}
