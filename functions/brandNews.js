/**
 * Ridemate — 브랜드 소식 피드 수집 파이프라인
 *
 * CLAUDE.md "브랜드 소식 기능" 설계 참고. 현재 8개 소스가 SOURCES 배열에 연결돼있음
 * (Honda VN, Yamaha VN, Kawasaki 글로벌, Suzuki USA, NHTSA, 베트남 등록청, EU Safety
 * Gate, 아세안데일리 정책). 새 소스는 같은 인터페이스({fetch})로 추가하면 됨.
 *
 * 매일 새벽 3시(Asia/Ho_Chi_Minh)에 실행:
 *   1) 최근 60일치 dedupeKey 로드
 *   2) 소스별 fetch() 병렬 호출 (allSettled — 하나 실패해도 나머지 계속)
 *   3) 신규 항목만 골라 Claude로 요약(ko/en/vn) + 카테고리 태깅
 *   4) safety 카테고리는 원문에 리콜 관련 키워드가 실제로 있는지 재확인 후 보류/발행
 *   5) brand_news 컬렉션에 저장
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const ANTHROPIC_KEY = defineSecret('ANTHROPIC_KEY');
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'; // 번역+분류 정도라 비용 효율 위해 Haiku 사용

const SOURCES = [
  { name: 'hondaVn', sourceName: 'Honda Việt Nam', module: require('./sources/hondaVn'), lang: 'vi' },
  { name: 'yamahaVn', sourceName: 'Yamaha Motor Việt Nam', module: require('./sources/yamahaVn'), lang: 'vi' },
  { name: 'kawasakiNews', sourceName: 'Kawasaki Motors, Ltd. (Global)', module: require('./sources/kawasakiNews'), lang: 'en' },
  { name: 'suzukiNews', sourceName: 'Suzuki Motor USA', module: require('./sources/suzukiNews'), lang: 'en' },
  { name: 'nhtsaRecalls', sourceName: 'NHTSA (미국 도로교통안전국)', module: require('./sources/nhtsaRecalls'), lang: 'en' },
  { name: 'vrOrgVn', sourceName: 'Cục Đăng kiểm Việt Nam (베트남 등록청)', module: require('./sources/vrOrgVn'), lang: 'vi' },
  { name: 'euSafetyGate', sourceName: 'EU Safety Gate', module: require('./sources/euSafetyGate'), lang: 'en' },
  { name: 'aseanDailyPolicy', sourceName: '아세안데일리', module: require('./sources/aseanDailyPolicy'), lang: 'ko' }
];

const DEDUPE_LOOKBACK_DAYS = 60;
const ZERO_RESULT_WARN_STREAK = 14; // 이 횟수 연속으로 0건이면 로그에 경고 (스크래핑 구조 변경 감지용)
const SAFETY_KEYWORD_RE = /(triệu\s*hồi|thu\s*hồi|recall)/i;

function dedupeKeyFor(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

async function loadRecentDedupeKeys() {
  const cutoff = new Date(Date.now() - DEDUPE_LOOKBACK_DAYS * 86400000);
  const snap = await db
    .collection('brand_news')
    .where('collectedAt', '>=', cutoff)
    .select('dedupeKey')
    .get();
  const set = new Set();
  snap.forEach((doc) => {
    const k = doc.get('dedupeKey');
    if (k) set.add(k);
  });
  return set;
}

// 스크래핑 소스가 사이트 구조 변경으로 "에러 없이 0건"만 반환하는 걸 조용히 넘기지 않기 위한
// 최소 상태 추적. 소스당 문서 하나(_meta/brandNewsSource_{name})에 연속 0건 횟수만 기록.
async function trackZeroResultStreak(sourceName, fetchedCount) {
  const ref = db.collection('_meta').doc('brandNewsSource_' + sourceName);
  const snap = await ref.get();
  const prevStreak = (snap.exists && snap.get('zeroStreak')) || 0;
  const streak = fetchedCount > 0 ? 0 : prevStreak + 1;
  await ref.set({ zeroStreak: streak, lastRunAt: admin.firestore.FieldValue.serverTimestamp(), lastFetchedCount: fetchedCount }, { merge: true });
  if (streak >= ZERO_RESULT_WARN_STREAK) {
    console.warn(`[brandNews] 소스 "${sourceName}"가 ${streak}회 연속 0건 — 사이트 구조 변경 등으로 스크래핑이 깨졌을 가능성`);
  }
}

async function summarizeAndCategorize(item) {
  const tools = [
    {
      name: 'submit_news_item',
      description: '오토바이 브랜드 소식 원문을 분류하고 3개 언어로 요약합니다.',
      input_schema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['safety', 'product', 'tech', 'service', 'event', 'policy', 'info'],
            description: 'safety=리콜/서비스캠페인, product=신차/신모델, tech=펌웨어/부품개선, service=보증/딜러망, event=행사, policy=교통정책(브랜드 무관인 경우만), info=특정 발표/공지가 아닌 일반 정비 팁·사용법 가이드(예: "오일 체크하는 법", "장마철 침수 대처법") — 브랜드 발표가 아니면 여기로'
          },
          title: {
            type: 'object',
            properties: { ko: { type: 'string' }, en: { type: 'string' }, vn: { type: 'string' } },
            required: ['ko', 'en', 'vn']
          },
          summary: {
            type: 'object',
            description: '각 언어로 2줄 이내 요약',
            properties: { ko: { type: 'string' }, en: { type: 'string' }, vn: { type: 'string' } },
            required: ['ko', 'en', 'vn']
          }
        },
        required: ['category', 'title', 'summary']
      }
    }
  ];

  const prompt =
    '다음은 오토바이 브랜드 공식 소식 원문(베트남어)입니다. submit_news_item 도구로 분류·번역·요약해서 제출하세요.\n\n' +
    '제목: ' + item.title + '\n\n' +
    '본문: ' + item.rawText.slice(0, 4000);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY.value(),
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      tools,
      tool_choice: { type: 'tool', name: 'submit_news_item' },
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error('Anthropic API ' + res.status + ': ' + (await res.text()).slice(0, 300));
  }
  const data = await res.json();
  const toolUse = (data.content || []).find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('tool_use 응답 없음: ' + JSON.stringify(data).slice(0, 300));
  return toolUse.input;
}

exports.collectBrandNews = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Asia/Ho_Chi_Minh',
    secrets: [ANTHROPIC_KEY],
    // 소스가 8개로 늘면서 실제 실행 시간이 400~550초까지 관찰됨(EU Safety Gate 상세
    // 조회 최대 60회 + NHTSA 순차 호출이 큰 비중) — 예전 300초 설정으론 부족해서 올림.
    timeoutSeconds: 900
  },
  async () => {
    const runLog = { sources: {}, newCount: 0, skippedSafetyCheck: 0, errorCount: 0 };
    const existingKeys = await loadRecentDedupeKeys();

    const results = await Promise.allSettled(SOURCES.map((s) => s.module.fetch()));

    const candidates = [];
    for (let i = 0; i < SOURCES.length; i++) {
      const src = SOURCES[i];
      const r = results[i];
      if (r.status === 'rejected') {
        runLog.sources[src.name] = { ok: false, error: String((r.reason && r.reason.message) || r.reason) };
        continue;
      }
      const items = r.value || [];
      await trackZeroResultStreak(src.name, items.length);
      let newForSource = 0;
      for (const item of items) {
        if (!item.url) continue;
        const dedupeKey = dedupeKeyFor(item.url);
        if (existingKeys.has(dedupeKey)) continue;
        existingKeys.add(dedupeKey); // 같은 실행 안에서의 중복도 방지
        newForSource++;
        candidates.push({
          item,
          dedupeKey,
          sourceName: src.sourceName,
          sourceTier: item.sourceTier,
          originalLanguage: src.lang,
          vnConfirmed: item.vnConfirmed !== undefined ? item.vnConfirmed : true
        });
      }
      runLog.sources[src.name] = { ok: true, fetched: items.length, new: newForSource };
    }

    for (const c of candidates) {
      try {
        const meta = await summarizeAndCategorize(c.item);

        if (meta.category === 'safety' && !SAFETY_KEYWORD_RE.test(c.item.title + ' ' + c.item.rawText)) {
          console.warn('[brandNews] safety로 분류됐지만 원문에 리콜 키워드가 없어 보류:', c.item.url);
          runLog.skippedSafetyCheck++;
          continue;
        }

        await db.collection('brand_news').add({
          category: meta.category,
          brand: c.item.brand || null,
          model: null,
          title: meta.title,
          summary: meta.summary,
          sourceName: c.sourceName,
          sourceUrl: c.item.url,
          sourceTier: c.sourceTier || null,
          originalLanguage: c.originalLanguage || 'vi',
          vnConfirmed: c.vnConfirmed,
          publishedAt: c.item.publishedAt || admin.firestore.FieldValue.serverTimestamp(),
          collectedAt: admin.firestore.FieldValue.serverTimestamp(),
          safetyVerified: meta.category === 'safety',
          dedupeKey: c.dedupeKey
        });
        runLog.newCount++;
      } catch (e) {
        runLog.errorCount++;
        console.error('[brandNews] 항목 처리 실패:', c.item.url, e.message);
      }
    }

    console.log('[brandNews] 실행 완료:', JSON.stringify(runLog));
  }
);
