import Foundation
import Capacitor
import CoreLocation

// Android RidingPlugin.java + RidingService.java의 iOS 대응. JS(www/index*.html)는 플랫폼 구분 없이
// 같은 메서드/이벤트(locationUpdate)를 쓰므로 이름·필드를 Android와 똑같이 맞춘다.
// - 라이딩 GPS: CLLocationManager 백그라운드 위치 업데이트(UIBackgroundModes=location).
//   "앱 사용 중" 권한으로 포그라운드에서 시작하면 백그라운드에서도 계속 받는다 (Always 권한 불필요).
// - 충격/낙차 감지, SMS, 홈 화면 위젯은 iOS v1 스코프 밖 → 관련 메서드는 아무것도 안 하고 resolve.
@objc(RidingPlugin)
public class RidingPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "RidingPlugin"
    public let jsName = "Riding"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startForeground", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopForeground", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seedRideTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeMonitoring", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLanguage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "moveToBackground", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "simulateCrash", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isDebugBuild", returnType: CAPPluginReturnPromise)
    ]

    private var locationManager: CLLocationManager?
    // nil = 라이딩 중 아님. Android에서 Service가 새로 뜰 때 누적값이 0부터 시작하는 것과 같은 역할.
    private var tracker: RideTracker?

    // 플러그인 메서드는 Capacitor 큐에서 호출되므로, 상태는 전부 메인 스레드에서만 만진다
    // (JS가 startForeground 직후 seedRideTracking을 부르는 순서가 그대로 지켜지게).
    @objc func startForeground(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.tracker == nil { self.tracker = RideTracker() }
            if self.locationManager == nil {
                let m = CLLocationManager()
                m.delegate = self
                m.desiredAccuracy = kCLLocationAccuracyBestForNavigation
                m.distanceFilter = kCLDistanceFilterNone
                m.activityType = .automotiveNavigation
                m.pausesLocationUpdatesAutomatically = false  // 신호대기·정체 중에도 끊기면 안 됨
                m.allowsBackgroundLocationUpdates = true
                m.showsBackgroundLocationIndicator = true
                self.locationManager = m
            }
            let m = self.locationManager!
            if m.authorizationStatus == .notDetermined { m.requestWhenInUseAuthorization() }
            m.startUpdatingLocation()
            call.resolve()
        }
    }

    @objc func stopForeground(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.locationManager?.stopUpdatingLocation()
            self.tracker = nil
            call.resolve()
        }
    }

    // 앱이 종료됐다가 다시 열려 라이딩을 복원할 때, JS가 localStorage에서 되살린 누적값을 심어준다.
    @objc func seedRideTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let t = self.tracker else { call.resolve(); return }
            t.seed(
                distanceKm: call.getDouble("distanceKm") ?? 0,
                maxSpeedKmh: call.getDouble("maxSpeedKmh") ?? 0,
                maxSpeedLat: call.getDouble("maxSpeedLat") ?? 0,
                maxSpeedLon: call.getDouble("maxSpeedLon") ?? 0,
                hasMaxSpeedLoc: call.getBool("hasMaxSpeedLoc") ?? false,
                harshAccelCount: call.getInt("harshAccelCount") ?? 0,
                harshBrakeCount: call.getInt("harshBrakeCount") ?? 0,
                gpsGapCount: call.getInt("gpsGapCount") ?? 0,
                maxGpsGapSec: call.getDouble("maxGpsGapSec") ?? 0,
                stopCount: call.getInt("stopCount") ?? 0,
                lowSpeedMs: Int64(call.getDouble("lowSpeedMs") ?? 0),
                stoppedMs: Int64(call.getDouble("stoppedMs") ?? 0)
            )
            call.resolve()
        }
    }

    // iOS v1 스코프 밖(충격감지·위젯) — JS 호출 경로는 그대로 두고 여기서 흡수
    @objc func resumeMonitoring(_ call: CAPPluginCall) { call.resolve() }
    @objc func setState(_ call: CAPPluginCall) { call.resolve() }
    @objc func setLanguage(_ call: CAPPluginCall) { call.resolve() }
    @objc func moveToBackground(_ call: CAPPluginCall) { call.resolve() }
    @objc func simulateCrash(_ call: CAPPluginCall) { call.resolve() }

    @objc func isDebugBuild(_ call: CAPPluginCall) {
        #if DEBUG
        call.resolve(["isDebug": true])
        #else
        call.resolve(["isDebug": false])
        #endif
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let tracker = tracker else { return }
        // 백그라운드에서 여러 개가 묶여 올 수 있음 — 전부 순서대로 누적에 반영
        for loc in locations {
            let now = Int64(loc.timestamp.timeIntervalSince1970 * 1000)
            let isMoving = tracker.update(loc, now: now)
            notifyListeners("locationUpdate", data: [
                "lat": loc.coordinate.latitude,
                "lon": loc.coordinate.longitude,
                "speed": loc.speed,                // 음수 = 값 없음 (Android -1과 동일)
                "accuracy": loc.horizontalAccuracy,
                "speedAccuracy": loc.speedAccuracy,
                "time": now,
                "rideDistance": tracker.distanceKm,
                "rideMaxSpeed": tracker.maxSpeedKmh,
                "rideMaxSpeedLat": tracker.maxSpeedLat ?? 0,
                "rideMaxSpeedLon": tracker.maxSpeedLon ?? 0,
                "rideHasMaxSpeedLoc": tracker.maxSpeedLat != nil,
                "rideHarshAccelCount": tracker.harshAccelCount,
                "rideHarshBrakeCount": tracker.harshBrakeCount,
                "rideGpsGapCount": tracker.gpsGapCount,
                "rideMaxGpsGapSec": tracker.maxGpsGapSec,
                "rideStopCount": tracker.stopCountCommitted,
                "rideLowSpeedMs": tracker.lowSpeedMsCommitted,
                "rideStoppedMs": tracker.stoppedMsCommitted,
                "rideIsMoving": isMoving
            ])
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        CAPLog.print("[Riding] location error: \(error.localizedDescription)")
    }
}
