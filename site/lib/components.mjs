/**
 * 재사용 UI 조각: 소식 카드, 다운로드 CTA, 카테고리 배지.
 */
import { esc, localizedPath, fmtDate, PLAY_URL } from './render.mjs';
import { articleSlug } from './slug.mjs';
import { displaySourceName } from './sourceName.mjs';
import { CATEGORY_LABEL } from '../content/strings.mjs';

export function categoryBadge(category, lang) {
  const label = (CATEGORY_LABEL[lang] || CATEGORY_LABEL.en)[category] || category;
  return `<span class="cat-badge cat-${esc(category)}">${esc(label)}</span>`;
}

function truncate(s, n) {
  s = String(s || '').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/**
 * 소식 카드 (피드/허브/관련글 공용)
 * @param {object} doc  brand_news 문서 (id, title, summary, category, ...)
 */
export function articleCard(doc, lang, t) {
  const href = localizedPath(`/news/${articleSlug(doc)}`, lang);
  const title = (doc.title && (doc.title[lang] || doc.title.en || doc.title.ko)) || '';
  const summary = (doc.summary && (doc.summary[lang] || doc.summary.en || doc.summary.ko)) || '';
  const isSafety = doc.category === 'safety';
  const vnWarn = doc.vnConfirmed === false
    ? `<p class="card-warn">⚠ ${esc(t.vnUnconfirmed)}</p>` : '';
  return `<article class="news-card${isSafety ? ' is-safety' : ''}">
  <div class="card-meta">
    ${categoryBadge(doc.category, lang)}
    <time datetime="${doc.publishedAt instanceof Date ? doc.publishedAt.toISOString().slice(0, 10) : ''}">${esc(fmtDate(doc.publishedAt))}</time>
  </div>
  <h3 class="card-title"><a href="${esc(href)}">${esc(title)}</a></h3>
  ${vnWarn}
  <p class="card-summary">${esc(truncate(summary, 180))}</p>
  <div class="card-source">${esc(displaySourceName(doc.sourceName, lang))}</div>
</article>`;
}

/**
 * 다운로드 CTA. withQr=true면 데스크톱에서 QR 노출.
 */
export function downloadCta(t, { withQr = false, variant = 'default' } = {}) {
  const qr = withQr
    ? `<figure class="qr-box">
    <img src="/assets/qr-play.png" width="132" height="132" alt="Google Play QR" loading="lazy">
    <figcaption>${esc(t.qrCaption)}</figcaption>
  </figure>`
    : '';
  return `<div class="cta-group cta-${esc(variant)}">
  <a class="btn btn-play" href="${esc(PLAY_URL)}" target="_blank" rel="noopener">
    <span class="btn-play-sub">Google Play</span>
    <span class="btn-play-main">${esc(t.heroCtaPrimary)}</span>
  </a>
  ${qr}
</div>`;
}
