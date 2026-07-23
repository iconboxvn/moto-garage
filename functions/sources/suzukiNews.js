/**
 * 브랜드 소식 소스 모듈 — Suzuki 미국 공식 뉴스(suzukicycles.com)
 *
 * 베트남 공식 사이트(suzuki.com.vn)의 뉴스 목록은 Next.js SPA라 서버 응답에 목록이
 * 안 실려있어서(2026-07 확인) 대신 미국 Suzuki Motor USA 공식 뉴스를 사용한다.
 * 안전(리콜) 소식은 이 소스가 아니라 NHTSA 소스(nhtsaRecalls.js)에서 담당한다.
 * 베트남 판매 차량 적용 여부는 확인되지 않은 정보이므로 vnConfirmed:false로 표시한다.
 *
 * 공통 인터페이스: fetch() -> [{title, url, publishedAt, rawText, brand, sourceTier, vnConfirmed}, ...]
 */

const cheerio = require('cheerio');

const LISTING_URL = 'https://suzukicycles.com/news';
const BASE_URL = 'https://suzukicycles.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BRAND = 'suzuki';
const SOURCE_TIER = 'official_global';

// "July 14, 2026" 형식 -> Date
function parseEnDate(text) {
  const d = new Date(text || '');
  return isNaN(d.getTime()) ? null : d;
}

function toAbsoluteUrl(href) {
  if (!href) return null;
  return href.startsWith('http') ? href : new URL(href, BASE_URL).toString();
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.text();
}

async function fetchDetailText(url) {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const text = $('article.news-article section').first().text();
    return text.replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.warn('[suzukiNews] detail fetch failed:', url, e.message);
    return '';
  }
}

async function fetchList() {
  const html = await fetchHtml(LISTING_URL);
  const $ = cheerio.load(html);
  const items = [];

  $('article.news-article-preview').each((_, el) => {
    const $item = $(el);
    const $link = $item.find('.preview h1 a').first();
    const href = $link.attr('href');
    const title = $link.text().replace(/\s+/g, ' ').trim();
    const dateText = $item.find('header time').first().text().trim();
    if (!href || !title) return;
    items.push({
      title,
      url: toAbsoluteUrl(href),
      publishedAt: parseEnDate(dateText)
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
      sourceTier: SOURCE_TIER,
      vnConfirmed: false
    });
  }
  return results;
}

module.exports = { fetch: fetch_ };
