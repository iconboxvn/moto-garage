/**
 * Ridemate 홍보 웹사이트 정적 생성기.
 *
 *   node build.mjs                 → 한국어만 (기본)
 *   SITE_LANGS=ko,en,vn node build.mjs → 3개 언어
 *
 * Firestore `brand_news`를 공개 REST로 읽어 dist/ 에 정적 HTML을 만든다.
 * 배포: firebase deploy --only hosting  (firebase.json hosting.public = site/dist)
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

import { fetchCollection } from './lib/firestore.mjs';
import {
  LANGS, setBuiltLangs, localizedPath, absUrl, SITE_ORIGIN, PLAY_URL, esc, isoDate,
} from './lib/render.mjs';
import { articleSlug, brandSlug } from './lib/slug.mjs';
import STRINGS, { CATEGORY_ORDER, CATEGORY_LABEL, brandLabel } from './content/strings.mjs';
import { renderHome } from './pages/home.mjs';
import { renderNewsIndex } from './pages/newsIndex.mjs';
import { renderHub } from './pages/newsHub.mjs';
import { renderArticle } from './pages/article.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const STATIC = path.join(__dirname, 'static');
const REPO = path.join(__dirname, '..');

const NEWS_MAX_AGE_MS = 2 * 365 * 86400000; // 앱 BRAND_NEWS_MAX_AGE_MS와 동일
const RELATED_COUNT = 6;

const BUILD_LANGS = (process.env.SITE_LANGS || 'ko,en,vn')
  .split(',').map((s) => s.trim()).filter((l) => LANGS.includes(l));
setBuiltLangs(BUILD_LANGS);

// ── 파일 유틸 ────────────────────────────────────────────────
async function writePage(urlPath, html) {
  // urlPath는 localizedPath() 결과 (항상 '/'로 시작, 루트 외에는 trailing slash).
  //   '/'            → dist/index.html
  //   '/news/'       → dist/news/index.html
  //   '/en/news/x/'  → dist/en/news/x/index.html
  const rel = urlPath === '/'
    ? 'index.html'
    : urlPath.replace(/^\/+/, '').replace(/\/+$/, '') + '/index.html';
  const target = path.join(DIST, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, html, 'utf8');
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function copyIfExists(src, dest) {
  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') { console.warn(`  (skip, 없음: ${path.relative(REPO, src)})`); return false; }
    throw e;
  }
}

// ── 데이터 준비 ──────────────────────────────────────────────
function withinMaxAge(d) {
  const t = d.publishedAt instanceof Date ? d.publishedAt.getTime() : 0;
  return t >= Date.now() - NEWS_MAX_AGE_MS;
}

function relatedFor(doc, all) {
  const pool = all.filter((d) => d.id !== doc.id);
  const sameBrand = doc.brand ? pool.filter((d) => d.brand === doc.brand) : [];
  const sameCat = pool.filter((d) => d.category === doc.category && d.brand !== doc.brand);
  const seen = new Set();
  const out = [];
  for (const d of [...sameBrand, ...sameCat, ...pool]) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push(d);
    if (out.length >= RELATED_COUNT) break;
  }
  return out;
}

// ── 사이트맵 / RSS / robots ──────────────────────────────────
function sitemapXml(urls) {
  const body = urls.map((u) => `  <url>
    <loc>${esc(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq || 'weekly'}</changefreq>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>\n`;
}

function rssXml(news, lang) {
  const t = STRINGS[lang];
  const items = news.slice(0, 50).map((d) => {
    const title = (d.title && (d.title[lang] || d.title.en || d.title.ko)) || '';
    const desc = (d.summary && (d.summary[lang] || d.summary.en || d.summary.ko)) || '';
    const link = absUrl(`/news/${articleSlug(d)}`, lang);
    const pub = d.publishedAt instanceof Date ? d.publishedAt.toUTCString() : new Date().toUTCString();
    return `  <item>
    <title>${esc(title)}</title>
    <link>${esc(link)}</link>
    <guid isPermaLink="true">${esc(link)}</guid>
    <pubDate>${pub}</pubDate>
    <description>${esc(desc)}</description>
  </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Ridemate — ${esc(t.newsTitle)}</title>
  <link>${esc(absUrl('/news', lang))}</link>
  <description>${esc(t.metaNewsDesc)}</description>
  <language>${{ ko: 'ko', en: 'en', vn: 'vi' }[lang]}</language>
${items}
</channel>
</rss>\n`;
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="#0c0c0d"/>
<text x="32" y="45" font-family="Arial Black, Arial, sans-serif" font-size="40" font-weight="900" fill="#e8a020" text-anchor="middle">R</text>
</svg>\n`;

// ── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log(`[build] 언어: ${BUILD_LANGS.join(', ')}`);

  // dist 자체는 지우지 않는다 (로컬 프리뷰 서버가 이 폴더를 잡고 있으면
  // Windows에서 rmdir이 EBUSY로 실패) — 내용물만 비운다.
  await fs.mkdir(DIST, { recursive: true });
  for (const entry of await fs.readdir(DIST)) {
    await fs.rm(path.join(DIST, entry), { recursive: true, force: true });
  }
  await fs.mkdir(path.join(DIST, 'assets'), { recursive: true });

  // 1) 데이터
  console.log('[build] brand_news 로드 중...');
  const raw = await fetchCollection('brand_news', { orderBy: 'publishedAt desc' });
  const news = raw.filter(withinMaxAge);
  console.log(`[build] 소식 ${news.length}건 (전체 ${raw.length}, 2년 필터)`);

  // 브랜드: 등장 건수 내림차순
  const brandCount = new Map();
  for (const d of news) if (d.brand) brandCount.set(d.brand, (brandCount.get(d.brand) || 0) + 1);
  const brandsPresent = [...brandCount.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);

  const byCategory = new Map(CATEGORY_ORDER.map((c) => [c, []]));
  for (const d of news) if (byCategory.has(d.category)) byCategory.get(d.category).push(d);

  const byBrand = new Map(brandsPresent.map((b) => [b, []]));
  for (const d of news) if (d.brand && byBrand.has(d.brand)) byBrand.get(d.brand).push(d);

  // 2) 정적 자산 먼저 복사 (페이지 렌더링이 어떤 이미지가 있는지 알아야 하므로)
  console.log('[build] 정적 자산 복사...');
  await copyDir(STATIC, path.join(DIST, 'assets')).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    console.warn('  (static/ 없음)');
  });
  await fs.writeFile(path.join(DIST, 'assets', 'favicon.svg'), FAVICON_SVG, 'utf8');

  // 앱 스크린샷 기본값 (한국어 앱 화면). site/static/shot-*-<lang>.png 가 있으면
  // 그 언어에서는 그걸 우선 사용 (static/ 통째 복사로 이미 dist/assets 에 들어와 있음).
  const shotMap = [
    ['www/assets/onboarding/slide2_start.png', 'shot-home.png'],
    ['www/assets/onboarding/slide1_consumables.png', 'shot-consumables.png'],
    ['www/assets/onboarding/slide3_sos.png', 'shot-sos.png'],
  ];
  for (const [src, name] of shotMap) {
    // static/ 에 같은 이름(shot-home.png 등)을 넣어 기본값 자체를 덮어쓸 수도 있음
    const dest = path.join(DIST, 'assets', name);
    try { await fs.access(dest); } catch { await copyIfExists(path.join(REPO, src), dest); }
  }
  await copyIfExists(path.join(REPO, 'landing/icon.png'), path.join(DIST, 'assets', 'icon.png'));
  await copyIfExists(path.join(REPO, 'landing/icon.png'), path.join(DIST, 'icon.png'));
  if (!(await copyIfExists(path.join(STATIC, 'og-default.png'), path.join(DIST, 'assets', 'og-default.png')))) {
    await copyIfExists(path.join(REPO, 'landing/helmet.png'), path.join(DIST, 'assets', 'og-default.png'));
  }
  await QRCode.toFile(path.join(DIST, 'assets', 'qr-play.png'), PLAY_URL, {
    margin: 1, width: 264, color: { dark: '#0c0c0d', light: '#ffffff' },
  });
  await copyIfExists(path.join(REPO, 'landing/privacy_policy.html'), path.join(DIST, 'privacy_policy.html'));
  await copyIfExists(path.join(REPO, 'landing/terms_of_service.html'), path.join(DIST, 'terms_of_service.html'));

  // dist/assets 파일 목록 → 언어별 스크린샷 해석
  const assetFiles = new Set(await fs.readdir(path.join(DIST, 'assets')));
  // 언어별 스크린샷 구성. 새 언어 이미지를 넣으려면
  // site/static/shot-<key>-<lang>.png 추가 후 여기 배열만 조정.
  const SHOT_LAYOUT = { ko: ['home', 'consumables', 'sos'], en: ['home', 'consumables', 'sos'], vn: ['home', 'consumables', 'sos'] };
  const resolveShots = (lang) => {
    const t = STRINGS[lang];
    return (SHOT_LAYOUT[lang] || SHOT_LAYOUT.ko).map((key) => {
      const localized = `shot-${key}-${lang}.png`;
      const base = `shot-${key}.png`;
      const file = assetFiles.has(localized) ? localized : assetFiles.has(base) ? base : null;
      return file ? { src: `/assets/${file}`, alt: t.shotCaptions[key] } : null;
    }).filter(Boolean);
  };

  // 3) 페이지 생성
  const sitemapUrls = [];
  for (const lang of BUILD_LANGS) {
    const t = STRINGS[lang];

    await writePage(localizedPath('/', lang), renderHome({ lang, t, latestNews: news, shots: resolveShots(lang) }));
    sitemapUrls.push({ loc: absUrl('/', lang), changefreq: 'daily' });

    await writePage(localizedPath('/news', lang), renderNewsIndex({ lang, t, news, brandsPresent }));
    sitemapUrls.push({ loc: absUrl('/news', lang), changefreq: 'daily' });

    for (const c of CATEGORY_ORDER) {
      const items = byCategory.get(c) || [];
      await writePage(localizedPath(`/news/${c}`, lang), renderHub({
        lang, t, kind: 'category', key: c,
        heading: CATEGORY_LABEL[lang][c],
        intro: t.hubIntro[c],
        items,
        allBrands: brandsPresent,
      }));
    }

    for (const b of brandsPresent) {
      const items = byBrand.get(b) || [];
      const name = brandLabel(b, lang);
      await writePage(localizedPath(`/news/brand/${brandSlug(b)}`, lang), renderHub({
        lang, t, kind: 'brand', key: b,
        heading: name,
        intro: t.brandHubIntro(name),
        items,
        allBrands: brandsPresent,
      }));
    }

    for (const d of news) {
      const rel = relatedFor(d, news);
      await writePage(localizedPath(`/news/${articleSlug(d)}`, lang),
        renderArticle({ lang, t, doc: d, related: rel }));
      sitemapUrls.push({
        loc: absUrl(`/news/${articleSlug(d)}`, lang),
        lastmod: isoDate(d.collectedAt instanceof Date ? d.collectedAt : d.publishedAt),
      });
    }

    // 카테고리/브랜드 허브도 사이트맵에
    for (const c of CATEGORY_ORDER) sitemapUrls.push({ loc: absUrl(`/news/${c}`, lang) });
    for (const b of brandsPresent) sitemapUrls.push({ loc: absUrl(`/news/brand/${brandSlug(b)}`, lang) });

    // RSS: 대표 언어(첫 번째)만 /rss.xml, 나머지는 /{lang}/rss.xml
    const rssPath = lang === BUILD_LANGS[0] ? path.join(DIST, 'rss.xml') : path.join(DIST, lang, 'rss.xml');
    await fs.mkdir(path.dirname(rssPath), { recursive: true });
    await fs.writeFile(rssPath, rssXml(news, lang), 'utf8');
  }

  // 4) sitemap / robots
  await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemapXml(sitemapUrls), 'utf8');
  await fs.writeFile(path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, 'utf8');

  // 5) 404
  await fs.writeFile(path.join(DIST, '404.html'),
    `<!DOCTYPE html><meta charset=utf-8><title>404 — Ridemate</title>` +
    `<meta http-equiv=refresh content="3;url=/"><body style="font-family:sans-serif;background:#0c0c0d;color:#e8ecf0;text-align:center;padding:80px 20px"><h1>404</h1><p><a style="color:#e8a020" href="/">Ridemate</a></p>`, 'utf8');

  const pageCount = sitemapUrls.length;
  console.log(`[build] 완료 — ${pageCount} URL, dist/ 생성`);
}

main().catch((e) => { console.error(e); process.exit(1); });
