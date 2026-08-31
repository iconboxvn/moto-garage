/**
 * Firestore 공개 REST 읽기.
 *
 * brand_news / fuel_prices 컬렉션은 보안규칙상 `allow read: if true` 이므로
 * 서비스 계정 없이 공개 REST API로 읽는다 (firestore.rules 참고).
 * GitHub Actions 빌드에서 별도 자격증명이 필요 없는 이유.
 */

const PROJECT_ID = 'moto-garage-8da30';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/** REST 값 1개 → 평범한 JS 값 */
function decodeValue(v) {
  if (v == null) return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

/**
 * 컬렉션 전체를 페이지네이션하며 가져온다.
 * @param {string} collectionId
 * @param {{orderBy?: string, pageSize?: number, maxDocs?: number}} opts
 * @returns {Promise<Array<{id: string} & Record<string, any>>>}
 */
export async function fetchCollection(collectionId, opts = {}) {
  const { orderBy = 'publishedAt desc', pageSize = 300, maxDocs = 5000 } = opts;
  const results = [];
  let pageToken = null;

  do {
    const url = new URL(`${BASE}/${collectionId}`);
    url.searchParams.set('pageSize', String(pageSize));
    if (orderBy) url.searchParams.set('orderBy', orderBy);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      throw new Error(`Firestore REST ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = await res.json();
    for (const doc of data.documents || []) {
      const id = doc.name.split('/').pop();
      results.push({ id, ...decodeFields(doc.fields || {}) });
      if (results.length >= maxDocs) return results;
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return results;
}
