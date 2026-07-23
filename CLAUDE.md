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
- 하단 탭에 "소식" 신설 (홈/정비/기록/소식/설정)
- 탭 뱃지: 안 읽은 전체 소식 수 (개인화 카운트 아님)
- 필터 UI 없음 (카테고리 필터, 브랜드 필터 모두 1차 버전에서 제외 —
  실제 하루 쌓이는 소식 양을 보고 나중에 필요하면 추가)
- 안전(safety) 카테고리 카드만 시각적으로 강조 (배경색 등), 피드 안에 섞여서 노출
- 카드 구성: 브랜드 뱃지(또는 정책 카테고리는 정부 아이콘) + 카테고리 태그 +
  시간 + 제목/요약 2줄 (+ 안전 카테고리는 출처 표기)

### 카테고리 (6개)
| 카테고리 | 내용 | 브랜드 태그 |
|---|---|---|
| safety | 리콜, 서비스 캠페인, 긴급 점검 | 있음 |
| product | 신차, 연식 변경, 신모델 공개 | 있음 |
| tech | 펌웨어, 전자장비, 부품 개선 | 있음 |
| service | 보증정책, 딜러망, 정비 프로그램 | 있음 |
| event | 전시회, 시승 행사, 브랜드 이벤트 | 있음 |
| policy | 교통 범칙금, 저배출구역(LEZ), 통제구역 등 정부/교통 정책 | 없음 (브랜드 무관) |

### 대상 브랜드 및 소스 티어
| 티어 | 소스 | 브랜드 | 방식 |
|---|---|---|---|
| 1 | NHTSA API, EU Safety Gate API | BMW Motorrad, Ducati, KTM, Triumph | 공식 공개 API (무료, 안정적) |
| 2 | 베트남 등록청(vr.org.vn) + 브랜드 공식 VN 리콜 페이지 | Honda, Yamaha, Suzuki, Kawasaki, VinFast | 스크래핑 |
| 3 | 없음, 확인 링크만 제공 | 중국 브랜드 | 최소 지원, 자동 수집 대상 아님 |
| policy 전용 | 한인 대상 매체(아세안데일리 등) 우선, 베트남 정부 공식, 일반 베트남 언론 보조 | 브랜드 무관 | 스크래핑 |

**주의**: NHTSA/EU Safety Gate는 미국·유럽 판매 모델 기준이라 동남아 전용 모델
(Honda SH, Yamaha NVX 등)은 커버 안 됨 → 그래서 대중 브랜드는 Tier 2가 메인.

### Firestore 스키마: `brand_news` 컬렉션
```
brand_news/{autoId}
├─ category: "safety" | "product" | "tech" | "service" | "event" | "policy"
├─ brand: "honda" | "yamaha" | "suzuki" | "kawasaki" | "bmw_motorrad"
│         | "ducati" | "ktm" | "triumph" | "vinfast" | "china_other" | null
├─ model: string | null
├─ title: { ko: string, en: string, vn: string }
├─ summary: { ko: string, en: string, vn: string }
├─ sourceName: string
├─ sourceUrl: string
├─ sourceTier: "official_global" | "official_local" | "press_kr" | "press_general"
├─ originalLanguage: "vi" | "en" | "ko"
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
   - Cloud Functions 타임아웃 여유 있게 설정 (예: 5분)

### 확정된 정책 (재확인 시 이 결정을 뒤집지 말 것)
- 사용자 등록 차량 기준 개인화/매칭 안 함 (전체 브랜드 공용 피드)
- 푸시 알림 없음 (앱 내 안 읽음 뱃지만)
- 자동 발행 (사람 승인 단계 없음), 안전 카테고리만 키워드 룰체크로 최소 안전장치
- 필터 UI 1차 버전에서 제외
- 중국 브랜드는 자동 수집 대상 아님, 최소 지원만
