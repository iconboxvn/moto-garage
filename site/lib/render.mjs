/**
 * 공통 렌더링: HTML 이스케이프, URL 로컬라이즈, 페이지 레이아웃(head/헤더/푸터).
 */

export const SITE_ORIGIN = 'https://ridemate.iconbox.com';
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.iconbox.motogarage';
export const LANGS = ['ko', 'en', 'vn'];
export const HREFLANG = { ko: 'ko', en: 'en', vn: 'vi' };

// build.mjs가 실제로 생성하는 언어만 담는다 (Phase 1은 ['ko']).
// hreflang / 언어 스위처가 존재하지 않는 언어를 가리키지 않도록.
export let BUILT_LANGS = [...LANGS];
export function setBuiltLangs(langs) {
  BUILT_LANGS = langs.filter((l) => LANGS.includes(l));
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 논리 경로(항상 '/'로 시작, 언어 무관)를 특정 언어 URL로 변환. ko는 루트. */
export function localizedPath(path, lang) {
  const p = path === '/' ? '/' : path.replace(/\/+$/, '') + '/';
  if (lang === 'ko') return p;
  return p === '/' ? `/${lang}/` : `/${lang}${p}`;
}

export function absUrl(path, lang) {
  return SITE_ORIGIN + localizedPath(path, lang);
}

/** 앱 날짜 표기: 2026.08.28 */
export function fmtDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO(YYYY-MM-DD) — sitemap/JSON-LD용 */
export function isoDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  return d.toISOString().slice(0, 10);
}

function hreflangLinks(path) {
  if (BUILT_LANGS.length < 2) return ''; // 단일 언어 빌드면 hreflang 무의미
  const links = BUILT_LANGS.map(
    (l) => `<link rel="alternate" hreflang="${HREFLANG[l]}" href="${esc(absUrl(path, l))}">`
  );
  const xdef = BUILT_LANGS.includes('ko') ? 'ko' : BUILT_LANGS[0];
  links.push(`<link rel="alternate" hreflang="x-default" href="${esc(absUrl(path, xdef))}">`);
  return links.join('\n');
}

/**
 * @param {object} o
 * @param {string} o.lang
 * @param {string} o.path        논리 경로 (언어 무관, '/'로 시작)
 * @param {string} o.title
 * @param {string} o.description
 * @param {string} [o.ogImage]   절대 URL
 * @param {string} [o.ogType]
 * @param {string} [o.jsonLd]    <script type=application/ld+json> 안에 들어갈 문자열
 * @param {string} [o.headExtra]
 * @param {string} o.body        <main> 안쪽 내용
 * @param {object} o.t           strings[lang]
 * @param {string} [o.activeNav] 'home' | 'news'
 */
export function layout(o) {
  const { lang, path, title, description, body, t } = o;
  const ogImage = o.ogImage || SITE_ORIGIN + '/assets/og-default.png';
  const canonical = absUrl(path, lang);
  const navUrl = (p) => esc(localizedPath(p, lang));

  const langSwitch = (BUILT_LANGS.length > 1 ? BUILT_LANGS : []).map((l) => {
    const label = { ko: 'KO', en: 'EN', vn: 'VN' }[l];
    const cls = l === lang ? 'lang-link active' : 'lang-link';
    return `<a class="${cls}" href="${esc(localizedPath(path, l))}" hreflang="${HREFLANG[l]}">${label}</a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="${HREFLANG[lang]}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${hreflangLinks(path)}
<meta property="og:site_name" content="Ridemate">
<meta property="og:type" content="${esc(o.ogType || 'website')}">
<meta property="og:title" content="${esc(o.ogTitle || title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="${lang === 'ko' ? 'ko_KR' : lang === 'vn' ? 'vi_VN' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0c0c0d">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
<link rel="alternate" type="application/rss+xml" title="Ridemate ${esc(t.newsTitle)}" href="${esc(SITE_ORIGIN)}/rss.xml">
${o.jsonLd ? `<script type="application/ld+json">${o.jsonLd}</script>` : ''}
${o.headExtra || ''}
</head>
<body>
<a class="skip-link" href="#main">${esc(t.skipToContent)}</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${navUrl('/')}">
      <span class="brand-main">RIDEMATE</span>
      <span class="brand-sub">VEHICLE MANAGEMENT</span>
    </a>
    <nav class="site-nav" aria-label="${esc(t.navLabel)}">
      <a href="${navUrl('/')}"${o.activeNav === 'home' ? ' aria-current="page"' : ''}>${esc(t.navHome)}</a>
      <a href="${navUrl('/news')}"${o.activeNav === 'news' ? ' aria-current="page"' : ''}>${esc(t.navNews)}</a>
      <a class="nav-cta" href="${esc(PLAY_URL)}" target="_blank" rel="noopener">${esc(t.navDownload)}</a>
    </nav>
    <div class="lang-switch" aria-label="Language">${langSwitch}</div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <div class="footer-brand">
      <span class="brand-main">RIDEMATE</span>
      <p>${esc(t.footerTagline)}</p>
    </div>
    <nav class="footer-links" aria-label="${esc(t.footerNavLabel)}">
      <a href="${navUrl('/')}">${esc(t.navHome)}</a>
      <a href="${navUrl('/news')}">${esc(t.navNews)}</a>
      <a href="/privacy_policy">${esc(t.privacy)}</a>
      <a href="/terms_of_service">${esc(t.terms)}</a>
      <a href="${esc(PLAY_URL)}" target="_blank" rel="noopener">Google Play</a>
    </nav>
  </div>
  <div class="wrap footer-legal">
    <span>© ${new Date().getFullYear()} iconbox. All rights reserved.</span>
    <span>${esc(t.madeBy)} <a href="https://iconbox.com" target="_blank" rel="noopener">iconbox.com</a></span>
  </div>
</footer>
</body>
</html>`;
}
