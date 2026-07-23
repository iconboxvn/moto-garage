/**
 * 브랜드 소식 소스 모듈 — 아세안데일리(한인 대상 베트남/아세안 전문 매체) 정책 뉴스
 *
 * CLAUDE.md policy 카테고리 전용 소스("한인 대상 매체 우선"). 브랜드 무관, 교통
 * 범칙금·저배출구역·통제구역 등 정부/교통 정책만 다룬다.
 *
 * 이 사이트의 articleList.html(카테고리/국가별 목록, 페이지네이션)은 쿼리스트링을
 * 무시하고 항상 같은 캐시된 최신 20건만 돌려주는 걸 확인했다(섹션 필터·페이지 번호
 * 다 시도해봤지만 결과가 전부 동일) — 아마 CDN/리버스프록시 캐시가 쿼리스트링을
 * 무시하는 것으로 보인다. 대신 RSS 피드(rss/allArticle.xml)는 정상적으로 최신 50건을
 * 주고 캐시 문제도 없어서 이걸 쓴다. RSS는 국가/카테고리 태그가 없어서, 제목+본문
 * 발췌에 베트남 키워드와 정책 키워드가 둘 다 있는지로 직접 걸러낸다.
 *
 * 아세안데일리는 태국·인도네시아 등 다른 아세안 국가 뉴스도 같이 발행해서 베트남
 * 키워드 체크가 필요하고, 전체 뉴스의 대부분이 정책과 무관한 일반 뉴스(경제/문화 등)라
 * 정책 키워드 체크도 필요하다.
 *
 * 처음엔 "정책/단속 관련 단어 하나만 있으면 통과" 식으로 짰다가 테스트에서 오탐 2건을
 * 발견해서(① 오토바이 등록 통계 기사 — "교통경찰국"이라는 출처 표기만으로 걸림,
 * ② PC방 영업시간 규제 기사 — "과태료" 단어만으로 걸림, 차량과 무관) 차량/교통
 * 키워드(TRAFFIC_RE)와 단속/규제 행위 키워드(ACTION_RE)를 분리해서 "둘 다 있어야"
 * 통과하는 방식으로 바꿨다. 키워드 목록은 1차 버전이라 실제 운영하면서 놓치는 유형이
 * 보이면 보강해야 한다.
 *
 * 공통 인터페이스: fetch() -> [{title, url, publishedAt, rawText, brand, sourceTier}, ...]
 */

const cheerio = require('cheerio');

const RSS_URL = 'https://www.aseandaily.co.kr/rss/allArticle.xml';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SOURCE_TIER = 'press_kr';

const VIETNAM_RE = /베트남|하노이|호찌민|호치민|다낭|호이안|나짱|껀터|하이퐁/;
// 차량/교통 관련 화제인지
const TRAFFIC_RE = /오토바이|자동차|차량|이륜차|헬멧|번호판|주차|운전면허|운전자|교통|도로|저배출구역/;
// 단속/규제/정책 행위인지 (둘 다 있어야 정책 뉴스로 판단)
const ACTION_RE = /범칙금|과태료|단속|규제|법규|제한|벌점|정지|취소|의무|통행료/;

async function fetchXml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.text();
}

function parsePubDate(text) {
  if (!text) return null;
  const d = new Date(text.trim().replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

async function fetch_() {
  const xml = await fetchXml(RSS_URL);
  const $ = cheerio.load(xml, { xmlMode: true });
  const results = [];

  $('item').each((_, el) => {
    const $item = $(el);
    const title = $item.find('title').first().text().trim();
    const url = $item.find('link').first().text().trim();
    const description = $item.find('description').first().text().replace(/\s+/g, ' ').trim();
    const pubDate = $item.find('pubDate').first().text().trim();
    if (!title || !url) return;

    const combined = title + ' ' + description;
    if (!VIETNAM_RE.test(combined) || !TRAFFIC_RE.test(combined) || !ACTION_RE.test(combined)) return;

    results.push({
      title,
      url,
      publishedAt: parsePubDate(pubDate),
      rawText: description || title,
      brand: null,
      sourceTier: SOURCE_TIER
    });
  });

  return results;
}

module.exports = { fetch: fetch_ };
