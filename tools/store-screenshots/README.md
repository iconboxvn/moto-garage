# 스토어 스크린샷 생성기

`www/`의 앱(KO/EN/VN)을 헤드리스 Chrome(390×844, 3x)으로 캡처하고, 상단에 카피를 얹어 1080×2100 PNG 5장×3개 언어를 만든다.
2026-10-11 Night Cluster 리디자인 후 Play 스토어 스크린샷 교체용으로 작성.

## 준비 (최초 1회)
```
cd tools/store-screenshots && npm install
```
- macOS의 `/Applications/Google Chrome.app` 필요 (puppeteer-core라 브라우저는 내려받지 않음)

## 실행
```
export BACKUP_JSON="/경로/ridemate-backup-....json"   # 앱 '백업' 파일(샘플 데이터 원본)
node fetchfs.mjs                  # 소식·유가를 Firestore 공개 읽기로 fs_*.json에 저장 (읽기 전용)
node capture.mjs vn,en,ko         # raw/{lang}_{home,consumables,history,news,sos,sosauto}.png
node compose.mjs vn out_vn        # 카피 합성 → vi_0N_*.png (en/ko도 동일)
node compose.mjs en out_en
node compose.mjs ko out_ko
```
최종 산출물은 `store-assets/screenshots/v2/`에 복사한다.

## 순서와 카피
`compose.mjs`의 `SET`에서 바꾼다. 현재 순서: 홈 → 소모품 → 정비이력 → **SOS 카운트다운(4번째)** → 바이크 소식.
카피의 `|`는 줄바꿈. 베트남어 카피는 초안이라 원어민 검수 필요.

## 개인정보·주의
- `data.mjs`가 백업에서 번호판 제거, 정비이력은 가상 데이터로 대체, 의료정보·비상연락처는 가짜 값(`0912 345 678`)으로 교체한다.
- **라이딩 경로 지도 화면은 일부러 제외** (실제 GPS 경로가 노출됨).
- SOS 컷은 설정의 "자동 SOS 체험"(`_sosSimulate`) 화면이며, 체험 배지·모드 문구만 숨긴다.
- 소식·유가는 앱이 Capacitor Firestore 플러그인으로 읽기 때문에, 브라우저에서는 `capture.mjs`가 같은 인터페이스의 가짜 플러그인으로 `fs_*.json`을 돌려준다.
- 위치 권한은 SOS 컷에서만 허용한다(그 외엔 실시간 날씨 팝업이 화면을 덮음).
- 앱 화면(`www/`)이 바뀌어 요소 이름이 달라지면 `capture.mjs`의 셀렉터/함수(`showPage`, `.sos-fab`, `_sosSimulate`, `.auto-sos-sim`, `#auto-sos-dbg`)를 확인할 것.
- 헤드라인은 한 줄에 약 22자(영문)/14자(한글) 안팎, 최대 2줄. 넘치면 폰 화면과 겹치니 합성 후 눈으로 확인할 것.

## App Store (iOS) 스크린샷
```
node compose.mjs ko out_ios_ko ios   # 1320×2868 (6.9"), en/vn도 동일
```
- iOS v1엔 낙차 감지·자동 SOS 문자가 없어서 4번째 컷(`sosauto`)을 SOS 시트(`sos`, 긴급번호·의료카드)로 바꾼다.
  없는 기능을 스크린샷에 넣으면 App Store 심사 2.3.1로 거절된다.
- 결과물은 `store-assets/screenshots/ios/`에 복사. 등록정보 문구는 `store-assets/listing_appstore.md`.
