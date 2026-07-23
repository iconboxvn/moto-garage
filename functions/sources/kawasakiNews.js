/**
 * 브랜드 소식 소스 모듈 — Kawasaki 글로벌 뉴스(모터사이클/엔진 사업부)
 *
 * 베트남 공식 사이트(kawasaki-motors.vn)에는 뉴스/리콜 섹션이 없어서(2026-07 확인),
 * 대신 일본 본사 글로벌 뉴스 페이지에서 신차/기술/사업 소식을 가져온다.
 * 안전(리콜) 소식은 이 소스가 아니라 NHTSA 소스(nhtsaRecalls.js)에서 담당한다.
 * 베트남 판매 차량 적용 여부는 확인되지 않은 정보이므로 vnConfirmed:false로 표시한다.
 *
 * 공통 인터페이스: fetch() -> [{title, url, publishedAt, rawText, brand, sourceTier, vnConfirmed}, ...]
 */

const cheerio = require('cheerio');

const LISTING_URL = 'https://global.kawasaki.com/en/corp/profile/division/motorcycle_engine/news.html';
const BASE_URL = 'https://global.kawasaki.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BRAND = 'kawasaki';
const SOURCE_TIER = 'official_global';

// "Dec. 03, 2025" 형식 -> Date
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
    const text = $('.row.block').text();
    return text.replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.warn('[kawasakiNews] detail fetch failed:', url, e.message);
    return '';
  }
}

// 이 페이지는 페이지네이션 없이 몇 년치(2001년~) 기사가 한 번에 다 나온다(확인 결과
// 100건 이상). 게시 빈도도 불규칙해서(몇 달씩 안 올라오기도 함) 날짜 기준으로 자르면
// "최근 게시물 없음"과 "스크래핑이 깨짐"을 구분하기 어려워진다. 대신 목록 순서(최신순)
// 기준으로 상위 N개만 상세를 가져온다 — 매일 겹치는 항목은 dedupeKey로 자연히 걸러짐.
const MAX_ITEMS = 20;

async function fetchList() {
  const html = await fetchHtml(LISTING_URL);
  const $ = cheerio.load(html);
  const items = [];

  $('.newsListArea dl.line_1ofList').each((_, el) => {
    if (items.length >= MAX_ITEMS) return;
    const $item = $(el);
    const href = $item.find('dd a').first().attr('href');
    const title = $item.find('dd a').first().text().replace(/\s+/g, ' ').trim();
    const dateText = $item.find('dt span').first().text().trim();
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
