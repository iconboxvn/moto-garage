import { layout, esc, localizedPath, absUrl, SITE_ORIGIN } from '../lib/render.mjs';
import { articleCard } from '../lib/components.mjs';
import { brandSlug } from '../lib/slug.mjs';
import { CATEGORY_ORDER, CATEGORY_LABEL, brandLabel } from '../content/strings.mjs';

/** collectedAt 기준 그룹 정보 — 앱 _brandNewsCollectedGroupInfo() 재현 */
function collectedGroup(d, t) {
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  if (!(d instanceof Date) || isNaN(d)) return { key: 'unknown', sortTime: 0, label: '—' };
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const key = d.toISOString().slice(0, 10);
  const label = diffDays === 0 ? t.collectedToday
    : diffDays === 1 ? t.collectedYesterday
    : t.collectedOn(d.getMonth() + 1, d.getDate());
  return { key, sortTime: startOfDay(d), label };
}

export function renderNewsIndex({ lang, t, news, brandsPresent }) {
  const chips = [
    `<span class="chip is-active">${esc(t.catAll)}</span>`,
    ...CATEGORY_ORDER.map((c) => {
      const label = CATEGORY_LABEL[lang][c];
      return `<a class="chip" href="${esc(localizedPath(`/news/${c}`, lang))}">${esc(label)}</a>`;
    }),
  ].join('\n');

  // 수집일 그룹핑
  const groups = new Map();
  for (const d of news) {
    const g = collectedGroup(d.collectedAt, t);
    if (!groups.has(g.key)) groups.set(g.key, { ...g, items: [] });
    groups.get(g.key).items.push(d);
  }
  const groupHtml = [...groups.values()]
    .sort((a, b) => b.sortTime - a.sortTime)
    .map((g) => `<section class="news-group">
    <h2 class="group-label">${esc(g.label)}</h2>
    <div class="news-grid">
${g.items.map((d) => articleCard(d, lang, t)).join('\n')}
    </div>
  </section>`).join('\n');

  const brandList = brandsPresent
    .map((b) => `<a class="brand-pill" href="${esc(localizedPath(`/news/brand/${brandSlug(b)}`, lang))}">${esc(brandLabel(b, lang))}</a>`)
    .join('\n');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Ridemate — ${t.newsTitle}`,
    url: absUrl('/news', lang),
    description: t.metaNewsDesc,
  });

  const body = `
<section class="page-head">
  <div class="wrap">
    <h1>${esc(t.newsTitle)}</h1>
    <p class="page-lede">${esc(t.metaNewsDesc)}</p>
    <div class="chip-row">
${chips}
    </div>
  </div>
</section>

<div class="wrap news-layout">
  <div class="news-main">
${groupHtml || `<p class="empty">${esc(t.emptyCategory)}</p>`}
  </div>
  <aside class="news-side">
    <h2>${esc(t.byBrand)}</h2>
    <div class="brand-pills">
${brandList}
    </div>
  </aside>
</div>
`;

  return layout({
    lang, t, path: '/news', activeNav: 'news',
    title: `${t.newsTitle} — Ridemate`,
    description: t.metaNewsDesc,
    ogImage: SITE_ORIGIN + '/assets/og-default.png',
    jsonLd,
    body,
  });
}
