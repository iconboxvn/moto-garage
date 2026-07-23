/**
 * 브랜드 소식 소스 모듈 — EU Safety Gate(구 RAPEX) 리콜 API
 *
 * CLAUDE.md Tier 1 소스. BMW Motorrad/Ducati/KTM/Triumph는 베트남 판매 모델이라도
 * EU 인증 기준 데이터라 실제 베트남 차량과 100% 동일하다는 보장이 없다. NHTSA와
 * 같은 이유로 vnConfirmed:false 로 표시한다.
 *
 * 공식 문서화된 API가 아니라 Angular 프론트엔드가 쓰는 내부 API를 리버스엔지니어링해서
 * 쓴다(검색: POST /public/api/search, 상세: GET /public/api/notification/{id}).
 * 자유텍스트 검색(fullTextSearch)은 브랜드명과 무관한 항목도 같이 반환하는 걸 확인해서
 * (예: "Ducati" 검색에 장난감이 섞여나옴), 응답의 product.brands[] 배열을 다시
 * 브랜드명으로 검증한다.
 *
 * BMW는 EU에서 자동차도 같이 팔아서 브랜드명만으로 못 거른다. 처음엔 모터사이클
 * 서브브랜드 태그("BMW Motorrad")로 거르면 될 줄 알았는데, 실제로는 최신 항목 중에도
 * 오토바이가 그냥 "Bmw"로만 태그된 경우가 있어서(서브브랜드 표기가 항상 붙지 않음)
 * 신뢰할 수 없었다. 대신 product.name 필드가 "Passenger car" / "Motorcycle"처럼
 * 차종을 정확히 구분해주는 걸 확인해서, BMW는 이 필드로 오토바이 여부를 판단한다.
 * Ducati/KTM/Triumph는 EU에서 자동차를 안 팔아서 브랜드명 매치만으로 충분하다.
 *
 * 공통 인터페이스: fetch() -> [{title, url, publishedAt, rawText, brand, sourceTier, vnConfirmed}, ...]
 */

const SEARCH_URL = 'https://ec.europa.eu/safety-gate-alerts/public/api/search';
const DETAIL_API_BASE = 'https://ec.europa.eu/safety-gate-alerts/public/api/notification/';
const DETAIL_PAGE_BASE = 'https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SOURCE_TIER = 'official_global';

// 브랜드당 최근 N건만 (일일 배치라 이 정도면 충분하고, 상세 조회 요청 수도 억제됨).
const MAX_ITEMS_PER_BRAND = 15;

// BMW만 product.name(차종)까지 확인해서 자동차를 걸러낸다. 나머지 브랜드는 EU에서
// 오토바이만 팔아서 브랜드명 매치만으로 충분하고, product.name까지 강제하면 오히려
// "Motor vehicle part"(액세서리 리콜) 같은 정상 항목을 놓칠 수 있어 브랜드만 본다.
const MOTORCYCLE_NAME_RE = /motor.?cycle|motorbike/i;

const BRANDS = [
  { queryText: 'BMW', brand: 'bmw_motorrad', brandMatchRe: /bmw/i, requireMotorcycleName: true },
  { queryText: 'Ducati', brand: 'ducati', brandMatchRe: /ducati/i, requireMotorcycleName: false },
  { queryText: 'KTM', brand: 'ktm', brandMatchRe: /\bktm\b/i, requireMotorcycleName: false },
  { queryText: 'Triumph', brand: 'triumph', brandMatchRe: /triumph/i, requireMotorcycleName: false }
];

function buildSearchBody(queryText, size) {
  return {
    criteria: { fullTextSearch: queryText, productCategoryType: ['MOTOR_VEHICLES'] },
    searchCriteriaForNotification: false,
    isLaunched: true,
    pagination: { sortField: 'PUBLICATION_DATE', sortOrder: 'DESC', totalElements: 0, numberElements: size, page: 0 },
    searchResults: [],
    displayDefaultResults: false,
    displayTagsWithSelectedCriteria: [],
    isForMostRecent: false,
    isLaunchSearch: true,
    fullTextSearch: queryText,
    language: 'en'
  };
}

async function searchBrand(queryText, size) {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://ec.europa.eu',
      Referer: 'https://ec.europa.eu/safety-gate-alerts/screen/webReport',
      'User-Agent': USER_AGENT
    },
    body: JSON.stringify(buildSearchBody(queryText, size))
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for search "' + queryText + '"');
  const data = await res.json();
  return data.content || [];
}

async function fetchDetailText(id) {
  try {
    const res = await fetch(DETAIL_API_BASE + id + '?language=en', {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const riskDesc = data.risk && data.risk.versions && data.risk.versions.find((v) => v.language && v.language.key === 'EN');
    const productVer = data.product && data.product.versions && data.product.versions.find((v) => v.language && v.language.key === 'EN');
    // measureCategory 이름(예: PRODUCT_RECALL_FROM_CONSUMERS)이 실제 조치가 리콜인지
    // 알려주는 필드라 여기서 뽑아둔다 — 메인 파이프라인의 safety 키워드 재확인 로직이
    // "recall" 단어가 원문에 있는지로 보류 여부를 판단하는데, riskDescription만으로는
    // 이 단어가 거의 안 나와서(위험 설명일 뿐 조치 설명이 아님) 대부분 보류돼버리는
    // 문제가 있었다 — 실측(45건 중 44건 보류)으로 확인 후 이 필드를 추가함.
    const measures = ((data.measureTaken && data.measureTaken.measures) || [])
      .map((m) => [m.measureCategory && m.measureCategory.name, m.measureType && m.measureType.name].filter(Boolean).join(' '))
      .filter(Boolean);
    const parts = [
      productVer && productVer.description,
      riskDesc && riskDesc.riskDescription,
      riskDesc && riskDesc.legalProvision,
      measures.length ? 'Measures taken: ' + measures.join(', ') : null
    ].filter(Boolean);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.warn('[euSafetyGate] 상세 조회 실패:', id, e.message);
    return '';
  }
}

async function fetch_() {
  const results = [];
  for (const { queryText, brand, brandMatchRe, requireMotorcycleName } of BRANDS) {
    let items;
    try {
      items = await searchBrand(queryText, MAX_ITEMS_PER_BRAND);
    } catch (e) {
      console.warn('[euSafetyGate] 검색 실패:', queryText, e.message);
      continue;
    }

    const matched = items.filter((it) => {
      const brands = (it.product && it.product.brands) || [];
      const brandOk = brands.some((b) => brandMatchRe.test(b.brand || ''));
      if (!brandOk) return false;
      if (!requireMotorcycleName) return true;
      const productName = (it.product && it.product.name) || '';
      return MOTORCYCLE_NAME_RE.test(productName);
    });

    for (const it of matched) {
      const title = (it.product && (it.product.nameSpecific || it.product.name)) || it.reference;
      const rawText = await fetchDetailText(it.id);
      results.push({
        title: title + ' (' + it.reference + ')',
        url: DETAIL_PAGE_BASE + it.id,
        publishedAt: it.publicationDate ? new Date(it.publicationDate) : null,
        rawText: rawText || title,
        brand,
        sourceTier: SOURCE_TIER,
        vnConfirmed: false
      });
    }
  }
  return results;
}

module.exports = { fetch: fetch_ };
