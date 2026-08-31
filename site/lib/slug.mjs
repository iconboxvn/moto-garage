/**
 * 소식 제목 → URL 슬러그.
 *
 * 베트남 모델명(NVX, Exciter 등)과 영문 제목이 섞여 있으므로 en 제목 우선,
 * 없으면 ko. 비ASCII는 제거하고, 최종적으로 문서 id 앞 6자를 붙여 유일성을 보장한다
 * (제목이 같거나 슬러그가 비어도 충돌하지 않도록).
 */
const COMBINING_MARKS = /[̀-ͯ]/g;

export function articleSlug(doc) {
  const base = (doc.title && (doc.title.en || doc.title.ko || doc.title.vn)) || '';
  const cleaned = base
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '') // Việt → Viet
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/g, '');
  const id6 = String(doc.id).slice(0, 6).toLowerCase();
  return cleaned ? `${cleaned}-${id6}` : `news-${id6}`;
}

/** 브랜드 키 → URL 세그먼트 (그대로 쓰되 안전하게) */
export function brandSlug(brand) {
  return String(brand || '').replace(/[^a-z0-9_]/gi, '').toLowerCase();
}
