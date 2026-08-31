import { layout, esc, localizedPath, absUrl, SITE_ORIGIN } from '../lib/render.mjs';
import { articleCard } from '../lib/components.mjs';
import { brandSlug } from '../lib/slug.mjs';
import { CATEGORY_ORDER, CATEGORY_LABEL, brandLabel } from '../content/strings.mjs';
/* kind: 'category' | 'brand' */

/**
 * @param {'category'|'brand'} kind
 * @param {string} key        카테고리 키 또는 브랜드 키
 * @param {string} heading
 * @param {string} intro
 * @param {Array} items       발행일 내림차순 정렬된 문서들
 */
export function renderHub({ lang, t, kind, key, heading, intro, items, allBrands }) {
  const path = kind === 'category' ? `/news/${key}` : `/news/brand/${brandSlug(key)}`;

  const catChips = [
    `<a class="chip" href="${esc(localizedPath('/news', lang))}">${esc(t.catAll)}</a>`,
    ...CATEGORY_ORDER.map((c) => {
      const active = kind === 'category' && c === key;
      return `<a class="chip${active ? ' is-active' : ''}" href="${esc(localizedPath(`/news/${c}`, lang))}">${esc(CATEGORY_LABEL[lang][c])}</a>`;
    }),
  ].join('\n');

  const cards = items.length
    ? `<div class="news-grid">${items.map((d) => articleCard(d, lang, t)).join('\n')}</div>`
    : `<p class="empty">${esc(t.emptyCategory)}</p>`;

  const brandNav = (allBrands || []).length
    ? `<aside class="news-side">
    <h2>${esc(t.byBrand)}</h2>
    <div class="brand-pills">
${allBrands.map((b) => {
      const active = kind === 'brand' && b === key;
      return `<a class="brand-pill${active ? ' is-active' : ''}" href="${esc(localizedPath(`/news/brand/${brandSlug(b)}`, lang))}">${esc(brandLabel(b, lang))}</a>`;
    }).join('\n')}
    </div>
  </aside>`
    : '';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${heading} — Ridemate`,
    url: absUrl(path, lang),
    description: intro,
    hasPart: items.slice(0, 20).map((d) => ({
      '@type': 'NewsArticle',
      headline: (d.title && (d.title[lang] || d.title.en)) || '',
      datePublished: d.publishedAt instanceof Date ? d.publishedAt.toISOString() : undefined,
    })),
  });

  const body = `
<section class="page-head">
  <div class="wrap">
    <nav class="crumbs"><a href="${esc(localizedPath('/news', lang))}">${esc(t.newsTitle)}</a> <span>/</span> ${esc(heading)}</nav>
    <h1>${esc(heading)}</h1>
    <p class="page-lede">${esc(intro)}</p>
    <p class="count">${esc(t.catCount(items.length))}</p>
    <div class="chip-row">
${catChips}
    </div>
  </div>
</section>

<div class="wrap news-layout">
  <div class="news-main">
    ${cards}
  </div>
  ${brandNav}
</div>
`;

  return layout({
    lang, t, path, activeNav: 'news',
    title: `${heading} — Ridemate ${t.newsTitle}`,
    description: intro,
    ogImage: SITE_ORIGIN + '/assets/og-default.png',
    jsonLd,
    body,
  });
}
