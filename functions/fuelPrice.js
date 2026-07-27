/**
 * Ridemate — 유가 정보 수집 파이프라인
 *
 * CLAUDE.md "유가 정보 기능" 설계 참고. brandNews.js와 구조는 비슷하지만 핵심 차이가
 * 있다: 이건 "여러 항목을 쌓는 피드"가 아니라 "현재 유가 스냅샷 하나"를 관리하는
 * 거라, dedupeKey를 sourceUrl이 아니라 effectiveAt 날짜로 잡는다(같은 조정 건을
 * VietnamNet/MOIT 두 소스가 각각 다른 글로 보도해도 같은 날짜면 하나로 합쳐야 함).
 *
 * 매일 18:00 Asia/Ho_Chi_Minh(brandNews의 새벽 3시와 다름 — MOIT 조정이 보통 15:00
 * 발효라 그 이후로 잡아야 당일 캐치 가능성이 올라감)에 실행:
 *   1) 1순위 VietnamNet 소스 시도
 *   2) 새 데이터가 없고 마지막 저장분이 5일 이상 지났으면 MOIT 직접 폴백 시도
 *   3) 가격이 15,000~35,000đ/L 범위를 벗어나면 저장 보류(파싱 오류 안전장치)
 *   4) effectiveAt 날짜 기준으로 신규면 저장, 기존이면 스킵
 *
 * 0건 연속 경고 임계값은 brandNews(14회)보다 훨씬 타이트한 5회 — VietnamNet 시리즈가
 * 2026-07-01~07-11(11일간) 통째로 빠진 실제 전례가 있어서 14일 기준이면 실제 장애를
 * 못 잡는다(CLAUDE.md 조사 기록 참고).
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const fuelPriceVn = require('./sources/fuelPriceVn');
const fuelPriceMoit = require('./sources/fuelPriceMoit');

const MIN_PRICE = 15000;
const MAX_PRICE = 35000;
const FALLBACK_STALE_DAYS = 5;
const ZERO_STREAK_WARN = 5;

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis(); // Firestore Timestamp
  if (typeof ts.getTime === 'function') return ts.getTime(); // JS Date
  if (ts.seconds) return ts.seconds * 1000; // 방어적 처리
  return new Date(ts).getTime();
}

function dedupeKeyFor(effectiveAt) {
  return new Date(toMillis(effectiveAt)).toISOString().slice(0, 10);
}

function isValidPrice(n) {
  return typeof n === 'number' && n >= MIN_PRICE && n <= MAX_PRICE;
}

async function loadLatestDoc() {
  const snap = await db.collection('fuel_prices').orderBy('effectiveAt', 'desc').limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

// 브랜드소식과 같은 취지의 "조용한 실패" 감지 — 소스당이 아니라 파이프라인 전체 기준
// (VietnamNet/MOIT 둘 다 실패해야 카운트됨, 하나라도 성공하면 리셋)
async function trackZeroStreak(gotNewData) {
  const ref = db.collection('_meta').doc('fuelPriceStreak');
  const snap = await ref.get();
  const prevStreak = (snap.exists && snap.get('zeroStreak')) || 0;
  const streak = gotNewData ? 0 : prevStreak + 1;
  await ref.set({ zeroStreak: streak, lastRunAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  if (streak >= ZERO_STREAK_WARN) {
    console.warn(`[fuelPrice] ${streak}회 연속 신규 데이터 없음 — VietnamNet/MOIT 둘 다 사이트 구조 변경 등으로 막혔을 가능성`);
  }
}

exports.collectFuelPrice = onSchedule(
  { schedule: '0 18 * * *', timeZone: 'Asia/Ho_Chi_Minh', timeoutSeconds: 180 },
  async () => {
    const runLog = {};
    const latest = await loadLatestDoc();
    const latestKey = latest ? dedupeKeyFor(latest.effectiveAt) : null;
    const latestAgeDays = latest ? (Date.now() - toMillis(latest.effectiveAt)) / 86400000 : Infinity;

    let result = null;
    try {
      result = await fuelPriceVn.fetch();
      runLog.vn = result ? 'ok(' + dedupeKeyFor(result.effectiveAt) + ')' : 'no-data';
    } catch (e) {
      console.warn('[fuelPrice] VietnamNet 소스 실패', e);
      runLog.vn = 'error: ' + e.message;
    }

    const vnFoundNothingNew = !result || dedupeKeyFor(result.effectiveAt) === latestKey;
    if (vnFoundNothingNew && latestAgeDays >= FALLBACK_STALE_DAYS) {
      try {
        const fallback = await fuelPriceMoit.fetch();
        if (fallback && dedupeKeyFor(fallback.effectiveAt) !== latestKey) {
          result = fallback;
          runLog.moit = 'ok(' + dedupeKeyFor(fallback.effectiveAt) + ')';
        } else {
          runLog.moit = 'no-data';
        }
      } catch (e) {
        console.warn('[fuelPrice] MOIT 폴백 실패', e);
        runLog.moit = 'error: ' + e.message;
      }
    }

    if (!result || dedupeKeyFor(result.effectiveAt) === latestKey) {
      await trackZeroStreak(false);
      console.log('[fuelPrice] 실행 완료 (신규 없음):', JSON.stringify(runLog));
      return;
    }

    const e5 = result.prices.e5_ron92;
    const e10 = result.prices.e10_ron95;
    if ((e5 != null && !isValidPrice(e5)) || (e10 != null && !isValidPrice(e10))) {
      console.warn('[fuelPrice] 가격이 정상 범위(15,000~35,000đ) 밖이라 저장 보류:', JSON.stringify(result.prices));
      await trackZeroStreak(false);
      return;
    }

    const prevPrices = (latest && latest.prices) || {};
    const deltas = {
      e5_ron92: e5 != null && prevPrices.e5_ron92 != null ? e5 - prevPrices.e5_ron92 : null,
      e10_ron95: e10 != null && prevPrices.e10_ron95 != null ? e10 - prevPrices.e10_ron95 : null
    };

    await db.collection('fuel_prices').add({
      effectiveAt: result.effectiveAt,
      prices: { e5_ron92: e5, e10_ron95: e10 },
      deltas,
      sourceName: result.sourceName,
      sourceUrl: result.sourceUrl,
      sourceTier: result.sourceTier,
      collectedAt: admin.firestore.FieldValue.serverTimestamp(),
      dedupeKey: dedupeKeyFor(result.effectiveAt)
    });

    await trackZeroStreak(true);
    console.log('[fuelPrice] 실행 완료 (신규 저장, 출처: ' + result.sourceName + '):', JSON.stringify(runLog));
  }
);
