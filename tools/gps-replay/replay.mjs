// GPS 원시 로그(GpsDebugLog .jsonl)로 라이딩 거리·최고속도를 현재 방식과 개선안으로 다시 계산해 비교.
// 사용: node tools/gps-replay/replay.mjs <ride_*.jsonl> [...]
// 개선안 설명: docs/gps-tracking-research.md (P1 점프 필터, P2 정지 흔들림, P3 단조 시계, P5 최고속도)
// "current"는 RidingService.updateRideTracking()/trackRideSpeed()의 거리·최고속도 부분을 그대로 옮긴 것 —
// 서비스 로직을 바꾸면 여기도 같이 맞출 것. 계산에 쓰이는 건 묶음의 마지막 위치(bi==bn-1)뿐이라는 점도 동일.
import fs from 'fs';

const MAX_POS_ACC = 30, MAX_SPD_ACC = 3, MAX_GAP_SEC = 60, SPIKE_KMH_PER_SEC = 40, STOP_KMH = 3;

function haversineKm(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// opts: jump(P1) / anchor(P2) / mono(P3) / max2(P5)
function run(fixes, opts = {}) {
  let dist = 0, maxKmh = 0, last = null, anchor = null, lastAcc = null, prevKmh = null;
  let rejectedJump = 0, heldStill = 0;
  for (const f of fixes) {
    const posOk = f.acc != null && f.acc <= MAX_POS_ACC;
    const tSec = (opts.mono ? f.et : f.t) / 1000;
    // 최고속도(trackRideSpeed의 스파이크 필터만 반영)
    if (f.spd != null && posOk) {
      const kmh = f.spd * 3.6;
      if (kmh < 300 && (f.sacc == null || f.sacc <= MAX_SPD_ACC)) {
        let ok = true;
        if (lastAcc) {
          const dt = tSec - lastAcc.t;
          if (dt > 0 && Math.abs(kmh - lastAcc.kmh) / dt > SPIKE_KMH_PER_SEC) ok = false;
        }
        if (ok) {
          const cand = opts.max2 && prevKmh != null ? Math.min(kmh, prevKmh) : kmh;
          if (cand > maxKmh) maxKmh = cand;
          prevKmh = kmh;
          lastAcc = { t: tSec, kmh };
        }
      }
    }
    if (!posOk) continue;
    const cur = { lat: f.lat, lon: f.lon, t: tSec, acc: f.acc, kmh: f.spd != null ? f.spd * 3.6 : null };
    if (last) {
      const dt = cur.t - last.t;
      const gapTooLong = dt <= 0 || dt > MAX_GAP_SEC;
      const base = opts.anchor && anchor ? anchor : last;
      const dKm = haversineKm(base, cur);
      const dStepKm = haversineKm(last, cur);
      const instKmh = dt > 0 ? dStepKm / (dt / 3600) : 0;
      let add = instKmh < 300 && !gapTooLong;
      if (add && opts.jump) {
        // P1: 보고 속도(도플러)가 있으면 좌표 속도가 그보다 지나치게 크면 점프로 봄, 없으면 가속도 5m/s²
        if (cur.kmh != null) {
          if (instKmh > cur.kmh * 1.5 + 15) add = false;
        } else if (last.kmh != null && dt > 0 && (instKmh - last.kmh) / 3.6 / dt > 5) add = false;
        if (!add) { rejectedJump++; continue; } // 점프 점은 기준점도 갱신하지 않음
      }
      if (add && opts.anchor) {
        // P2: 기준점에서 max(10m, 정확도)보다 멀어졌거나, 보고 속도가 정차 기준 이상일 때만 반영
        const need = Math.max(0.010, Math.max(base.acc || 0, cur.acc || 0) / 1000);
        if (dKm < need && !(cur.kmh != null && cur.kmh >= STOP_KMH)) { heldStill++; last = cur; continue; }
        dist += dKm; anchor = cur;
      } else if (add) {
        dist += dStepKm;
      } else if (opts.anchor) {
        anchor = cur; // 공백 뒤에는 기준점 재설정
      }
    } else if (opts.anchor) anchor = cur;
    last = cur;
  }
  return { distKm: dist, maxKmh, rejectedJump, heldStill };
}

const VARIANTS = {
  current: {},
  'P1 jump': { jump: true },
  'P2 anchor': { anchor: true },
  'P1+P2': { jump: true, anchor: true },
  'P1+P2+P3': { jump: true, anchor: true, mono: true },
  'P5 max2': { max2: true },
};

for (const file of process.argv.slice(2)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const fixes = lines.filter(l => l.type === 'fix' && l.bi === l.bn - 1);
  const logged = fixes.length ? fixes[fixes.length - 1].totKm : 0;
  const durMin = fixes.length > 1 ? (fixes.at(-1).et - fixes[0].et) / 60000 : 0;
  console.log(`\n# ${file}`);
  console.log(`fix ${fixes.length}개(묶음 포함 전체 ${lines.filter(l => l.type === 'fix').length}), ${durMin.toFixed(1)}분, 앱 기록 거리 ${logged.toFixed(3)}km` +
    (lines.some(l => l.type === 'seed') ? ' — 중간 복원(seed) 있음: 앱 기록과 재계산이 다를 수 있음' : ''));
  console.log('방식'.padEnd(12) + '거리km'.padStart(9) + '최고km/h'.padStart(10) + '점프제외'.padStart(8) + '정지보류'.padStart(8));
  for (const [name, o] of Object.entries(VARIANTS)) {
    const r = run(fixes, o);
    console.log(name.padEnd(12) + r.distKm.toFixed(3).padStart(9) + r.maxKmh.toFixed(1).padStart(10) +
      String(r.rejectedJump).padStart(8) + String(r.heldStill).padStart(8));
  }
}
