import Foundation
import UIKit
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
        CAPPluginMethod(name: "isDebugBuild", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "debugLog", returnType: CAPPluginReturnPromise)
    ]

    private var locationManager: CLLocationManager?
    // nil = 라이딩 중 아님. Android에서 Service가 새로 뜰 때 누적값이 0부터 시작하는 것과 같은 역할.
    private var tracker: RideTracker?
    // 디버그 빌드 전용 원시 로그(Android GpsDebugLog 대응). 릴리즈에선 아무것도 안 씀.
    private let dbg = RideDebugLog()

    override public func load() {
        // 앱 상태 변화는 WebView가 멈춰 있어도 네이티브에서 바로 기록 — 웹뷰 재시작/복원 추적용
        let nc = NotificationCenter.default
        let events: [(Notification.Name, String)] = [
            (UIApplication.didEnterBackgroundNotification, "app_background"),
            (UIApplication.willEnterForegroundNotification, "app_foreground"),
            (UIApplication.willTerminateNotification, "app_terminate"),
            (UIApplication.didReceiveMemoryWarningNotification, "memory_warning")
        ]
        for (name, type) in events {
            nc.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in self?.dbg.event(type) }
        }
    }

    // 플러그인 메서드는 Capacitor 큐에서 호출되므로, 상태는 전부 메인 스레드에서만 만진다
    // (JS가 startForeground 직후 seedRideTracking을 부르는 순서가 그대로 지켜지게).
    @objc func startForeground(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let isNew = self.tracker == nil
            if isNew { self.tracker = RideTracker() }
            self.dbg.open()
            self.dbg.event("start_foreground", "\"newTracker\":\(isNew)")
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
            self.dbg.event("stop_foreground", "\"totKm\":\(self.tracker?.distanceKm ?? -1)")
            self.dbg.close()
            self.tracker = nil
            call.resolve()
        }
    }

    // 앱이 종료됐다가 다시 열려 라이딩을 복원할 때, JS가 localStorage에서 되살린 누적값을 심어준다.
    @objc func seedRideTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let t = self.tracker else { call.resolve(); return }
            self.dbg.event("seed", "\"distanceKm\":\(call.getDouble("distanceKm") ?? 0),\"beforeKm\":\(t.distanceKm)")
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

    // JS 쪽 상태(페이지 로드·복원·종료 요약)를 같은 파일에 남김 — WebView가 재시작돼도 기록이 이어짐
    @objc func debugLog(_ call: CAPPluginCall) {
        let type = call.getString("type") ?? "js"
        let json = call.getString("json") ?? "{}"
        DispatchQueue.main.async { self.dbg.event("js_" + type, "\"data\":" + json); call.resolve() }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let tracker = tracker else { return }
        // 백그라운드에서 여러 개가 묶여 올 수 있음 — 전부 순서대로 누적에 반영
        for (i, loc) in locations.enumerated() {
            let now = Int64(loc.timestamp.timeIntervalSince1970 * 1000)
            let beforeKm = tracker.distanceKm
            let isMoving = tracker.update(loc, now: now)
            dbg.fix(loc, batchIndex: i, batchSize: locations.count, addedKm: tracker.distanceKm - beforeKm,
                    moving: isMoving, totalKm: tracker.distanceKm)
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

// 디버그 빌드 전용 라이딩 원시 로그 — Application Support/gpslog/ride_<시작ms>.jsonl (최근 40개 유지).
// 필드는 Android GpsDebugLog와 같게 맞춰 tools/gps-replay로 같이 재계산할 수 있게 함(et/recv는 기기 가동 시간 ms).
// 꺼내기(디버그 빌드만): xcrun devicectl device copy from --device <UDID> --domain-type appDataContainer
//   --domain-identifier com.iconbox.motogarage --source Library/Application\ Support/gpslog --destination <폴더>
final class RideDebugLog {
    private static let keepFiles = 40
    private var handle: FileHandle?

    func open() {
        #if DEBUG
        if handle != nil { return }
        let fm = FileManager.default
        guard let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return }
        let dir = base.appendingPathComponent("gpslog", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        prune(dir)
        let wall = Int64(Date().timeIntervalSince1970 * 1000)
        let url = dir.appendingPathComponent("ride_\(wall).jsonl")
        fm.createFile(atPath: url.path, contents: nil)
        handle = try? FileHandle(forWritingTo: url)
        let app = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        write("{\"type\":\"start\",\"wall\":\(wall),\"model\":\"\(Self.esc(UIDevice.current.model))\",\"os\":\"\(Self.esc(UIDevice.current.systemVersion))\",\"app\":\"\(app) (\(build))\"}")
        #endif
    }

    func fix(_ loc: CLLocation, batchIndex: Int, batchSize: Int, addedKm: Double, moving: Bool, totalKm: Double) {
        guard handle != nil else { return }
        let t = Int64(loc.timestamp.timeIntervalSince1970 * 1000)
        let acc = loc.horizontalAccuracy
        let posOk = acc >= 0 && acc <= RideTracker.maxPosAccuracyM
        let up = Int64(ProcessInfo.processInfo.systemUptime * 1000)
        var mock = false
        if #available(iOS 15.0, *) { mock = loc.sourceInformation?.isSimulatedBySoftware ?? false }
        func n(_ v: Double, _ f: String) -> String { v < 0 ? "null" : String(format: f, v) }
        write("{\"type\":\"fix\",\"t\":\(t),\"et\":\(up),\"lat\":\(String(format: "%.7f", loc.coordinate.latitude)),\"lon\":\(String(format: "%.7f", loc.coordinate.longitude)),\"acc\":\(n(acc, "%.1f")),\"spd\":\(n(loc.speed, "%.2f")),\"brg\":\(n(loc.course, "%.1f")),\"alt\":\(String(format: "%.1f", loc.altitude)),\"sacc\":\(n(loc.speedAccuracy, "%.2f")),\"bacc\":\(n(loc.courseAccuracy, "%.1f")),\"mock\":\(mock),\"prov\":\"ios\",\"bi\":\(batchIndex),\"bn\":\(batchSize),\"posOk\":\(posOk),\"addKm\":\(String(format: "%.5f", addedKm)),\"moving\":\(moving),\"totKm\":\(String(format: "%.4f", totalKm)),\"recv\":\(up),\"appState\":\(UIApplication.shared.applicationState.rawValue)}")
    }

    func event(_ type: String, _ json: String = "") {
        guard handle != nil else { return }
        let wall = Int64(Date().timeIntervalSince1970 * 1000)
        let up = Int64(ProcessInfo.processInfo.systemUptime * 1000)
        write("{\"type\":\"\(Self.esc(type))\",\"wall\":\(wall),\"et\":\(up)" + (json.isEmpty ? "" : "," + json) + "}")
    }

    func close() {
        try? handle?.close()
        handle = nil
    }

    private func write(_ line: String) {
        guard let h = handle, let d = (line + "\n").data(using: .utf8) else { return }
        h.seekToEndOfFile()
        h.write(d)
    }

    private func prune(_ dir: URL) {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(atPath: dir.path).filter({ $0.hasPrefix("ride_") }).sorted(),
              files.count >= Self.keepFiles else { return }
        for f in files.prefix(files.count - Self.keepFiles + 1) { try? fm.removeItem(at: dir.appendingPathComponent(f)) }
    }

    private static func esc(_ s: String) -> String {
        s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
    }
}
