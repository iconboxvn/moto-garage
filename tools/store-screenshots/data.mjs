import fs from 'fs';
// 샘플 데이터 원본: 앱 '백업' JSON(번호판·의료정보·연락처·정비이력은 아래에서 전부 제거/대체됨).
// BACKUP_JSON 환경변수로 경로 지정. 이 파일은 저장소에 커밋하지 말 것.
const BACKUP = process.env.BACKUP_JSON;
if (!BACKUP) { console.error('BACKUP_JSON 환경변수에 앱 백업 JSON 경로를 지정하세요.'); process.exit(1); }
const src = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
export function buildData(lang) {
  const D = JSON.parse(JSON.stringify(src));
  D.bikes.forEach(b => { b.plate = ''; });
  // 활성 차량 Janus가 첫 번째 칩으로 오도록 순서는 그대로, last-bike-id로 선택
  D.rides.forEach(r => { delete r.path; delete r.pathT; });
  const janus = D.bikes.find(b => b.model === 'Janus');
  const L = {
    vn: { oil:'Thay dầu động cơ', filter:'Thay lọc dầu', tireF:'Thay lốp trước', brake:'Thay má phanh sau', check:'Bảo dưỡng định kỳ', shop1:'Tiệm Hùng Yamaha', shop2:'Honda Head Quận 7', self:'Tự thay' },
    en: { oil:'Engine oil change', filter:'Oil filter change', tireF:'Front tire replaced', brake:'Rear brake pads replaced', check:'Routine service', shop1:'Hung Yamaha Shop', shop2:'Honda Head District 7', self:'DIY' },
    ko: { oil:'엔진오일 교체', filter:'오일 필터 교체', tireF:'앞 타이어 교체', brake:'뒤 브레이크패드 교체', check:'정기 점검', shop1:'흥 야마하 정비소', shop2:'혼다 헤드 7군', self:'직접' },
  }[lang];
  const e = (i, date, km, type, desc, cost, shop) => ({ id: 2000000 + i, bikeId: janus.id, date, km, type, desc, cost, shop });
  // 정비 항목 상태를 보기 좋게: 뒤 타이어만 초과, 뒤 브레이크패드 임박, 나머지 양호
  const set = (id, lastKm, lastDate) => { const c = janus.consumables.find(x => x.id === id); if (c) { c.lastKm = lastKm; c.lastDate = lastDate; } };
  set('oil', 13450, '2026-08-02'); set('oil_f', 13450, '2026-08-02'); set('spark', 9000, '2025-12-20');
  set('chain', 8200, '2026-02-10'); set('brake_f', 6000, '2025-09-01'); set('brake_r', 0, '');
  set('tire_f', 10900, '2026-03-01'); set('tire_r', 1000, '2024-11-05'); set('coolant', 9000, '2025-12-20'); set('air_f', 9000, '2025-12-20');
  D.history = []; // 다른 차량의 실제 이력(한국어·정비소명)은 전부 제외
  D.history.push(
    e(1, '2026-09-12', 14050, '소모품교체', L.brake, 180000, L.shop2),
    e(2, '2026-08-02', 13450, '소모품교체', L.oil, 90000, L.shop1),
    e(3, '2026-08-02', 13450, '소모품교체', L.filter, 60000, L.shop1),
    e(4, '2026-05-18', 12100, '정기점검', L.check, 250000, L.shop2),
    e(5, '2026-03-01', 10900, '소모품교체', L.tireF, 420000, L.shop1),
    e(6, '2025-12-20', 9300, '소모품교체', L.oil, 90000, L.self),
  );
  // 개인정보 제거: 의료정보·SOS 연락처는 가짜로
  D.medical = []; D.sosContact = [];
  return { D, janusId: janus.id };
}
