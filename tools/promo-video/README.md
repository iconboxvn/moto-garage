# 홍보 영상 소재 생성기 (TikTok 시리즈)

주행 영상 사이에 끼워 넣을 **앱 화면 클립**을 만들고, 1편을 조립한다. 영상 편집 전환 그래픽이 어려워서, 하드컷으로 이어 붙이는 방식으로 정했다.

## 준비
```
cd tools/promo-video && npm install
brew install ffmpeg        # /opt/homebrew/bin/ffmpeg 사용, Chrome(puppeteer-core)도 필요
```

## 1) SOS 카운트다운 클립 (앱 화면)
```
node sos-frames.mjs vn      # www/ 앱의 실제 _sosSimulate 로직을 틱 단위로 돌려 frames/vn/*.png (12fps)
node sos-video.mjs vn       # out/sos-vn-screen.mp4(화면만) + out/sos-vn-card.mp4(자막+폰 카드)  (vn|en|ko)
```
- 60 → 1을 12배속으로 5초, 앞 1초·뒤 1초 홀드, 총 약 6.8초 (1080x1920, 30fps, 무음).
- "체험 결과" 화면(시뮬레이션 표시)은 일부러 제외하고 카운트다운 도중에 끊는다.
- 연락처는 가짜 값: `Bạn Minh 09** *** ***`(진짜일 수 있는 번호 대신 마스킹). 번호는 `sos-frames.mjs`의 `mg2-medical`에서 바꾼다.

## 2) 1편 조립
```
node ep01.mjs "<앞.mp4>" "<뒤.mp4>" out/sos-vn-card.mp4     # → out/ep01-vn.mp4 (약 24초)
```
구성: 앞(주행+카메라 낙하, 후크 자막) → 뒤(💢 반응 + 자막) → 질문 카드 → SOS 카드 → 도메인 끝 카드.
- 자막 문구·구간 길이는 `ep01.mjs` 상단(`T`, `A_SS`/`A_T` 등)에서 수정. 베트남어 문구는 초안이라 원어민 검수 필요.
- 앞/뒤 원본이 576x1024라 1080x1920으로 확대(lanczos + 약한 선명화).
- 뒤 영상의 계기판 속도는 `x560 y1520 440x260` 구간에 가장자리 부드러운 블러를 적용(ep01.mjs 필터). 다른 원본을 쓰면 위치를 다시 확인할 것.
- 앞/뒤 원본 소리는 유지하고 컷 경계에 짧은 페이드를 넣는다. SOS·질문·끝 카드 구간은 무음 — 음악은 TikTok에서 고른다.

## 3) 2편(주유/유가) 조립
```
node ../store-screenshots/fetchfs.mjs && cp ../store-screenshots/fs_fuel.json .   # 최신 유가(Firestore 공개 읽기) — 올리기 직전에 반드시 갱신
node fuel-card.mjs vn                                                            # 앱 유가 카드 캡처 → out/ep02/fuelcard.png
node ep02.mjs "<PRO_VID_...mp4>"                                                 # → out/ep02-vn.mp4 (약 16초, 무음)
```
- 6GB 원본에서 필요한 구간만 `-ss`로 잘라 쓴다(`ep02.mjs`의 `SEG`). **대기 줄 구간(약 20~330초)은 번호판·사람이 많아 쓰지 않는다.**
- 진입 구간의 앞 스쿠터 번호판은 `blur: [x, y, w, h]`(1080x1920 기준)로 가림. 번호판이 화면 왼쪽 끝을 따라 움직이므로 마스크의 왼쪽 변은 옅어지지 않게(x=0부터) 처리. 구간·원본을 바꾸면 프레임을 직접 보고 위치를 다시 잡을 것.
- 직원 얼굴이 정면으로 나오는 순간(마스크 착용이어도 식별 가능)은 구간에서 제외. 원본 소리(주변 대화 가능)는 쓰지 않고 무음 — 음악은 TikTok에서 선택.
- 유가 기준일 자막(`Kỳ điều hành d/m`)은 `fs_fuel.json` 최신 문서의 발효일(베트남 시간)에서 자동 계산.
- 올리기 전에 직접 재생해서 번호판·얼굴이 순간적으로 비치지 않는지 확인할 것(자동 검수는 몇 개 프레임만 봄).

## 주의
- 원본 영상(앞/뒤)과 산출물(`out/`, `frames/`)은 저장소에 넣지 않는다(.gitignore).
- 영상 속 URL은 TikTok에서 눌리지 않는다. 프로필(bio) 링크를 같은 도메인으로 둘 것.
