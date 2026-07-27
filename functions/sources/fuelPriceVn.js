/**
 * 유가 소스 모듈 — VietnamNet "Giá xăng dầu hôm nay" 시리즈 (1순위)
 *
 * CLAUDE.md "유가 정보 기능" 설계 참고. 고정 태그 페이지에서 최신 글 링크를 찾아
 * 본문에서 E5 RON92 / E10 RON95(=RON95) 가격과 발효일("kỳ điều hành DD/M")을
 * 정규식으로 추출한다.
 *
 * 매일 발행되는 시리즈지만 2026-07-01~07-11처럼 시리즈 자체가 통째로 빠진 전례가
 * 실제로 있었다(CLAUDE.md 조사 기록 참고) — 이 모듈이 새 글을 못 찾는 게 항상
 * 에러는 아니다. 호출부(fuelPrice.js)가 폴백/경고 임계값을 판단한다.
 *
 * 발효일이 기사 발행일과 다른 경우가 흔하다 — 예: 27일에 올라온 기사가 "kỳ điều hành
 * 23/7"(23일에 발효된 가격, 그 이후 변동 없음)을 그대로 재확인해주는 경우. dedupeKey를
 * effectiveAt 기준으로 잡는 이유가 이것 때문(fuelPrice.js 참고, sourceUrl 기준 아님).
 *
 * ⚠️ 조정 당일 아침 기사 함정(실측으로 확인됨): 15시 조정 전에 올라온 그날 아침 기사는
 * 본문에 "오늘 아침 기준(sáng nay)" 구 가격을 먼저 적어두고, 새 가격은 글 맨 끝
 * "관련 기사" 티저에 "không cao hơn" 없이 다른 문장 패턴("xăng E10 lên 21.435 đồng/lít"
 * 등)으로만 슬쩍 나온다. 문서 전체에서 "không cao hơn"을 아무거나 찾으면 이 구 가격을
 * 잘못 집어서 effectiveAt 기준으로 영구 저장해버리는 사고가 남(다음날 기사가 정정해줘도
 * dedupeKey가 이미 있어서 스킵됨). 그래서 "kỳ điều hành DD/M"처럼 명시적 숫자 날짜가
 * 붙은 확정 문구를 앵커로 찾고, 그 앵커 바로 뒤 구간에서만 가격을 뽑는다 — 이 앵커가
 * 없는 기사(=아직 그날 확정 안 됨)는 그냥 null 반환하고 다음날 재시도에 맡긴다.
 *
 * ⚠️ 본문 셀렉터 주의: 위 문제와 별개로, 넓은 셀렉터(article, .maincontent 전체)로
 * 긁으면 "관련 기사" 티저 블록까지 통째로 섞여 들어온다. `.content-detail`로 좁혀서
 * 긁으면 실측 확인상 티저가 섞이지 않았다 — 사이트 개편으로 이 클래스가 바뀌면 폴백
 * 셀렉터가 다시 티저를 주워올 위험이 있으니, 그런 경우 가격 파싱 결과를 의심해볼 것.
 *
 * 인터페이스: fetch() -> {effectiveAt, prices:{e5_ron92,e10_ron95}, sourceUrl, sourceName, sourceTier} | null
 */

const cheerio = require('cheerio');

const TAG_URL = 'https://vietnamnet.vn/gia-xang-dau-tag5537394984591514120.html';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SOURCE_NAME = 'VietnamNet';
const SOURCE_TIER = 'press_general';

const ARTICLE_LINK_RE = /gia-xang-dau-hom-nay-\d{1,2}-\d{1,2}-[^"']*?-\d+\.html/i;
// [\s\S] (마침표 포함 아무 문자) 사용 — "1.062"처럼 베트남식 숫자 표기 자체에
// 마침표가 들어있어서 [^.]로 문장 경계를 끊으면 숫자 앞에서 매치가 끊겨버림.
// 대신 80자 이내로 거리를 제한해서 다음 유종 문장까지 넘어가지 않게 함.
const E5_RE = /E5[\s\S]{0,80}?không\s*cao\s*hơn\s*([\d.]+)\s*đồng/i;
const E10_RE = /(?:E10|RON\s*95)[\s\S]{0,80}?không\s*cao\s*hơn\s*([\d.]+)\s*đồng/i;
const EFFECTIVE_DATE_RE = /kỳ\s*điều\s*hành\s*(\d{1,2})\s*\/\s*(\d{1,2})/i;

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.text();
}

// 태그 목록 페이지는 최신순 정렬 확인됨(CLAUDE.md 조사 기록) — 첫 매치가 최신 글
function findLatestArticleUrl(html) {
  const $ = cheerio.load(html);
  let found = null;
  $('a[href*="gia-xang-dau-hom-nay-"]').each((_, el) => {
    if (found) return;
    const href = $(el).attr('href');
    if (href && ARTICLE_LINK_RE.test(href)) {
      found = href.startsWith('http') ? href : new URL(href, TAG_URL).toString();
    }
  });
  return found;
}

function toNumber(vnNum) {
  // 베트남식 천단위 구분자 "." 제거 (예: "21.435" -> 21435)
  return parseInt(vnNum.replace(/\./g, ''), 10);
}

// "kỳ điều hành DD/M" 앵커 위치를 찾는다. 이 앵커가 있어야만 그 뒤 가격을 신뢰할 수 있음
// (위 파일 상단 주석 "조정 당일 아침 기사 함정" 참고) — 못 찾으면 null.
function findEffectiveDateAnchor(text) {
  const m = EFFECTIVE_DATE_RE.exec(text);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const now = new Date();
  let year = now.getUTCFullYear();
  // 연말/연초 경계: 지금은 초반 달인데 파싱된 달이 훨씬 크면 작년 발효분
  if (month - (now.getUTCMonth() + 1) > 6) year -= 1;
  // 15:00(ICT)는 MOIT가 보통 발효시키는 시각 — 본문에 별도 시각이 없으면 기본값으로 사용
  const effectiveAt = new Date(Date.UTC(year, month - 1, day, 8, 0, 0)); // UTC 08:00 = ICT 15:00
  return { effectiveAt, index: m.index + m[0].length };
}

async function fetchArticleText(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  let text = $('.content-detail').first().text();
  if (!text || text.length < 100) text = $('.maincontent, article').first().text(); // 폴백(위 주의사항 참고)
  return text.replace(/\s+/g, ' ').trim();
}

const ANCHOR_WINDOW_CHARS = 300; // "kỳ điều hành DD/M" 뒤 이 범위 안에서만 가격을 인정

async function fetch_() {
  const listHtml = await fetchHtml(TAG_URL);
  const articleUrl = findLatestArticleUrl(listHtml);
  if (!articleUrl) return null;

  const text = await fetchArticleText(articleUrl);
  const anchor = findEffectiveDateAnchor(text);
  if (!anchor) return null; // 아직 이번 조정이 "확정 문구"로 안 나온 기사 — 다음 실행에 재시도

  const window_ = text.slice(anchor.index, anchor.index + ANCHOR_WINDOW_CHARS);
  const e5Match = E5_RE.exec(window_);
  const e10Match = E10_RE.exec(window_);
  if (!e5Match && !e10Match) return null; // 앵커는 있는데 근처에 가격이 없음 — 사이트 구조 변경 의심

  return {
    effectiveAt: anchor.effectiveAt,
    prices: {
      e5_ron92: e5Match ? toNumber(e5Match[1]) : null,
      e10_ron95: e10Match ? toNumber(e10Match[1]) : null
    },
    sourceUrl: articleUrl,
    sourceName: SOURCE_NAME,
    sourceTier: SOURCE_TIER
  };
}

module.exports = { fetch: fetch_ };
