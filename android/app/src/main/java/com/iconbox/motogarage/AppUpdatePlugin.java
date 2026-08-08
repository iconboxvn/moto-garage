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
            int status = state.installStatus();
            if (status == InstallStatus.DOWNLOADING) {
                JSObject r = new JSObject();
                long total = state.totalBytesToDownload();
                long done = state.bytesDownloaded();
                r.put("bytesDownloaded", done);
                r.put("totalBytesToDownload", total);
                r.put("percent", total > 0 ? Math.round(done * 100.0 / total) : 0);
                notifyListeners("updateDownloading", r);
            } else if (status == InstallStatus.DOWNLOADED) {
                notifyListeners("updateDownloaded", new JSObject());
            } else if (status == InstallStatus.FAILED || status == InstallStatus.CANCELED) {
                notifyListeners("updateFailed", new JSObject());
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
            // 사용자가 Play 동의창에서 업데이트를 취소함 — 다운로드가 시작되기 전이라 installListener가
            // 못 잡는 케이스라 여기서 직접 실패 이벤트를 보내, JS가 낙관적으로 띄워둔 "다운로드 중" 배너를 되돌리게 함
            notifyListeners("updateFailed", new JSObject());
        }
    }
}
