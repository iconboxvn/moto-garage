package com.iconbox.motogarage;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ViolationLookup")
public class ViolationLookupPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String plate = call.getString("plate", "").trim();
        String lang = call.getString("lang", "ko").trim();

        Intent intent = new Intent(getContext(), ViolationLookupActivity.class);
        intent.putExtra("plate", plate);
        intent.putExtra("lang", lang);
        getActivity().startActivity(intent);

        JSObject r = new JSObject();
        r.put("success", true);
        call.resolve(r);
    }
}
