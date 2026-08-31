import { layout, esc, localizedPath, absUrl, SITE_ORIGIN, fmtDate } from '../lib/render.mjs';
import { articleCard, categoryBadge, downloadCta } from '../lib/components.mjs';
import { articleSlug, brandSlug } from '../lib/slug.mjs';
import { displaySourceName } from '../lib/sourceName.mjs';
import { CATEGORY_LABEL, brandLabel } from '../content/strings.mjs';

export function renderArticle({ lang, t, doc, related }) {
  const path = `/news/${articleSlug(doc)}`;
  const title = (doc.title && (doc.title[lang] || doc.title.en || doc.title.ko)) || '';
  const summary = (doc.summary && (doc.summary[lang] || doc.summary.en || doc.summary.ko)) || '';
  const catLabel = CATEGORY_LABEL[lang][doc.category] || doc.category;
  const isSafety = doc.category === 'safety';
  const brand = doc.brand;

  const crumbs = [
    `<a href="${esc(localizedPath('/news', lang))}">${esc(t.newsTitle)}</a>`,
    `<a href="${esc(localizedPath(`/news/${doc.category}`, lang))}">${esc(catLabel)}</a>`,
  ];
  if (brand) crumbs.push(`<a href="${esc(localizedPath(`/news/brand/${brandSlug(brand)}`, lang))}">${esc(brandLabel(brand, lang))}</a>`);

  const vnWarn = doc.vnConfirmed === false
    ? `<div class="notice notice-warn">⚠ ${esc(t.vnUnconfirmed)}</div>` : '';

  const relatedHtml = related.length
    ? `<section class="section related">
    <div class="wrap">
      <h2>${esc(t.relatedTitle)}</h2>
      <div class="news-grid">
${related.map((d) => articleCard(d, lang, t)).join('\n')}
      </div>
    </div>
  </section>`
    : '';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description: summary,
    datePublished: doc.publishedAt instanceof Date ? doc.publishedAt.toISOString() : undefined,
    inLanguage: { ko: 'ko', en: 'en', vn: 'vi' }[lang],
    isBasedOn: doc.sourceUrl || undefined,
    publisher: { '@type': 'Organization', name: 'Ridemate', url: SITE_ORIGIN },
    mainEntityOfPage: absUrl(path, lang),
    about: brand ? brandLabel(brand, lang) : undefined,
  });

  const body = `
<article class="article">
  <div class="wrap article-inner">
    <nav class="crumbs">${crumbs.join(' <span>/</span> ')}</nav>
    <div class="article-meta">
      ${categoryBadge(doc.category, lang)}
      <time datetime="${doc.publishedAt instanceof Date ? doc.publishedAt.toISOString().slice(0, 10) : ''}">${esc(t.publishedOn)} ${esc(fmtDate(doc.publishedAt))}</time>
    </div>
    <h1${isSafety ? ' class="safety-title"' : ''}>${esc(title)}</h1>
    ${vnWarn}
    <div class="article-body">
      <p>${esc(summary)}</p>
    </div>
    <div class="article-source">
      <span>${esc(t.source)}: ${esc(displaySourceName(doc.sourceName, lang))}</span>
      ${doc.sourceUrl ? `<a href="${esc(doc.sourceUrl)}" target="_blank" rel="nofollow noopener">${esc(t.readOriginal)} ↗</a>` : ''}
    </div>
    <div class="article-cta">
      ${downloadCta(t, { withQr: false, variant: 'article' })}
    </div>
  </div>
</article>
${relatedHtml}
`;

  return layout({
    lang, t, path, activeNav: 'news',
    title: `${title} — Ridemate`,
    ogTitle: title,
    description: summary.slice(0, 200) || title,
    ogType: 'article',
    ogImage: SITE_ORIGIN + '/assets/og-default.png',
    jsonLd,
    body,
  });
}
