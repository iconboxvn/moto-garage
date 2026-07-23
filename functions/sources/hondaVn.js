/**
 * 브랜드 소식 소스 모듈 — Honda 베트남 공식 뉴스 목록
 *
 * CLAUDE.md "브랜드 소식 기능" 설계의 Tier 2 소스 중 하나.
 * https://www.honda.com.vn/xe-may/tin-tuc 는 리콜뿐 아니라 신차 출시, 매장 소식,
 * 이벤트 등 카테고리 구분 없이 전부 올라오는 일반 뉴스 목록이다. 카테고리 분류는
 * 여기서 하지 않고, 메인 파이프라인(brandNews.js)이 Claude로 항목마다 판단한다
 * (safety로 분류된 항목만 별도로 리콜 키워드 재검증을 거침).
 *
 * 공통 인터페이스: fetch() -> [{title, url, publishedAt, rawText, brand, sourceTier}, ...]
 */

const cheerio = require('cheerio');

const LISTING_URL = 'https://www.honda.com.vn/xe-may/tin-tuc';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BRAND = 'honda';
const SOURCE_TIER = 'official_local';

// 베트남식 날짜 표기(DD/MM/YYYY) -> Date. 못 읽으면 null.
function parseVnDate(text) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text || '');
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  return new Date(Date.UTC(year, month - 1, day));
}

function toAbsoluteUrl(href) {
  if (!href) return null;
  return href.startsWith('http') ? href : new URL(href, LISTING_URL).toString();
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.text();
}

// 상세 페이지 본문(.editable)을 텍스트로. 실패하면 빈 문자열(호출부에서 제목으로 대체).
async function fetchDetailText(url) {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const text = $('div.editable').text();
    return text.replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.warn('[hondaVn] detail fetch failed:', url, e.message);
    return '';
  }
}

async function fetchList() {
  const html = await fetchHtml(LISTING_URL);
  const $ = cheerio.load(html);
  const items = [];

  $('.main-content .item a[href]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    const title = $a.find('.text').text().replace(/\s+/g, ' ').trim();
    const dateText = $a.find('.time').text().trim();
    if (!href || !title) return;
    items.push({
      title,
      url: toAbsoluteUrl(href),
      publishedAt: parseVnDate(dateText)
    });
  });

  return items;
}

async function fetch_() {
  const items = await fetchList();
  const results = [];
  for (const item of items) {
    const rawText = await fetchDetailText(item.url);
    results.push({
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
      rawText: rawText || item.title,
      brand: BRAND,
      sourceTier: SOURCE_TIER
    });
  }
  return results;
}

module.exports = { fetch: fetch_ };
