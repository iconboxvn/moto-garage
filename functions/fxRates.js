/**
 * Ridemate — 환율 수집 (정비 비용 통화 환산용, 2026-10-22)
 *
 * 앱 설정에서 ₫/₩/$ 중 통화를 고르면, 기록마다 저장된 통화를 선택한 통화로 환산해 보여준다.
 * 앱이 외부 환율 API를 직접 부르면 사용자 IP가 새 제3자에게 가므로, 서버가 하루 한 번 받아
 * Firestore fx_rates/latest 한 문서에 저장하고 앱은 그 문서만 읽는다(공개 읽기 규칙).
 *
 * 소스: ExchangeRate-API 무료 엔드포인트(open.er-api.com, 키 없음, 하루 1회 갱신). 이용 조건상
 * 앱 안에 "Rates By Exchange Rate API" 출처 표시가 필요 — 앱 설정의 통화 카드에 표시함.
 * ECB(frankfurter 등)는 VND가 없어서 탈락.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FX_URL = 'https://open.er-api.com/v6/latest/USD';

// 파싱 오류로 이상한 환율이 저장되는 사고 방지(USD 기준 대략 범위)
function plausible(r) {
  return r.KRW > 500 && r.KRW < 5000 && r.VND > 10000 && r.VND < 60000;
}

exports.collectFxRates = onSchedule(
  { schedule: '30 6 * * *', timeZone: 'Asia/Ho_Chi_Minh', timeoutSeconds: 60 },
  async () => {
    const res = await fetch(FX_URL);
    if (!res.ok) throw new Error('[fxRates] HTTP ' + res.status);
    const j = await res.json();
    if (j.result !== 'success' || !j.rates) throw new Error('[fxRates] API result ' + j.result);
    const rates = { USD: 1, KRW: j.rates.KRW, VND: j.rates.VND };
    if (!plausible(rates)) {
      console.warn('[fxRates] 범위를 벗어난 환율 — 저장 보류', rates);
      return;
    }
    await db.collection('fx_rates').doc('latest').set({
      base: 'USD',
      rates,
      provider: 'ExchangeRate-API (open.er-api.com)',
      providerUpdatedAt: new Date((j.time_last_update_unix || 0) * 1000),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('[fxRates] 저장', rates);
  }
);
