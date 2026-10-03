import Foundation
import CoreLocation

// 라이딩 거리/속도 누적 계산 — android/.../RidingService.java의 updateRideTracking()/
// trackRideSpeed()/trackStops()를 그대로 이식한 것. 상수·필터 순서·조건을 바꾸면 두 플랫폼의
// 기록이 어긋나니, 한쪽을 고칠 땐 반드시 다른 쪽(그리고 www/index*.html의 동명 상수)도 같이 볼 것.
// 충격/낙차 감지 상태머신은 iOS v1 스코프에서 제외라 이식하지 않음.
final class RideTracker {
    // ── RidingService.java와 동일하게 유지 ──
    static let movingSpdKmh: Double          = 8
    static let maxSpeedAccuracyMps: Double   = 3
    static let maxPosAccuracyM: Double       = 30
    static let maxGapSecForDelta: Double     = 60
    static let harshAccelKmhPerSec: Double   = 12
    static let harshBrakeKmhPerSec: Double   = 15
    static let harshEventCooldownMs: Int64   = 3000
    static let stopArmKmh: Double            = 15
    static let stopKmh: Double               = 3
    static let stopMinMs: Int64              = 3000
    static let lowSpdKmh: Double             = 15
    static let lowSpdMaxDtSec: Double        = 30
    static let stoppedCapMs: Int64           = 180000

    private(set) var distanceKm: Double = 0
    private(set) var maxSpeedKmh: Double = 0
    private(set) var maxSpeedLat: Double?
    private(set) var maxSpeedLon: Double?
    private var lastLat: Double?
    private var lastLon: Double?
    private var lastT: Int64?
    private var lastAcceptedKmh: Double?
    private var lastAcceptedT: Int64?
    private var lastHarshEventT: Int64?
    private(set) var harshAccelCount = 0
    private(set) var harshBrakeCount = 0
    private(set) var gpsGapCount = 0
    private(set) var maxGpsGapSec: Double = 0
    private var stopCount = 0
    private var lowSpeedMs: Int64 = 0
    private var stopArmed = false
    private var belowStopSinceT: Int64?
    private var stoppedMs: Int64 = 0
    private var stopEpisodeMs: Int64 = 0
    private var hasMoved = false
    // JS로는 확정값만 보냄 — RidingService.java의 ride*Committed 주석 참고
    private(set) var stopCountCommitted = 0
    private(set) var lowSpeedMsCommitted: Int64 = 0
    private(set) var stoppedMsCommitted: Int64 = 0

    // 반환값: 이번 fix가 "이동 중"(movingSpdKmh 이상)으로 판정됐는지
    func update(_ loc: CLLocation, now: Int64) -> Bool {
        let posAcc = loc.horizontalAccuracy
        let posOk = posAcc >= 0 && posAcc <= Self.maxPosAccuracyM
        let lat = loc.coordinate.latitude
        let lon = loc.coordinate.longitude
        let hasSpeed = loc.speed >= 0
        var isMoving = false

        if hasSpeed && posOk {
            let kmh = loc.speed * 3.6
            let speedAcc = loc.speedAccuracy  // 음수면 값 없음 (Android의 -1과 동일 취급)
            if kmh < 300 && (speedAcc < 0 || speedAcc <= Self.maxSpeedAccuracyMps) {
                isMoving = trackSpeed(kmh, now: now, lat: lat, lon: lon)
            }
        }

        if posOk, let pLat = lastLat, let pLon = lastLon, let pT = lastT {
            let dKm = Self.haversineKm(pLat, pLon, lat, lon)
            let dtSecGap = Double(now - pT) / 1000.0
            let dtH = dtSecGap / 3600.0
            let instKmh = dtH > 0 ? dKm / dtH : 0
            let gapTooLong = dtSecGap <= 0 || dtSecGap > Self.maxGapSecForDelta
            if !hasSpeed && instKmh > 0 && instKmh < 300 && !gapTooLong {
                isMoving = trackSpeed(instKmh, now: now, lat: lat, lon: lon)
            }
            if instKmh < 300 && !gapTooLong { distanceKm += dKm }
        }
        if posOk { lastLat = lat; lastLon = lon; lastT = now }
        return isMoving
    }

    private func trackSpeed(_ kmh: Double, now: Int64, lat: Double, lon: Double) -> Bool {
        if let prevKmh = lastAcceptedKmh, let prevT = lastAcceptedT {
            let dtSec = Double(now - prevT) / 1000.0
            if dtSec > 30 {
                gpsGapCount += 1
                if dtSec > maxGpsGapSec { maxGpsGapSec = dtSec }
            }
            let deltaPerSec = dtSec > 0 ? abs(kmh - prevKmh) / dtSec : 0
            if deltaPerSec > 40 { return false }  // 초당 40km/h 넘게 튀는 값은 노이즈 (lastAccepted 갱신 안 함)

            let signedDeltaPerSec = dtSec > 0 ? (kmh - prevKmh) / dtSec : 0
            let sinceLastEvent = lastHarshEventT.map { now - $0 } ?? Int64.max
            if sinceLastEvent >= Self.harshEventCooldownMs {
                if signedDeltaPerSec >= Self.harshAccelKmhPerSec {
                    harshAccelCount += 1; lastHarshEventT = now
                } else if signedDeltaPerSec <= -Self.harshBrakeKmhPerSec {
                    harshBrakeCount += 1; lastHarshEventT = now
                }
            }
            if dtSec > 0 && dtSec <= Self.lowSpdMaxDtSec && prevKmh >= Self.stopKmh && prevKmh < Self.lowSpdKmh {
                lowSpeedMs += Int64(dtSec * 1000)
            }
            if hasMoved && dtSec > 0 && dtSec <= Self.lowSpdMaxDtSec && prevKmh < Self.stopKmh && stopEpisodeMs < Self.stoppedCapMs {
                let add = min(Int64(dtSec * 1000), Self.stoppedCapMs - stopEpisodeMs)
                stopEpisodeMs += add
                stoppedMs += add
            }
        }
        trackStops(kmh, now: now)
        lastAcceptedKmh = kmh
        lastAcceptedT = now

        if kmh > maxSpeedKmh {
            maxSpeedKmh = kmh
            maxSpeedLat = lat
            maxSpeedLon = lon
        }
        return kmh >= Self.movingSpdKmh
    }

    private func trackStops(_ kmh: Double, now: Int64) {
        if kmh >= Self.movingSpdKmh {
            hasMoved = true
            stopCountCommitted = stopCount
            lowSpeedMsCommitted = lowSpeedMs
            stoppedMsCommitted = stoppedMs
        }
        if kmh >= Self.stopArmKmh { stopArmed = true }
        if kmh < Self.stopKmh {
            if belowStopSinceT == nil { belowStopSinceT = now }
            if stopArmed, let since = belowStopSinceT, now - since >= Self.stopMinMs {
                stopCount += 1
                stopArmed = false
            }
        } else {
            belowStopSinceT = nil
        }
        if kmh >= Self.movingSpdKmh { stopEpisodeMs = 0 }
    }

    // RidingService.seedRideTracking()과 동일 — 항상 "더 큰 값" 채택, 기준 좌표는 일부러 안 심음
    func seed(distanceKm: Double, maxSpeedKmh: Double, maxSpeedLat: Double, maxSpeedLon: Double,
              hasMaxSpeedLoc: Bool, harshAccelCount: Int, harshBrakeCount: Int, gpsGapCount: Int,
              maxGpsGapSec: Double, stopCount: Int, lowSpeedMs: Int64, stoppedMs: Int64) {
        if distanceKm > self.distanceKm { self.distanceKm = distanceKm }
        if maxSpeedKmh > self.maxSpeedKmh {
            self.maxSpeedKmh = maxSpeedKmh
            if hasMaxSpeedLoc { self.maxSpeedLat = maxSpeedLat; self.maxSpeedLon = maxSpeedLon }
        }
        if harshAccelCount > self.harshAccelCount { self.harshAccelCount = harshAccelCount }
        if harshBrakeCount > self.harshBrakeCount { self.harshBrakeCount = harshBrakeCount }
        if gpsGapCount > self.gpsGapCount { self.gpsGapCount = gpsGapCount }
        if maxGpsGapSec > self.maxGpsGapSec { self.maxGpsGapSec = maxGpsGapSec }
        if stopCount > self.stopCount { self.stopCount = stopCount }
        if lowSpeedMs > self.lowSpeedMs { self.lowSpeedMs = lowSpeedMs }
        if stoppedMs > self.stoppedMs { self.stoppedMs = stoppedMs }
        if stopCount > stopCountCommitted { stopCountCommitted = stopCount }
        if lowSpeedMs > lowSpeedMsCommitted { lowSpeedMsCommitted = lowSpeedMs }
        if stoppedMs > stoppedMsCommitted { stoppedMsCommitted = stoppedMs }
        if distanceKm > 0 { hasMoved = true }
    }

    static func haversineKm(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
        let r = 6371.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLon = (lon2 - lon1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) * sin(dLon / 2) * sin(dLon / 2)
        return r * 2 * atan2(sqrt(a), sqrt(1 - a))
    }
}
