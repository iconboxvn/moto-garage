# Ridemate — CLAUDE.md

## 절대 변경 금지 설정값

아래 값들은 어떤 요청이 있어도 임의로 변경하지 말 것.
변경이 필요하면 사용자에게 명시적으로 확인을 받을 것.

| 항목 | 값 | 위치 |
|---|---|---|
| 앱 이름 | `Ridemate` | `strings.xml`, `capacitor.config.json` |
| 패키지명 | `com.iconbox.motogarage` | `AndroidManifest.xml`, `build.gradle`, `capacitor.config.json` |
| 정비 알림 시각 | **오전 8시** (`_atEightAm()` 내부 `setHours(8, 0, 0, 0)`) | `scheduleConsumableAlerts()` — 9시 아님. 과거 `_atNineAm()`으로 잘못 회귀된 적 있음(2026-07 재발견·수정), 함수명 자체가 시각을 나타내니 이름과 실제 값이 항상 일치하는지 확인할 것 |
| 충격 감지 최소 속도 | **20 km/h** — `www/index*.html`의 `_MIN_SPD`(라이딩 속도게이트/UI 표시용)와 `RidingService.java`의 `MIN_SPD_KMH`(네이티브 충격감지 상태머신 게이트용) **두 곳에 중복 존재, 항상 같이 변경할 것** | `www/index*.html`, `android/.../RidingService.java` |
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
var _MIN_SPD   = 20;    // 감지 활성화 최소 속도 (km/h) ← 변경 금지. 라이딩 속도게이트(_sos.speedOk)/UI 표시용
```

## 충격/낙차 감지 상태머신 (네이티브, RidingService.java) — 2026-07-28 이전됨

> 원래 JS(`_sosAccel()`)에 있었으나, 백그라운드에서 WebView JS가 suspend되면 감지 자체가
> 멈출 수 있어(GPS 최고속도 오탐의 원인이었던 것과 동일한 문제) 네이티브로 이전함.
> GPS는 이미 `RidingService`로 이전되어 있었으므로, 가속도계 리스닝+상태머신도 같은
> 서비스에 추가하는 형태로 확장.

```java
// android/app/src/main/java/com/iconbox/motogarage/RidingService.java
private static final float FF_MAG      = 3f;     // 자유낙하 감지 임계값 (m/s²)
private static final long  FF_DUR      = 300L;   // 자유낙하 지속 시간 (ms)
private static final float IMP_MAG     = 39.2f;  // 직접 충격 임계값 (4G, m/s²)
private static final float FF_IMP_MAG  = 19.6f;  // 낙차 후 충격 임계값 (2G, m/s²)
private static final long  STILL_DUR   = 5000L;  // 충격 후 정지 판정 시간 (ms) ← 변경 금지
private static final float MIN_SPD_KMH = 20f;    // 감지 활성화 최소 속도 (km/h) ← 변경 금지, www/index*.html _MIN_SPD와 동일하게 유지
```

**아키텍처 (A안 — 단계적 이전의 1단계)**:
- 가속도계 리스닝(`SensorManager`, TYPE_ACCELEROMETER) + 상태머신(MONITORING→FREEFALL→IMPACT)은
  `RidingService`가 담당. 속도게이트도 GPS 콜백에서 자체 계산(JS 왕복 없음).
- "충격+정지 확정" 시 `LocalBroadcastManager`로 `crashDetected` 이벤트를 JS에 전달하고, 자신은
  즉시 대기 상태(PHASE_COUNTDOWN)로 전환해 중복 트리거 방지.
- **카운트다운 UI, GPS 이동 취소 체크, 알림, SMS 발송은 그대로 JS(`_sosTrigger()` 이후 로직)가 담당**
  — 이번 이전 범위에서 제외.
- JS가 취소(`cancelAutoSOS`)하거나 발송 완료(`_sosSend`)하면 `Riding.resumeMonitoring()`을 호출해
  네이티브 상태를 다시 MONITORING으로 리셋.
- 디버그 전용 테스트 훅 `Riding.simulateCrash()` — 실제 가속도계 없이 `crashDetected` 브로드캐스트
  경로를 검증하기 위함 (`BuildConfig.DEBUG`에서만 동작).

**미이전 상태 (B안, 향후 검토)**: 카운트다운 UI/SMS 발송까지 전부 네이티브(알림+액션 버튼)로 옮겨서
WebView가 완전히 죽어있어도 안전기능이 살아있게 하는 안. 지금은 A안(상태머신만 이전)까지만 완료.

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

---

## 유가 정보 기능 (Fuel Price) — 설계 결정사항

> 2026-07-27 claude.ai에서 논의 후 확정. 새 기능 구현 시작 전 반드시 참고.

### 목적
베트남 유가(오토바이 연료 기준)를 앱에서 보여준다. 라이더가 매번 뉴스를 찾아보지
않아도 최근 유가와 지난 조정 대비 증감을 홈 화면에서 바로 확인.

### 범위 (1단계)
- 유가 표시만. "내 바이크 기준 연료비 계산"(연비 입력 → 이번 달 연료비 등)은 2단계로
  분리, 1단계 범위 아님 — 2단계는 bike 데이터에 연비(km/L)·유종 필드 추가가 선행돼야
  해서 별도 논의 필요.
- 오토바이 앱이라 **휘발유(E5 RON92, E10 RON95=RON95)만** 다룬다. Diesel/Kerosene은
  오토바이 연료가 아니라서 제외 (최초 논의안엔 4종 다 있었지만 스코프를 좁힘).
- 지역별(Vùng 1/Vùng 2) 가격 차이는 다루지 않음 — MOIT/VietnamNet이 보도하는 숫자는
  전국 공통 상한가("không cao hơn ~đồng/lít")라 지역 구분이 애초에 없음.

### 소스 조사 결과 (중요 — 재검토 시 이 결정을 뒤집기 전에 참고)
아래 순서로 후보를 직접 확인함. 겉보기엔 "공식" 소스가 가장 좋아 보이지만 실제
스크래핑 가능성 기준으로는 정반대였음.

| 소스 | 결과 | 사유 |
|---|---|---|
| Petrolimex 홈페이지 유가 위젯 | ❌ 탈락 | 정적 HTML이 아니라 자체 CMS("NGX Websites") 내부 API를 JS로 호출해서 그리는 위젯. `curl` 원본 HTML엔 가격 데이터 자체가 없음. 세션/디바이스 토큰 발급 플로우까지 역공학해야 해서 EU Safety Gate보다 더 브리틀할 것으로 판단, 보류. |
| Petrolimex 보도자료(가격 조정 발표) | ❌ 탈락 | 유종별 가격표가 텍스트가 아니라 **JPG 이미지**로 박혀있어서 크롤링 불가 (OCR 없이는). |
| MOIT 공식 결정문(`/van-ban-phap-luat/van-ban-dieu-hanh/...`) | ❌ 탈락 | 페이지 본문엔 가격 없고 PDF 첨부파일 안에만 있음. |
| MOIT 뉴스 기사(`/tin-tuc/...-dieu-hanh-gia-xang-dau-ngay-*.html`) | ⚠️ 보류(폴백용) | 가격이 평문 텍스트로 있어서 파싱 자체는 가능하지만, **최신 글을 자동으로 찾을 목록/RSS/검색 엔드포인트를 못 찾음** (제목 패턴도 "Một số thông tin..."/"Thông tin..." 등으로 들쭉날쭉). 날짜 기반 URL 추측(여러 제목 변형 조합)으로만 접근 가능 — 메인 소스로 쓰기엔 약하지만 VietnamNet 실패 시 폴백으로 시도할 가치는 있음. |
| **VietnamNet "Giá xăng dầu hôm nay" 시리즈** | ✅ 채택 (1순위) | 고정 태그 페이지(`vietnamnet.vn/gia-xang-dau-tag5537394984591514120.html` + `-page2.html` 등)에서 최신 글 목록을 안정적으로 가져옴 (Honda VN 뉴스 목록과 동일한 패턴). 본문에 실제 가격이 규칙적인 평문 패턴으로 있고("giá bán không cao hơn 21.435 đồng/lít"), 기사 안에 "Dữ liệu từ Bộ Công Thương"(자료 출처: 산업무역부)라고 명시돼 있어 원 출처는 MOIT임. `sourceTier: press_general`로 분류(언론사 재가공이지 정부 공식 채널 자체는 아니므로). |

**⚠️ 확인된 리스크 — VietnamNet도 "매일 발행"이 아니다**: 태그 페이지 5장(~90일치)을
직접 검사한 결과, 2026-07-01~07-11(11일간) 이 시리즈 자체가 통째로 빠진 전례가 실제로
있었음. "기사가 매일 나온다"는 가정하에 설계하면 안 됨. 대신 실제 유가 자체는 MOIT가
대략 주 1회(주로 목요일)만 조정한다는 점에 맞춰 설계함 — 아래 "UI 설계"의 프레시니스
표시, "파이프라인 설계"의 폴백/경고 임계값 참고.

### Firestore 스키마: `fuel_prices` 컬렉션
```
fuel_prices/{autoId}
├─ effectiveAt: timestamp   // 가격 발효 일시 (기사 내 "kỳ điều hành DD/M" 파싱, 실패 시 발행일로 대체)
├─ prices: {
│    e5_ron92: number,      // đồng/lít
│    e10_ron95: number      // đồng/lít (RON95, E10 블렌딩 의무화 이후 명칭)
│  }
├─ deltas: { e5_ron92: number|null, e10_ron95: number|null }  // 직전 문서 대비 증감(đồng)
├─ sourceName: "VietnamNet" | "MOIT"
├─ sourceUrl: string
├─ sourceTier: "press_general" | "official_local"
├─ collectedAt: timestamp
└─ dedupeKey: string   // effectiveAt 날짜(YYYY-MM-DD) 기반. sourceUrl 해시 아님 — 같은
                        // 조정 건을 VietnamNet/MOIT 두 소스가 각각 다른 글로 보도해도
                        // 같은 날짜면 하나로 합쳐야 하기 때문에 brand_news와 dedupe 기준이 다름
```
- 보관 기간: brand_news와 동일하게 삭제 로직 없음, 무기한 보관 (주 1회 수준이라 볼륨
  자체가 작음)
- 히스토리 성격이라 최신 2개 문서만 있으면 "지난 조정 대비 증감" 계산 가능 (앱에서
  최근 N개 페이지네이션할 필요 없음 — 최신 1~2개만 읽으면 됨)

### 파이프라인 설계
1. **트리거**: 매일 1회, `18:00 Asia/Ho_Chi_Minh` (brandNews의 새벽 3시와 다름 — MOIT
   조정이 보통 15:00 발효라 그 이후로 잡아야 당일 캐치 가능성이 올라감)
2. **1순위**: `sources/fuelPriceVn.js` — VietnamNet 태그 페이지에서 최신 글 링크 추출 →
   아직 `fuel_prices`에 없는 `effectiveAt` 날짜인지 확인 → 있으면 본문 정규식 파싱
3. **폴백**: 1순위가 새 글을 못 찾았고, 마지막 저장된 `effectiveAt`으로부터 5일 이상
   지났으면 `sources/fuelPriceMoit.js` 시도 (오늘 날짜 기준 제목 패턴 3~4가지 조합으로
   URL 후보 생성 후 순차 GET, 200 뜨는 것만 채택)
4. 파싱된 가격이 **15,000~35,000đ/L 범위를 벗어나면 저장 보류**하고 로그만 남김 (safety
   키워드 체크와 같은 취지의 최소 안전장치 — 파싱 오류로 이상한 숫자가 카드에 뜨는
   사고 방지)
5. `dedupeKey`(effectiveAt 날짜) 기준 신규면 저장, 기존이면 스킵
6. **0건 연속 경고 임계값은 brandNews(14회)보다 훨씬 타이트하게 5회**로 설정 — 실제
   11일 공백 전례가 있었으므로 14일 기준이면 실제 장애를 못 잡음

### UI 설계
- **홈 화면 카드**로 노출 (더보기 메뉴 아님 — 매일 보는 정보라 진입장벽 낮춰야 한다는
  결론). 정비 알림 카드 근처에 배치
- E5 RON92 / E10 RON95(=RON95) 두 줄, 각각 직전 대비 증감(▲▼) 표시
- **"오늘의 유가"라고 단정하지 않고 발효 일시를 항상 명시** — 예: "21,435đ/L
  (7월 23일 15:00 기준)". 소스 공백이 실제로 있었던 걸 확인했기 때문에, 갱신이 며칠
  밀려도 거짓말 안 하는 쪽으로 설계
- 최신 문서의 `effectiveAt`이 오늘로부터 **10일 이상** 지났으면 카드에 옅게 "갱신 지연
  중" 같은 표시 추가 (사용자가 오해하지 않도록)
- 캐릭터 코멘트("이번 주는 천천히 다니자" 류)나 "만땅 넣으면 얼마" 계산기는 2단계
  스코프(바이크 연비 데이터 필요)라 1단계에선 제외

### 확정된 정책 (재확인 시 이 결정을 뒤집지 말 것)
- 1단계는 표시만, 바이크 기준 비용 계산은 2단계로 분리
- 오토바이 연료(휘발유)만 다룸 — Diesel/Kerosene 제외
- 지역별(Vùng 1/Vùng 2) 가격 차이 없음, 전국 단일 상한가만 사용
- VietnamNet을 1순위 소스로 채택 (Petrolimex는 기술적으로 막혀서 탈락, MOIT 직접은
  폴백으로만 사용)
- dedupeKey는 sourceUrl이 아니라 effectiveAt 날짜 기준 (brand_news와 다른 점, 실수로
  brand_news 패턴 그대로 복사하지 말 것)
- 0건 연속 경고 임계값 5회 (brand_news의 14회를 그대로 쓰지 말 것 — 이유는 위 "확인된
  리스크" 참고)
