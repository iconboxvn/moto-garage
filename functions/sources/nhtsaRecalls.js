/**
 * 브랜드 소식 소스 모듈 — NHTSA(미국 도로교통안전국) 리콜 API
 *
 * 스크래핑이 아니라 미국 정부 공식 API(api.nhtsa.gov). 브랜드만으로는 조회가 안 되고
 * (모델+연식) 조합이 필요해서, 연식별로 "그 해에 실제 리콜이 있었던 모델" 목록을 먼저
 * 받아온 뒤(issueType=r), 그 모델들만 다시 리콜 상세로 조회하는 2단계 방식이다.
 *
 * 미국 시장 기준 데이터라 베트남 전용 모델(예: 동남아 사양)은 커버되지 않고, 베트남
 * 판매 차량에 실제로 적용되는지도 확인되지 않은 정보다. 그래서 모든 항목을
 * vnConfirmed:false로 표시해서, 메인 파이프라인/앱에서 "해외에서만 확인됨" 문구를
 * 붙일 수 있게 한다.
 *
 * 공통 인터페이스: fetch() -> [{title, url, publishedAt, rawText, brand, sourceTier, vnConfirmed}, ...]
 */

const SOURCE_TIER = 'official_global';
const YEARS_BACK = 3; // 최근 N개년만 조회 (그보다 오래된 연식은 매일 새로 안 늘어남)

const BRANDS = [
  { make: 'SUZUKI', brand: 'suzuki' },
  { make: 'KAWASAKI', brand: 'kawasaki' },
  { make: 'DUCATI', brand: 'ducati' },
  { make: 'KTM', brand: 'ktm' },
  { make: 'TRIUMPH', brand: 'triumph' },
  { make: 'BMW', brand: 'bmw_motorrad' }
];

// BMW는 NHTSA에 자동차와 모터사이클이 한 브랜드로 섞여있다. BMW 모터사이클 모델명은
// 보통 "R 1300 GS", "S 1000 RR"처럼 [문자][공백][3~4자리 숫자]로 시작해서 이 패턴으로
// 걸러낸다 (자동차 모델명 "X5", "330I", "M3" 등은 이 패턴에 안 걸림). 완벽하진 않은
// 휴리스틱이라 오탐이 있으면 나중에 다듬을 것.
const BMW_MOTORCYCLE_RE = /^[A-Z]\s?\d{3,4}/;

function isMotorcycleModel(make, model) {
  if (make !== 'BMW') return true;
  return BMW_MOTORCYCLE_RE.test(model);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// NHTSA API가 짧은 시간에 요청이 몰리면 400을 돌려주는 걸 확인함(레이트 리밋으로 추정 —
// 같은 요청도 단독으로 보내면 200이 옴). 매 호출 사이 딜레이 + 실패 시 한 번 재시도.
const REQUEST_DELAY_MS = 400;

async function fetchJson(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      await sleep(REQUEST_DELAY_MS);
      return data;
    }
    if (attempt === 0) await sleep(1500);
  }
  throw new Error('NHTSA API 요청 실패(재시도 포함): ' + url);
}

async function fetchModelsWithRecalls(make, year) {
  const url =
    'https://api.nhtsa.gov/products/vehicle/models?modelYear=' +
    year +
    '&make=' +
    encodeURIComponent(make) +
    '&issueType=r';
  const data = await fetchJson(url);
  return (data.results || []).map((r) => r.model);
}

async function fetchRecallsForModel(make, model, year) {
  const url =
    'https://api.nhtsa.gov/recalls/recallsByVehicle?make=' +
    encodeURIComponent(make) +
    '&model=' +
    encodeURIComponent(model) +
    '&modelYear=' +
    year;
  const data = await fetchJson(url);
  return data.results || [];
}

// NHTSA ReportReceivedDate는 "DD/MM/YYYY" 형식으로 온다.
function parseNhtsaDate(text) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text || '');
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  return new Date(Date.UTC(year, month - 1, day));
}

async function fetch_() {
  const results = [];
  const seenCampaigns = new Set(); // 같은 캠페인이 여러 model+year 조합에서 중복 리턴될 수 있음
  const year0 = new Date().getFullYear();

  for (const { make, brand } of BRANDS) {
    for (let y = year0 - YEARS_BACK; y <= year0; y++) {
      let models;
      try {
        models = await fetchModelsWithRecalls(make, y);
      } catch (e) {
        console.warn('[nhtsaRecalls] models fetch failed:', make, y, e.message);
        continue;
      }
      const uniqueModels = [...new Set(models)].filter((m) => isMotorcycleModel(make, m));

      for (const model of uniqueModels) {
        let recalls;
        try {
          recalls = await fetchRecallsForModel(make, model, y);
        } catch (e) {
          console.warn('[nhtsaRecalls] recalls fetch failed:', make, model, y, e.message);
          continue;
        }
        for (const r of recalls) {
          const campaignNo = r.NHTSACampaignNumber;
          if (!campaignNo || seenCampaigns.has(campaignNo)) continue;
          seenCampaigns.add(campaignNo);

          const title = make + ' ' + (r.ModelYear || y) + ' ' + model + ' - ' + (r.Component || 'Recall');
          const rawText = [r.Summary, r.Consequence, r.Remedy].filter(Boolean).join(' ');

          results.push({
            title,
            url: 'https://www.nhtsa.gov/recalls?nhtsaId=' + campaignNo,
            publishedAt: parseNhtsaDate(r.ReportReceivedDate),
            rawText: rawText || title,
            brand,
            sourceTier: SOURCE_TIER,
            vnConfirmed: false
          });
        }
      }
    }
  }

  return results;
}

module.exports = { fetch: fetch_ };
