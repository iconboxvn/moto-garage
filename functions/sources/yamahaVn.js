/**
 * 브랜드 소식 소스 모듈 — Yamaha 베트남 공식 뉴스 목록
 *
 * CLAUDE.md "브랜드 소식 기능" 설계의 Tier 2 소스 중 하나.
 * https://yamaha-motor.com.vn/tin-tuc/ 는 리콜/공지/신차/이벤트/팁 기사가 전부
 * 섞여서 올라오는 일반 뉴스 목록이다. Honda 소스와 마찬가지로 카테고리 분류는
 * 여기서 하지 않고 메인 파이프라인(brandNews.js)의 Claude 분류 단계에 맡긴다.
 *
 * 공통 인터페이스: fetch() -> [{title, url, publishedAt, rawText, brand, sourceTier}, ...]
 */

const cheerio = require('cheerio');

const LISTING_URL = 'https://yamaha-motor.com.vn/tin-tuc/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BRAND = 'yamaha';
const SOURCE_TIER = 'official_local';

// Yamaha VN은 날짜를 DD.MM.YYYY(점 구분)로 표기한다 (Honda는 슬래시).
function parseVnDate(text) {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(text || '');
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

// 상세 페이지 본문(.post_content)을 텍스트로. 실패하면 빈 문자열(호출부에서 제목으로 대체).
async function fetchDetailText(url) {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const text = $('.post_content').first().text();
    return text.replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.warn('[yamahaVn] detail fetch failed:', url, e.message);
    return '';
  }
}

async function fetchList() {
  const html = await fetchHtml(LISTING_URL);
  const $ = cheerio.load(html);
  const items = [];

  $('.news-list .item').each((_, el) => {
    const $item = $(el);
    const href = $item.find('a').first().attr('href');
    const title = $item.find('h3.ttl').text().replace(/\s+/g, ' ').trim();
    const dateText = $item.find('.cat-date .date').first().text().trim();
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
