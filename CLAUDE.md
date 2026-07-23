# Ridemate — CLAUDE.md

## 절대 변경 금지 설정값

아래 값들은 어떤 요청이 있어도 임의로 변경하지 말 것.
변경이 필요하면 사용자에게 명시적으로 확인을 받을 것.

| 항목 | 값 | 위치 |
|---|---|---|
| 앱 이름 | `Ridemate` | `strings.xml`, `capacitor.config.json` |
| 패키지명 | `com.iconbox.motogarage` | `AndroidManifest.xml`, `build.gradle`, `capacitor.config.json` |
| 정비 알림 시각 | **오전 8시** (`_atEightAm()` 내부 `setHours(8, 0, 0, 0)`) | `scheduleConsumableAlerts()` — 9시 아님. 과거 `_atNineAm()`으로 잘못 회귀된 적 있음(2026-07 재발견·수정), 함수명 자체가 시각을 나타내니 이름과 실제 값이 항상 일치하는지 확인할 것 |
| 충격 감지 최소 속도 | **20 km/h** (`_MIN_SPD = 20`) | `www/index*.html` |
| SOS 카운트다운 | **60초** (`_sos.cdVal = 60`) | `www/index*.html` |

---

## 프로젝트 구조

- **프레임워크**: Capacitor 6 (Android WebView 앱)
- **웹 소스**: `www/` → cap sync → `android/app/src/main/assets/public/`
- **HTML 파일**: 3개 언어 × 2 위치 = 6개 파일 항상 동시 수정
  - `www/index.html` + `index.html` (한국어)
  - `www/index_en.html` + `index_en.html` (영어)
  - `www/index_vn.html` + `index_vn.html` (베트남어)
- **네이티브**: `android/app/src/main/java/com/iconbox/motogarage/`
  - `MainActivity.java` — SmsPlugin, RidingPlugin 등록
  - `RidingPlugin.java` / `RidingService.java` — 포그라운드 서비스
  - `SmsPlugin.java` — SMS 발송

## 빌드 및 배포 순서

```
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android && .\gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

## 알림 ID 범위

| 범위 | 용도 |
|---|---|
| `9001` | SOS 충격 감지 알림 |
| `2000` | 정비 예정 알림 (단일, 통합) |

## 주요 JS 상수 (www/index*.html)

```javascript
var _FF_MAG    = 3;      // 자유낙하 감지 임계값 (m/s²)
var _FF_DUR    = 300;    // 자유낙하 지속 시간 (ms)
var _IMP_MAG   = 39.2;  // 직접 충격 임계값 (4G, m/s²)
var _FF_IMP_MAG = 19.6; // 낙차 후 충격 임계값 (2G, m/s²)
var _STILL_DUR = 5000;  // 충격 후 정지 판정 시간 (ms)
var _MIN_SPD   = 20;    // 감지 활성화 최소 속도 (km/h) ← 변경 금지
```

---

## 브랜드 소식 기능 (Brand News Feed) — 설계 결정사항

> 2026-07-23 claude.ai에서 논의 후 확정. 새 기능 구현 시작 전 반드시 참고.

### 목적
브랜드/모델과 무관하게 라이더 전체에게 유용한 리콜·제품·정책 소식을 자동 수집해
"소식" 탭에 노출. 사용자 등록 차량 기준 개인화/매칭 없음. 푸시 알림 없음.

### UI 구조
- **2026-07-24 기준 구현 상태**: 하단 탭 "소식"은 아직 미착수. 대신 더보기(☰) 메뉴 →
  "🗞 바이크 소식" 페이지(`page-brandNews`)로 KO/EN/VN 3개 언어 전부 구현 완료.
  하단 탭 전환은 나중에 별도로 진행.
- 탭 뱃지(안 읽은 소식 수)는 하단 탭 신설 시 같이 붙일 예정, 아직 없음
- **카테고리 필터 칩 구현함** (2026-07-24, 아래 "확정된 정책" 참고 — 최초 설계의
  "필터 UI 1차 버전에서 제외" 결정은 뒤집힘). 상단에 전체/안전/신제품/기술/서비스/
  이벤트/정책/정보 칩, 스크롤 시 헤더 바로 아래에 sticky 고정
- 리스트는 **수집일(collectedAt) 기준으로 그룹핑**("오늘 수집됨"/"어제 수집됨"/
  "M월 D일 수집됨" 헤더), 그룹 안에서는 발행일(publishedAt) 최신순
- 발행일 기준 2년 이내 항목만 노출 (오래된 리콜 정보라도 실제로 최근 수집된 거면
  노출은 되지만, 극히 오래된 건 컷오프)
- 안전(safety) 카테고리 카드만 시각적으로 강조 (빨간 톤 배경+왼쪽 테두리), 피드 안에
  섞여서 노출 — 구현 완료
- vnConfirmed:false인 항목(해외에서만 확인된 리콜 등)은 카드 안에 경고 배지로 별도 표시
- 카드 구성: 카테고리 태그 + 발행일 + 제목/요약 (+ vnConfirmed 경고, 있는 경우) +
  출처명 + 원문 링크

### 카테고리 (7개)
| 카테고리 | 내용 | 브랜드 태그 |
|---|---|---|
| safety | 리콜, 서비스 캠페인, 긴급 점검 | 있음 |
| product | 신차, 연식 변경, 신모델 공개 | 있음 |
| tech | 펌웨어, 전자장비, 부품 개선 | 있음 |
| service | 보증정책, 딜러망, 정비 프로그램 | 있음 |
| event | 전시회, 시승 행사, 브랜드 이벤트 | 있음 |
| policy | 교통 범칙금, 저배출구역(LEZ), 통제구역 등 정부/교통 정책 | 없음 (브랜드 무관) |
| info | 특정 발표/공지가 아닌 일반 정비 팁·사용법 가이드 (예: 오일 체크법, 침수 대처법) — 2026-07-23 추가. 브랜드 뉴스 목록 페이지에 SEO용 가이드 콘텐츠가 섞여 올라오는 경우가 있어, "브랜드의 실제 발표/공지"와 구분하기 위해 신설 | 있음 |

### 대상 브랜드 및 소스 티어

**2026-07-24 기준 실제 구현된 8개 소스** (`functions/sources/*.js`, `functions/brandNews.js`의 SOURCES 배열):

| 소스 파일 | sourceName | 담당 브랜드 | vnConfirmed | 비고 |
|---|---|---|---|---|
| `hondaVn.js` | Honda Việt Nam | honda | true | Honda VN 뉴스 목록 스크래핑 |
| `yamahaVn.js` | Yamaha Motor Việt Nam | yamaha | true | Yamaha VN 뉴스 목록 스크래핑 |
| `kawasakiNews.js` | Kawasaki Motors, Ltd. (Global) | kawasaki | false | VN 사이트에 뉴스 섹션 없어 글로벌 뉴스로 대체 |
| `suzukiNews.js` | Suzuki Motor USA | suzuki | false | VN 사이트가 Next.js SPA라 스크래핑 불가, 미국 사이트로 대체 |
| `nhtsaRecalls.js` | NHTSA (미국 도로교통안전국) | suzuki/kawasaki/ducati/ktm/triumph/bmw_motorrad | false | 공식 API, 연식별 2단계 조회 |
| `vrOrgVn.js` | Cục Đăng kiểm Việt Nam (베트남 등록청) | honda/yamaha/suzuki/kawasaki/vinfast | true | 정부 공식 등록 데이터, Tier 2 메인 |
| `euSafetyGate.js` | EU Safety Gate | bmw_motorrad/ducati/ktm/triumph | false | 비공식 내부 API 리버스엔지니어링 |
| `aseanDailyPolicy.js` | 아세안데일리 | null (브랜드 무관) | true | policy 카테고리 전용, RSS 피드 사용 |

**당초 계획과 달라진 점**: Kawasaki/Suzuki는 베트남 공식 사이트 자체가 스크래핑 불가능해서
(뉴스 섹션 없음 / SPA) 계획했던 "브랜드 공식 VN 리콜 페이지"를 포기하고 글로벌/미국 사이트로
대체했다 — 그래서 이 두 브랜드는 vnConfirmed:false. EU Safety Gate/NHTSA도 마찬가지 이유로
false. 미착수: EU Safety Gate 외 유럽 소스 확장, 중국 브랜드(설계상 자동 수집 대상 아님, 정책 유지).

**주의**: NHTSA/EU Safety Gate는 미국·유럽 판매 모델 기준이라 동남아 전용 모델
(Honda SH, Yamaha NVX 등)은 커버 안 됨 → 그래서 대중 브랜드는 vr.org.vn(Tier 2)이 메인.

### Firestore 스키마: `brand_news` 컬렉션
```
brand_news/{autoId}
├─ category: "safety" | "product" | "tech" | "service" | "event" | "policy" | "info"
├─ brand: "honda" | "yamaha" | "suzuki" | "kawasaki" | "bmw_motorrad"
│         | "ducati" | "ktm" | "triumph" | "vinfast" | "china_other" | null
├─ model: string | null
├─ title: { ko: string, en: string, vn: string }
├─ summary: { ko: string, en: string, vn: string }
├─ sourceName: string
├─ sourceUrl: string
├─ sourceTier: "official_global" | "official_local" | "press_kr" | "press_general"
├─ originalLanguage: "vi" | "en" | "ko"
├─ vnConfirmed: boolean  // 2026-07-24 추가. false면 해외(미국/EU 등)에서만 확인된
│                        // 정보라 베트남 판매 차량 적용 여부 미확인 — 앱에서 경고 배지 표시
├─ publishedAt: timestamp
├─ collectedAt: timestamp
├─ safetyVerified: boolean
└─ dedupeKey: string   // sourceUrl 해시, Firestore 색인 필요, 중복 수집 방지용
```
- 보관 기간: 삭제 로직 없음, 무기한 보관 (텍스트 데이터라 비용 무시 가능,
  안전 카테고리는 중고 구매 시 이력 확인 가치 있음)
- 피드는 최신순 페이지네이션 (최근 30~50건 로드 후 스크롤 시 추가 로드)

### 파이프라인 설계
1. **트리거**: Cloud Functions scheduled function (`onSchedule`), 매일 새벽 3시
   (Asia/Ho_Chi_Minh), 리전은 기존 `us-central1` 유지
2. **소스 모듈**: 소스별로 독립 파일로 분리 (`sources/nhtsa.js`, `sources/hondaVn.js` 등),
   공통 인터페이스: `fetch() → [{title, url, publishedAt, rawText, brand, sourceTier}, ...]`
3. **메인 흐름**:
   - Firestore에서 최근 60일치 dedupeKey를 Set으로 미리 로드
   - 소스 모듈들을 `Promise.allSettled`로 병렬 호출 (하나 실패해도 나머지 계속)
   - dedupeKey로 신규 항목만 필터링
   - anthropicProxy로 요약(ko/en/vn) + 카테고리 자동 태깅 요청
   - `category === "safety"`인 항목만 키워드 룰체크
     (원문에 "triệu hồi/thu hồi/recall" 등 없으면 발행 보류, 로그만 남김)
   - 통과 항목 `brand_news`에 저장 (승인 단계 없이 즉시 published 취급)
   - 실행 로그 기록 (소스별 성공/실패, 신규 건수)
4. **에러 처리 원칙**:
   - 소스 하나 실패가 전체를 막지 않도록 `allSettled` 필수
   - 스크래핑 소스가 사이트 구조 변경으로 "에러 없이 0건"이 되는 게 가장 위험한
     실패 패턴 → 특정 소스가 14일 연속 0건이면 로그에 경고 표시
   - `timeoutSeconds: 900` (2026-07-24, 5분→15분으로 상향) — 소스가 8개로 늘면서
     실측 실행 시간이 400~550초까지 나옴(EU Safety Gate 상세 조회 최대 60회 순차
     호출 + NHTSA 순차 호출이 큰 비중). 소스를 더 추가하면 이 값도 같이 재검토할 것

### 확정된 정책 (재확인 시 이 결정을 뒤집지 말 것)
- 사용자 등록 차량 기준 개인화/매칭 안 함 (전체 브랜드 공용 피드)
- 푸시 알림 없음 (앱 내 안 읽음 뱃지만)
- 자동 발행 (사람 승인 단계 없음), 안전 카테고리만 키워드 룰체크로 최소 안전장치
- 중국 브랜드는 자동 수집 대상 아님, 최소 지원만

> ~~필터 UI 1차 버전에서 제외~~ — 2026-07-24 뒤집힘. 실제 데이터가 130건 이상
> 쌓이면서 카테고리 구분 없이는 피드가 안 읽혀서 카테고리 필터 칩을 바로 추가함.
> "실제 쌓이는 양을 보고 나중에 필요하면 추가"라는 원래 유보 조건이 이미 충족된
> 케이스라, 이건 정책 번복이 아니라 예정된 후속 조치임.
