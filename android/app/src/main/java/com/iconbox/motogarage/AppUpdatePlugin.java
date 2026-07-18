package com.iconbox.motogarage;

import android.app.Activity;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final int UPDATE_REQUEST_CODE = 5301;

    private AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installListener;

    @Override
    public void load() {
        appUpdateManager = AppUpdateManagerFactory.create(getContext());
        installListener = state -> {
            if (state.installStatus() == InstallStatus.DOWNLOADED) {
                notifyListeners("updateDownloaded", new JSObject());
            }
        };
        appUpdateManager.registerListener(installListener);
    }

    @Override
    protected void handleOnDestroy() {
        if (appUpdateManager != null && installListener != null) {
            appUpdateManager.unregisterListener(installListener);
        }
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        appUpdateManager.getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                boolean available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE);
                JSObject r = new JSObject();
                r.put("available", available);
                r.put("availableVersionCode", info.availableVersionCode());
                call.resolve(r);
            })
            .addOnFailureListener(e -> call.reject("check_failed: " + e.getMessage()));
    }

    @PluginMethod
    public void startUpdate(PluginCall call) {
        appUpdateManager.getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE
                    || !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                    call.reject("no_update_available");
                    return;
                }
                try {
                    appUpdateManager.startUpdateFlowForResult(
                        info, AppUpdateType.FLEXIBLE, getActivity(), UPDATE_REQUEST_CODE);
                    call.resolve();
                } catch (Exception e) {
                    call.reject("start_failed: " + e.getMessage());
                }
            })
            .addOnFailureListener(e -> call.reject("check_failed: " + e.getMessage()));
    }

    @PluginMethod
    public void completeUpdate(PluginCall call) {
        appUpdateManager.completeUpdate();
        call.resolve();
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode == UPDATE_REQUEST_CODE && resultCode != Activity.RESULT_OK) {
            // 사용자가 업데이트를 취소했거나 실패 — 별도 처리 없이 배너는 다음 실행 시 다시 뜸
        }
    }
}
