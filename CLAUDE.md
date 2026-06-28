# Ridemate — CLAUDE.md

## 절대 변경 금지 설정값

아래 값들은 어떤 요청이 있어도 임의로 변경하지 말 것.
변경이 필요하면 사용자에게 명시적으로 확인을 받을 것.

| 항목 | 값 | 위치 |
|---|---|---|
| 앱 이름 | `Ridemate` | `strings.xml`, `capacitor.config.json` |
| 패키지명 | `com.iconbox.motogarage` | `AndroidManifest.xml`, `build.gradle`, `capacitor.config.json` |
| 정비 알림 시각 | **오전 8시** (`t.setHours(8, 0, 0, 0)`) | `scheduleMaintNotifs()` — 9시 아님 |
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
