/**
 * 브랜드 소식 소스 모듈 — 베트남 등록청(Cục Đăng kiểm Việt Nam, vr.org.vn) 공식 리콜 목록
 *
 * CLAUDE.md Tier 2 메인 소스. 정부 공식 등록/리콜 데이터라 다른 소스와 달리 실제
 * 베트남 판매/등록 차량 기준이므로 vnConfirmed:true (기본값, 명시 안 함).
 *
 * 이 목록(Category=7)은 오토바이 전용이 아니라 자동차/오토바이 리콜이 전부 섞여있고,
 * 특히 Honda·Suzuki는 베트남에서 자동차도 같이 팔기 때문에 브랜드명만으로는 못 거른다
 * (예: "Honda CIVIC"도, "Honda CBR1000RR"도 같은 "Honda Việt Nam" 명의로 올라옴).
 * 그래서 브랜드별로 실제 오토바이/스쿠터 모델명 화이트리스트로 다시 거른다 — vr.org.vn
 * 과거 전체 이력(13페이지)에서 실제 나온 모델명 기준으로 만들었고, 새 모델이 나오면
 * 목록에 없어서 조용히 걸러질 수 있다(과탐지보다 누락이 안전한 방향이라 의도적 선택).
 * Yamaha·Kawasaki는 베트남에서 자동차를 안 팔아서 브랜드명만으로 거른다.
 *
 * 공통 인터페이스: fetch() -> [{title, url, publishedAt, rawText, brand, sourceTier}, ...]
 */

const cheerio = require('cheerio');

const LIST_BASE_URL = 'https://www.vr.org.vn/Pages/thong-bao.aspx?Category=7';
const DETAIL_BASE_URL = 'https://www.vr.org.vn/Pages/thong-bao.aspx?ItemID=';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SOURCE_TIER = 'official_local';

// 전체 이력이 13페이지(~520건, 자동차 포함)라 매일 다 훑을 필요는 없다. 신규 항목은
// 항상 1페이지 앞쪽에 쌓이므로, 최근 몇 달치를 여유있게 담는 선에서 페이지 수를 제한한다.
const PAGES_TO_SCAN = 3;

const HONDA_MOTO_RE =
  /wave|future|blade|winner|air\s*blade|vision|\bsh\s?\d|sh125|sh150|sh300|sh350|\blead\b|pcx|vario|\bclick\b|rebel|cbr|gold\s*wing|goldwing|forza|\badv\b|monkey|msx|super\s*cub|\bcub\b|x-adv|h['’]?ness|cb\d{3}|africa\s*twin|crf\d/i;
const SUZUKI_MOTO_RE = /address|raider|satria|gsx|impulse|axelo|hayabusa|skydrive|viva|burgman|v-strom/i;
const VINFAST_MOTO_RE = /klara|feliz|theon|\bevo\s*(200|neo)?\b|vento|impes|ludo|tempest|\bvera\b|motio/i;

function detectBrand(text) {
  if (/yamaha/i.test(text)) return 'yamaha';
  if (/kawasaki/i.test(text)) return 'kawasaki';
  if (/honda/i.test(text) && HONDA_MOTO_RE.test(text)) return 'honda';
  if (/suzuki/i.test(text) && SUZUKI_MOTO_RE.test(text)) return 'suzuki';
  if (/vinfast/i.test(text) && VINFAST_MOTO_RE.test(text)) return 'vinfast';
  return null;
}

// 날짜가 "DD/MM/YYYY" 형식으로 온다.
function parseVrDate(text) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text || '');
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  return new Date(Date.UTC(year, month - 1, day));
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.text();
}

function extractItemId(href) {
  const m = /ItemID=(\d+)/.exec(href || '');
  return m ? m[1] : null;
}

async function fetchPage(pageNum) {
  const url = pageNum <= 1 ? LIST_BASE_URL : LIST_BASE_URL + '&Page=' + pageNum;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const items = [];

  $('table.tableList tr').each((_, el) => {
    const $row = $(el);
    if ($row.find('td').length === 0) return; // 헤더 행(th) 건너뜀

    const $descLink = $row.find('td').eq(1).find('a').first();
    const text = $descLink.text().replace(/\s+/g, ' ').trim();
    const href = $row.find('td').eq(0).find('a').first().attr('href');
    const itemId = extractItemId(href);
    const dateText = $row.find('td').eq(2).text().trim();
    if (!text || !itemId) return;

    const brand = detectBrand(text);
    if (!brand) return;

    items.push({
      title: text,
      url: DETAIL_BASE_URL + itemId,
      publishedAt: parseVrDate(dateText),
      rawText: text,
      brand,
      sourceTier: SOURCE_TIER
    });
  });

  return items;
}

async function fetch_() {
  const results = [];
  for (let p = 1; p <= PAGES_TO_SCAN; p++) {
    try {
      const items = await fetchPage(p);
      results.push(...items);
    } catch (e) {
      console.warn('[vrOrgVn] 페이지 조회 실패:', p, e.message);
    }
  }
  return results;
}

module.exports = { fetch: fetch_ };
