import { layout, esc, localizedPath, absUrl, SITE_ORIGIN, PLAY_URL } from '../lib/render.mjs';
import { articleCard, downloadCta } from '../lib/components.mjs';

const SHOTS = [
  { src: '/assets/shot-home.png', ko: '홈 화면 — 소모품 상태·유가·최근 정비', en: 'Home — service status, fuel price, recent maintenance', vn: 'Trang chủ — trạng thái bảo dưỡng, giá xăng' },
  { src: '/assets/shot-consumables.png', ko: '소모품별 교체 주기와 잔여 거리', en: 'Replacement interval and remaining distance per part', vn: 'Chu kỳ thay thế và số km còn lại' },
  { src: '/assets/shot-sos.png', ko: '긴급 SOS — 베트남 긴급번호와 통역 연결', en: 'Emergency SOS — Vietnam hotlines and interpreter', vn: 'SOS khẩn cấp — số nóng Việt Nam và phiên dịch' },
];

export function renderHome({ lang, t, latestNews }) {
  const shotAlt = (s) => s[lang] || s.en;

  const features = t.features.map(
    (f) => `<li class="feature">
    <h3>${esc(f.t)}</h3>
    <p>${esc(f.d)}</p>
  </li>`
  ).join('\n');

  const shots = SHOTS.map(
    (s, i) => `<figure class="shot">
    <img src="${esc(s.src)}" alt="${esc(shotAlt(s))}" loading="${i === 0 ? 'eager' : 'lazy'}" width="300" height="650">
    <figcaption>${esc(shotAlt(s))}</figcaption>
  </figure>`
  ).join('\n');

  const newsCards = latestNews.slice(0, 6).map((d) => articleCard(d, lang, t)).join('\n');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'Ridemate',
    operatingSystem: 'Android',
    applicationCategory: 'AutoAndVehiclesApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    url: absUrl('/', lang),
    downloadUrl: PLAY_URL,
    description: t.metaHomeDesc,
  });

  const body = `
<section class="hero">
  <div class="wrap hero-inner">
    <div class="hero-copy">
      <p class="kicker">${esc(t.heroKicker)}</p>
      <h1>${t.heroTitle}</h1>
      <p class="hero-sub">${esc(t.heroSub)}</p>
      ${downloadCta(t, { withQr: true, variant: 'hero' })}
      <a class="link-arrow" href="${esc(localizedPath('/news', lang))}">${esc(t.heroCtaNews)} →</a>
    </div>
    <div class="hero-shot">
      <img src="/assets/shot-home.png" alt="${esc(shotAlt(SHOTS[0]))}" width="320" height="693" fetchpriority="high">
    </div>
  </div>
</section>

<section class="section features">
  <div class="wrap">
    <h2>${esc(t.featuresTitle)}</h2>
    <ul class="feature-grid">
${features}
    </ul>
  </div>
</section>

<section class="section shots-section">
  <div class="wrap">
    <div class="shots-row">
${shots}
    </div>
  </div>
</section>

<section class="section home-news">
  <div class="wrap">
    <div class="section-head">
      <h2>${esc(t.newsPreviewTitle)}</h2>
      <a class="link-arrow" href="${esc(localizedPath('/news', lang))}">${esc(t.newsPreviewMore)} →</a>
    </div>
    <div class="news-grid">
${newsCards}
    </div>
  </div>
</section>

<section class="section ridemesh">
  <div class="wrap ridemesh-inner">
    <span class="badge">${esc(t.ridemeshBadge)}</span>
    <h2>${esc(t.ridemeshTitle)}</h2>
    <p>${esc(t.ridemeshBody)}</p>
  </div>
</section>

<section class="section bottom-cta">
  <div class="wrap bottom-cta-inner">
    <h2>${esc(t.bottomCtaTitle)}</h2>
    <p>${esc(t.bottomCtaSub)}</p>
    ${downloadCta(t, { withQr: false, variant: 'bottom' })}
  </div>
</section>
`;

  return layout({
    lang, t, path: '/', activeNav: 'home',
    title: t.metaHomeTitle,
    description: t.metaHomeDesc,
    ogImage: SITE_ORIGIN + '/assets/og-default.png',
    jsonLd,
    body,
  });
}
