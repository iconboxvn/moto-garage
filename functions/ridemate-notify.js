/**
 * Ridemate — 서버 기반 데일리 날씨/정비 푸시 알림
 *
 * 이 파일의 내용을 기존 functions/index.js 에 합치거나,
 * functions/index.js 안에서 require('./ridemate-notify') 후 exports를 이어붙이세요.
 *
 * 필요 패키지 (functions 폴더에서 실행):
 *   npm install firebase-admin firebase-functions
 *
 * Node 18 이상 런타임 권장 (전역 fetch 사용).
 * package.json 의 "engines" 필드를 확인하세요:
 *   "engines": { "node": "20" }
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Firebase Secret Manager에 저장해서 사용 (하드코딩 금지)
//   firebase functions:secrets:set OWM_KEY
const OWM_KEY = defineSecret('OWM_KEY');

// ─────────────────────────────────────────
//  1) 클라이언트 → 알림 대상 정보 동기화
//     (앱이 FCM 토큰 / 위치 / 소모품 상태를 올릴 때 호출)
// ─────────────────────────────────────────
exports.syncNotifyTarget = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send({ error: 'POST only' });
    return;
  }
  try {
    const { deviceId, fcmToken, lat, lon, lang, consumables } = req.body || {};
    if (!deviceId || !fcmToken) {
      res.status(400).send({ error: 'deviceId, fcmToken required' });
      return;
    }
    await db.collection('notifyTargets').doc(deviceId).set(
      {
        fcmToken,
        lat: typeof lat === 'number' ? lat : null,
        lon: typeof lon === 'number' ? lon : null,
        lang: lang || 'ko',
        consumables: consumables || { urgent: 0, warn: 0, urgentNames: [], warnNames: [] },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    res.status(200).send({ ok: true });
  } catch (e) {
    console.error('[syncNotifyTarget]', e);
    res.status(500).send({ error: 'internal' });
  }
});

// AQI 지수(1~5) → 언어별 라벨
const AQI_LABELS = {
  ko: ['', '좋음', '보통', '민감군 주의', '나쁨', '매우 나쁨'],
  en: ['', 'Good', 'Moderate', 'Poor', 'Very Poor', 'Hazardous'],
  vn: ['', 'Tốt', 'Trung bình', 'Kém', 'Rất kém', 'Nguy hiểm'],
};
const AQI_PREFIX = { ko: '대기질', en: 'Air quality', vn: 'Chất lượng không khí' };

// 알림을 못 보낼 때(위치 정보 없음 등) 기본 문구
const FALLBACK = {
  ko: { title: '🏍 Ridemate', body: '오늘도 안전 라이딩 하세요' },
  en: { title: '🏍 Ridemate', body: 'Ride safe today' },
  vn: { title: '🏍 Ridemate', body: 'Hôm nay cũng lái xe an toàn nhé' },
};

// 소모품 상태 요약 문구 (언어별)
const CONSUMABLE_TEXT = {
  ko: {
    urgent: (n, names) => `🚨 교체 필요 ${n}건${names ? ' (' + names + ')' : ''}`,
    warn: (n, names) => `⚠ 곧 교체 ${n}건${names ? ' (' + names + ')' : ''}`,
  },
  en: {
    urgent: (n, names) => `🚨 ${n} item(s) need replacement${names ? ' (' + names + ')' : ''}`,
    warn: (n, names) => `⚠ ${n} item(s) due soon${names ? ' (' + names + ')' : ''}`,
  },
  vn: {
    urgent: (n, names) => `🚨 Cần thay ${n} mục${names ? ' (' + names + ')' : ''}`,
    warn: (n, names) => `⚠ Sắp cần thay ${n} mục${names ? ' (' + names + ')' : ''}`,
  },
};

// 위험도별 알림 강조 색상 (안드로이드 알림 아이콘 색상)
const LEVEL_COLOR = { danger: '#D04040', caution: '#E8A020', good: '#38A868' };

// 앱의 getRidingCondition() 로직을 언어별로 이식
const RIDING_CONDITIONS = {
  thunder: { level: 'danger', emoji: '⛈',
    title: { ko: '🚨 천둥번개 — 라이딩 위험', en: '🚨 Thunderstorm — Dangerous riding conditions', vn: '🚨 Sấm sét — Nguy hiểm khi lái xe' },
    tip: { ko: '즉시 안전한 곳으로 대피하세요', en: 'Seek shelter immediately', vn: 'Tìm nơi trú ẩn an toàn ngay lập tức' } },
  rain: { level: 'danger', emoji: '🌧',
    title: { ko: '⚠️ 강수 예보 — 주의 필요', en: '⚠️ Rain forecast — Caution required', vn: '⚠️ Dự báo mưa — Cần chú ý' },
    tip: { ko: '젖은 노면: 제동거리 2배 이상', en: 'Wet road: stopping distance doubles', vn: 'Đường ướt: quãng đường phanh tăng gấp đôi' } },
  snow: { level: 'danger', emoji: '🌨',
    title: { ko: '🚨 강설 — 라이딩 금지 권장', en: '🚨 Snowfall — Riding not recommended', vn: '🚨 Tuyết rơi — Không nên lái xe' },
    tip: { ko: '눈길은 오토바이 라이딩에 매우 위험합니다', en: 'Snow on roads is extremely dangerous for motorcycles', vn: 'Đường tuyết rất nguy hiểm cho xe máy' } },
  fog: { level: 'danger', emoji: '🌫',
    title: { ko: '⚠️ 짙은 안개 — 시야 불량', en: '⚠️ Dense fog — Poor visibility', vn: '⚠️ Sương mù dày — Tầm nhìn kém' },
    tip: { ko: '전조등 상향등 또는 안개등 켜세요', en: 'Turn on high beam or fog lights', vn: 'Bật đèn pha hoặc đèn sương mù' } },
  wind: { level: 'caution', emoji: '💨',
    title: { ko: '⚠️ 강한 바람 주의', en: '⚠️ Strong wind warning', vn: '⚠️ Cảnh báo gió mạnh' },
    tip: { ko: ws => `풍속 ${ws}m/s — 고속도로 주행 자제`, en: ws => `Wind speed ${ws}m/s — avoid highway riding`, vn: ws => `Tốc độ gió ${ws}m/s — hạn chế chạy trên đường cao tốc` } },
  humidity: { level: 'caution', emoji: '💧',
    title: { ko: '⚠️ 고습도 — 노면 주의', en: '⚠️ High humidity — Slippery roads', vn: '⚠️ Độ ẩm cao — Đường trơn' },
    tip: { ko: '습도가 높아 노면이 끈적할 수 있습니다', en: 'High humidity may make roads slippery', vn: 'Độ ẩm cao có thể làm đường trơn' } },
  heat: { level: 'caution', emoji: '🌡',
    title: { ko: '⚠️ 폭염 주의', en: '⚠️ Extreme heat warning', vn: '⚠️ Cảnh báo nắng nóng' },
    tip: { ko: '엔진 과열에 주의하세요', en: 'Watch for engine overheating', vn: 'Chú ý động cơ quá nhiệt' } },
  goodCool: { level: 'good', emoji: '✅',
    title: { ko: '🏍 라이딩하기 좋은 날씨!', en: '🏍 Great riding weather!', vn: '🏍 Thời tiết tuyệt vời để lái xe!' },
    tip: { ko: '선선한 날씨 — 장갑과 재킷을 챙기세요', en: 'Cool weather — bring gloves and jacket', vn: 'Thời tiết mát — hãy mang găng tay và áo khoác' } },
  goodWarm: { level: 'good', emoji: '✅',
    title: { ko: '🏍 라이딩하기 좋은 날씨!', en: '🏍 Great riding weather!', vn: '🏍 Thời tiết tuyệt vời để lái xe!' },
    tip: { ko: '맑고 쾌적한 라이딩 컨디션입니다', en: 'Clear and pleasant riding conditions', vn: 'Điều kiện lái xe trong lành và dễ chịu' } },
};

function getRidingCondition(weather, lang) {
  const L = AQI_LABELS[lang] ? lang : 'ko';
  const id = weather.weather[0].id;
  const windSpeed = weather.wind?.speed || 0;
  const humidity = weather.main?.humidity || 0;
  const temp = weather.main?.temp || 25;
  const visibility = weather.visibility || 10000;
  const ws = Math.round(windSpeed);

  const pick = (key) => {
    const c = RIDING_CONDITIONS[key];
    const tip = typeof c.tip[L] === 'function' ? c.tip[L](ws) : c.tip[L];
    return { level: c.level, emoji: c.emoji, title: c.title[L], tip };
  };

  if (id >= 200 && id < 300) return pick('thunder');
  if ((id >= 500 && id < 600) || id === 771 || id === 781) return pick('rain');
  if (id >= 600 && id < 700) return pick('snow');
  if (id >= 700 && id < 800 && visibility < 1000) return pick('fog');
  if (windSpeed > 10) return pick('wind');
  if (humidity > 85) return pick('humidity');
  if (temp > 38) return pick('heat');
  return pick(temp < 20 ? 'goodCool' : 'goodWarm');
}

// OpenWeatherMap의 lang=kr 번역은 부자연스러운 경우가 많아 (예: "온흐림")
// 한국어만 날씨 코드(id) 기준 자체 사전을 사용하고, 영어/베트남어는 OWM 번역을 그대로 사용
function getWeatherDescKo(id) {
  const map = {
    200:'약한 비를 동반한 천둥번개', 201:'비를 동반한 천둥번개', 202:'강한 비를 동반한 천둥번개',
    210:'약한 천둥번개', 211:'천둥번개', 212:'강한 천둥번개', 221:'천둥번개',
    230:'약한 이슬비를 동반한 천둥번개', 231:'이슬비를 동반한 천둥번개', 232:'강한 이슬비를 동반한 천둥번개',
    300:'약한 이슬비', 301:'이슬비', 302:'강한 이슬비',
    310:'약한 이슬비', 311:'이슬비', 312:'강한 이슬비', 313:'소나기와 이슬비', 314:'강한 소나기와 이슬비', 321:'소나기성 이슬비',
    500:'약한 비', 501:'비', 502:'강한 비', 503:'매우 강한 비', 504:'폭우', 511:'어는 비',
    520:'약한 소나기', 521:'소나기', 522:'강한 소나기', 531:'소나기',
    600:'약한 눈', 601:'눈', 602:'폭설', 611:'진눈깨비', 612:'약한 진눈깨비', 613:'진눈깨비',
    615:'비와 눈', 616:'비와 눈', 620:'약한 눈', 621:'소낙눈', 622:'강한 소낙눈',
    701:'박무', 711:'연무', 721:'실안개', 731:'황사', 741:'안개', 751:'모래바람', 761:'먼지', 762:'화산재', 771:'돌풍', 781:'토네이도',
    800:'맑음', 801:'구름 조금', 802:'구름 많음', 803:'흐림', 804:'매우 흐림',
  };
  return map[id] || '흐림';
}

const OWM_LANG = { ko: 'kr', en: 'en', vn: 'vi' };

async function buildWeatherMessage(lat, lon, lang) {
  const L = AQI_LABELS[lang] ? lang : 'ko';
  const owmLang = OWM_LANG[L];
  const [wRes, aRes] = await Promise.all([
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY.value()}&units=metric&lang=${owmLang}`
    ),
    fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY.value()}`
    ),
  ]);
  const w = await wRes.json();
  const a = await aRes.json();
  if (w.cod !== 200) throw new Error(w.message || 'weather fetch failed');

  const temp = Math.round(w.main?.temp ?? 0);
  const id = w.weather?.[0]?.id;
  const descText = L === 'ko' ? getWeatherDescKo(id) : (w.weather?.[0]?.description || '');
  const aqi = a.list?.[0]?.main?.aqi;
  const aqiLabel = AQI_LABELS[L][aqi] || '';
  const cond = getRidingCondition(w, L);

  return {
    title: `${cond.emoji} ${cond.title}`,
    body: `${temp}°C · ${descText} · ${AQI_PREFIX[L]} ${aqiLabel} · ${cond.tip}`,
    color: LEVEL_COLOR[cond.level] || '#38A868',
  };
}

// ─────────────────────────────────────────
//  2) 매일 오전 8시 (베트남 시간) — 날씨/대기질 + 소모품 요약 푸시
// ─────────────────────────────────────────
exports.dailyWeatherPush = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Asia/Ho_Chi_Minh',
    secrets: [OWM_KEY],
  },
  async () => {
    const snap = await db.collection('notifyTargets').get();
    if (snap.empty) {
      console.log('[dailyWeatherPush] 대상 없음');
      return;
    }

    const jobs = snap.docs.map(async (doc) => {
      const t = doc.data();
      if (!t.fcmToken) return;

      const lang = AQI_LABELS[t.lang] ? t.lang : 'ko';
      let title, body, color;
      try {
        if (typeof t.lat === 'number' && typeof t.lon === 'number') {
          const msg = await buildWeatherMessage(t.lat, t.lon, lang);
          title = msg.title;
          body = msg.body;
          color = msg.color;
        } else {
          title = FALLBACK[lang].title;
          body = FALLBACK[lang].body;
        }
      } catch (e) {
        console.warn('[dailyWeatherPush] 날씨 조회 실패, 기본 문구 사용', doc.id, e.message);
        title = FALLBACK[lang].title;
        body = FALLBACK[lang].body;
      }

      // 소모품 상태를 알림 본문에 덧붙임 (교체 필요 > 곧 교체 우선순위)
      const c = t.consumables || {};
      const ctext = CONSUMABLE_TEXT[lang];
      if (c.urgent > 0) {
        const names = (c.urgentNames || []).join(', ');
        body += ` · ${ctext.urgent(c.urgent, names)}`;
      } else if (c.warn > 0) {
        const names = (c.warnNames || []).join(', ');
        body += ` · ${ctext.warn(c.warn, names)}`;
      }

      try {
        await admin.messaging().send({
          token: t.fcmToken,
          notification: { title, body },
          android: {
            priority: 'high',
            notification: { color: color || '#38A868' },
          },
        });
      } catch (e) {
        console.warn('[dailyWeatherPush] 발송 실패', doc.id, e.code || e.message);
        // 만료/삭제된 토큰이면 대상에서 제거
        if (
          e.code === 'messaging/registration-token-not-registered' ||
          e.code === 'messaging/invalid-registration-token'
        ) {
          await doc.ref.delete().catch(() => {});
        }
      }
    });

    await Promise.all(jobs);
    console.log(`[dailyWeatherPush] ${snap.size}건 처리 완료`);
  }
);
