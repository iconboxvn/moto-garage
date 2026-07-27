/**
 * 유가 소스 모듈 — MOIT(산업무역부) 직접 (폴백 전용, 1순위 아님)
 *
 * CLAUDE.md "유가 정보 기능" 설계 참고. MOIT는 유가 발표를 문서 텍스트로 갖고 있지만
 * (`/tin-tuc/...-dieu-hanh-gia-xang-dau-ngay-*.html`), 최신 글을 자동으로 찾을
 * 목록/RSS/검색 엔드포인트를 못 찾았다 — 그래서 날짜 기반 URL 후보를 순차 시도하는
 * 방식만 가능하다. fuelPriceVn.js(1순위)가 실패했을 때만 fuelPrice.js가 이 모듈을 호출한다.
 *
 * 제목 패턴이 "Một số thông tin về việc..." / "Thông tin về việc..." 두 가지로 들쭉날쭉하고,
 * 날짜의 일(day) 부분도 0패딩("09")과 무패딩("9") 둘 다 실제로 관측됨(월은 항상 무패딩).
 * → prefix 2종 × day패딩 2종 = 후보 4개를 하루치로 만든다.
 *
 * 폴백은 "이미 며칠 공백이 난 상황"에서만 호출되므로, 오늘 하루만 시도하면 놓친 과거
 * 조정을 못 따라잡는다 — 최근 7일치를 뒤에서부터(오늘 → 6일 전) 훑어서 처음 성공하는
 * 후보를 채택한다.
 *
 * moit.gov.vn은 없는 페이지를 HTTP 404가 아니라 200 + `?page=404`로 리다이렉트하는
 * 방식으로 처리한다(실측 확인됨) — 그래서 상태 코드만으로는 성공 여부를 못 가리고,
 * 리다이렉트 후 최종 URL이 `page=404`를 포함하는지로 판별해야 한다.
 *
 * 인터페이스: fetch() -> {effectiveAt, prices:{e5_ron92,e10_ron95}, sourceUrl, sourceName, sourceTier} | null
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SOURCE_NAME = 'MOIT';
const SOURCE_TIER = 'official_local';

const TITLE_PREFIXES = [
  'mot-so-thong-tin-ve-viec-dieu-hanh-gia-xang-dau-ngay-',
  'thong-tin-ve-viec-dieu-hanh-gia-xang-dau-ngay-'
];
const LOOKBACK_DAYS = 7;

// MOIT 기사 특유의 표기("Xăng E5RON92: không cao hơn ...") — VietnamNet과 문장 구조가 달라
// 별도 정규식 사용. 이 기사 유형은 유가 발효 시각(15시) 이후에 올라오는 확정 발표라
// fuelPriceVn.js처럼 "조정 전 구가격"을 잘못 집을 위험은 낮다(관측 샘플 1건 기준 — 추후
// 실제 운영하며 반례가 나오면 앵커 기반으로 보강할 것).
const E5_RE = /E5\s*RON\s*92[\s\S]{0,60}?không\s*cao\s*hơn\s*([\d.]+)\s*đồng/i;
const E10_RE = /(?:E10\s*RON\s*95|RON\s*95)[\s\S]{0,60}?không\s*cao\s*hơn\s*([\d.]+)\s*đồng/i;

function toNumber(vnNum) {
  return parseInt(vnNum.replace(/\./g, ''), 10);
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

// 오늘부터 LOOKBACK_DAYS일 전까지, 하루당 후보 URL 4개(prefix 2 × day패딩 2)를 만든다
function buildCandidates() {
  const candidates = [];
  const now = new Date();
  for (let offset = 0; offset < LOOKBACK_DAYS; offset++) {
    const d = new Date(now.getTime() - offset * 86400000);
    // ICT(UTC+7) 기준 날짜로 보정
    const ict = new Date(d.getTime() + 7 * 3600000);
    const day = ict.getUTCDate();
    const month = ict.getUTCMonth() + 1;
    const year = ict.getUTCFullYear();
    const dayVariants = day < 10 ? [pad2(day), String(day)] : [String(day)];
    for (const prefix of TITLE_PREFIXES) {
      for (const dayStr of dayVariants) {
        candidates.push({
          url: 'https://moit.gov.vn/tin-tuc/' + prefix + dayStr + '-' + month + '-' + year + '.html',
          day,
          month,
          year
        });
      }
    }
  }
  return candidates;
}

async function tryCandidate(c) {
  const res = await fetch(c.url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  if (!res.ok) return null;
  if (res.url && res.url.includes('page=404')) return null; // moit.gov.vn 소프트 404
  const html = await res.text();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const e5Match = E5_RE.exec(text);
  const e10Match = E10_RE.exec(text);
  if (!e5Match && !e10Match) return null;

  return {
    effectiveAt: new Date(Date.UTC(c.year, c.month - 1, c.day, 8, 0, 0)), // ICT 15:00
    prices: {
      e5_ron92: e5Match ? toNumber(e5Match[1]) : null,
      e10_ron95: e10Match ? toNumber(e10Match[1]) : null
    },
    sourceUrl: c.url,
    sourceName: SOURCE_NAME,
    sourceTier: SOURCE_TIER
  };
}

async function fetch_() {
  for (const c of buildCandidates()) {
    try {
      const result = await tryCandidate(c);
      if (result) return result;
    } catch (e) {
      console.warn('[fuelPriceMoit] 후보 실패:', c.url, e.message);
    }
  }
  return null;
}

module.exports = { fetch: fetch_ };
