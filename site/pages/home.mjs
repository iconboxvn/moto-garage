import { layout, esc, localizedPath, absUrl, SITE_ORIGIN, PLAY_URL } from '../lib/render.mjs';
import { articleCard, downloadCta } from '../lib/components.mjs';

/**
 * @param {Array<{src: string, alt: string}>} o.shots  build.mjs가 언어별로 해석해 넘김
 *   (첫 번째 항목이 히어로 이미지로도 쓰임)
 */
export function renderHome({ lang, t, latestNews, shots: shotList }) {
  const heroShot = shotList[0];

  const features = t.features.map(
    (f) => `<li class="feature">
    <h3>${esc(f.t)}</h3>
    <p>${esc(f.d)}</p>
  </li>`
  ).join('\n');

  const shots = shotList.map(
    (s, i) => `<figure class="shot">
    <img src="${esc(s.src)}" alt="${esc(s.alt)}" loading="${i === 0 ? 'eager' : 'lazy'}" width="300" height="650">
    <figcaption>${esc(s.alt)}</figcaption>
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
      <img src="${esc(heroShot.src)}" alt="${esc(heroShot.alt)}" width="320" height="693" fetchpriority="high">
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
