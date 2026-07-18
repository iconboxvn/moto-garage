# Ridemate 배포 전 점검 체크리스트

스토어(Play Console)에 새 버전을 올리기 전에 항상 이 순서대로 확인한다.
"Claude가 할 일"은 다음 세션에서 "이 체크리스트대로 배포 전 점검해줘"라고 요청하면 대신 수행 가능.

---

## 1. 코드 정합성 (자동 확인 가능)

- [ ] **JS 문법 검증** — `www/index.html`, `index_en.html`, `index_vn.html` 3개 파일 모두
  ```bash
  node -e "
  const fs = require('fs');
  const content = fs.readFileSync('www/index.html','utf8');
  const scripts = [...content.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  fs.writeFileSync('/tmp/check.js', scripts.join('\n'));
  "
  node --check /tmp/check.js
  ```
- [ ] **KO/EN/VN 함수·모달 개수 대조** — 최근 세션에서 새로 추가한 함수명/모달 id를 `grep -c`로 3개 파일에서 세어 정확히 같은 개수인지 확인 (하나만 고치고 포팅 누락되는 사고 방지)
- [ ] **한글 잔존 여부 확인** — `index_en.html`, `index_vn.html`에서 `[가-힣]` 정규식으로 검색해, 새로 추가한 화면에 번역 누락된 한글 라벨이 없는지 확인 (내부 주석/legacy 데이터 키는 무시해도 됨)
- [ ] **CLAUDE.md 고정값 변경 여부** — 아래 값이 실수로 바뀌지 않았는지 grep으로 확인
  - 앱 이름 `Ridemate`, 패키지명 `com.iconbox.motogarage`
  - 정비 알림 시각 `t.setHours(8, 0, 0, 0)`
  - 충격 감지 최소 속도 `_MIN_SPD = 20`
  - SOS 카운트다운 `_sos.cdVal = 60`

## 2. 리스너/타이머 생명주기 점검 (2026-07 GPS 중복 등록 버그 이후 추가된 항목)

과거에 `_sosGPSStart()`가 재진입 가드 없이 앱 재시작마다 리스너를 계속 쌓은 적이 있음 (라이딩 중 웹뷰가 재생성될 때마다 호출되는데 가드가 없어서 중복 등록됨 → 실제 GPS 신호 1번이 리스너 개수만큼 중복 처리됨).

- [ ] `.addListener(` / `navigator.geolocation.watchPosition(` 호출하는 함수가 **두 곳 이상에서 호출되는지** 확인 (`grep -n` 으로 호출부 대조)
- [ ] 두 곳 이상에서 호출된다면, 그 함수 시작 부분에 **"이미 리스닝 중이면 return" 가드**가 있는지 확인 (`_sosMotionStart()`의 `motListening` 패턴 참고)
- [ ] `setInterval` 사용하는 곳은 재호출 전에 항상 `clearInterval`부터 하는지 확인
- [ ] start 함수와 stop 함수가 짝을 이루고, stop에서 가드 플래그를 반드시 `false`로 되돌리는지 확인

## 3. 실기기 스모크 테스트 (사람이 직접 — 자동화 불가/비권장)

- [ ] **실제 라이딩 테스트**: 시동 걸고 5분 이상 실제 주행, 거리/속도/시간이 그럴듯하게 찍히는지
- [ ] **라이딩 중 앱 강제종료 → 재실행**: 거리/시간이 0으로 안 리셋되는지, GPS 리스너 중복 안 되는지 (디버그 로그로 확인 가능 — 아래 4번 참고)
- [ ] **라이딩 중 화면 꺼짐 상태로 10분+ 방치 후 재개**: 정상적으로 이어지는지
- [ ] **SOS 카운트다운 실제 취소**: 앱 열어서 취소 버튼 누르면 문자 발송 안 되는지
- [ ] **소모품 교체 알림**: 오전 8시 알림이 실제로 오는지 (직전 배포 전에 재확인)
- [ ] **언어 전환**: 상단 국기 아이콘 / 설정 화면 양쪽 다 눌러보고 재실행 후에도 선택한 언어가 유지되는지
- [ ] **오프라인 상태에서 기본 기능**: 비행기 모드로 전환 후 차량/소모품/정비이력 화면이 깨지지 않는지

## 4. 디버그 로그로 이상 탐지 (선택, 배포 직전 최종 확인용)

디버그 빌드에는 `_dbgLog()`가 라이딩 이벤트를 최대 3000개까지 기록한다 (release 빌드는 자동 비활성).
`initDebugMode()`가 앱 시작 시 최근 2일치를 logcat에 `MG2_DBGLOG:` 태그로 덤프하도록 되어 있으니, 실제 테스트 라이딩 후 아래로 이상 유무를 확인할 수 있다.

```bash
adb logcat -d | grep "MG2_DBGLOG:" | sed 's/.*Msg: MG2_DBGLOG://' > dbglog.jsonl
```

이상 신호 예시 (전에 실제로 있었던 패턴):
- 짧은 시간(수십 초) 안에 수백~수천 개의 `speed` 이벤트가 몰려있음 → 리스너 중복 등록 의심
- `ride_start` 없이 `speed` 이벤트만 계속 있음 → 상태 관리 꼬임 의심
- `gps_gap`이 라이딩 내내 반복적으로 찍힘 → 백그라운드 처리 지연 문제 의심

## 5. 빌드 & 배포

```
npx cap sync android          # 네이티브 플러그인 추가/변경 시 (아니면 npx cap copy android)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew bundleRelease       # Play Store 업로드용 AAB
```

- [ ] `android/app/build.gradle`의 `versionCode` 증가, `versionName` 갱신했는지
- [ ] 디버그 전용 코드(`console.log('MG2_DBGLOG...')` 등)는 `BuildConfig.DEBUG` 체크로 release에서 자동 비활성화되니 별도 제거 불필요 — 단, 새로 추가한 디버그용 코드가 있다면 이 가드를 거치는지 확인
- [ ] Play Console 업로드 전 실제 release AAB로 한 번 더 설치 테스트 (`bundletool`로 APK 뽑아서 설치, 또는 내부 테스트 트랙 업로드)
