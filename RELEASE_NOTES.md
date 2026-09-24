# Release Notes

## v3.1.0 (versionCode 35) — 2026-09-24

v3.0.9(versionCode 34, ACCESS_BACKGROUND_LOCATION 제거) 이후 누적분.

- 🛣 **라이딩 종료 후 오도미터 자동 반영** — 라이딩 거리를 해당 바이크 누적 주행거리에
  자동으로 더함(0.1km 미만 제외). 라이딩 요약 모달 상단에 "현재 주행거리 X km으로
  업데이트됐어요" 강조 표시, 홈 화면 수치도 즉시 갱신. 수동 입력/계기판 사진 인식과 공존
- 📷 계기판 사진으로 누적 주행거리(ODO) 자동 인식 (KO/EN/VN)
- 📍 **라이딩 거리/속도 누적을 네이티브(RidingService)로 이전 (1단계)** — 백그라운드에서
  WebView가 suspend되며 거리가 유실/폭증하던 근본 원인 해결. 프로세스 킬 후 복구 시에도
  서비스가 누적한 값을 잃지 않도록 "더 큰 값 채택" 방식으로 시드
- 🏍 마지막에 선택한 바이크 기억 — 홈/소모품 탭 선택 동기화, 재시작해도 유지
- 🚨 SOS "동료 사고" 긴급번호를 GPS 판별 전에도 항상 노출(기본 베트남, 이후 자동 보정)
- 🏥 VN 앱 SOS 병원 섹션을 위치 기반 "가까운 병원 찾기"로 교체, 언어 미스매치 섹션 제거
- 🌐 온보딩 슬라이드 이미지 EN/VN 로컬라이즈, VN 오타/한글 잔존 수정
- ⭐ 앱 내 평가 요청(Google Play In-App Review) — 정비 2건째/라이딩 3km 이상 요약 닫을 때,
  90일 쿨다운
- 🐛 페이지 전환 시 이전 스크롤 위치가 남던 문제 수정

### Play 스토어 출시 노트 (사용자용, 언어별)

`release-notes/whatsnew-{ko-KR,en-US,vi-VN}.txt` 참고 (각 500자 이내).

**ko-KR**
```
• 라이딩이 끝나면 주행거리가 자동으로 누적돼요 (계기판과 완전히 같지 않아도 대략적인 거리를 계속 최신으로 유지)
• 계기판 사진을 찍으면 누적 주행거리를 자동으로 인식해요
• 라이딩 거리·속도 기록 안정성 개선 — 앱이 백그라운드에 있거나 재시작돼도 기록이 끊기지 않아요
• 마지막에 선택한 바이크를 앱을 다시 켜도 기억해요
• 긴급 SOS: '동료 사고' 응급번호가 GPS 확인 전에도 항상 보이고, 베트남 앱에서는 가까운 병원을 찾을 수 있어요
• 영어·베트남어 온보딩 화면 번역 및 화면 이동 시 스크롤 위치 오류 수정
```
**en-US**
```
• Odometer now updates automatically after each ride
• Read your odometer from a dashboard photo
• More reliable ride distance and speed tracking, even in the background
• Remembers the bike you selected last
• Emergency SOS numbers always visible; Vietnam app finds nearby hospitals
• Translated onboarding and fixed a scroll glitch
```
**vi-VN**
```
• Số km tự động cập nhật sau mỗi chuyến đi, luôn gần đúng mà không cần nhập tay
• Chụp ảnh đồng hồ để tự nhận số km tổng
• Ghi quãng đường và tốc độ ổn định hơn, kể cả khi ứng dụng chạy nền hoặc khởi động lại
• Ứng dụng nhớ chiếc xe bạn chọn lần trước
• SOS khẩn cấp: số khẩn cấp khi có tai nạn luôn hiển thị, có thể tìm bệnh viện gần nhất
• Dịch màn hình giới thiệu và sửa lỗi vị trí cuộn khi chuyển màn hình
```

## v3.0.8 (versionCode 33) — 2026-09-02

- 🌐 긴급 SOS 화면 영어·베트남어 번역 — 그동안 영어/베트남어 앱에서도 한국어로만
  표시되던 SOS 화면(응급 연락처, 의료 정보 카드, 사고 기록 체크리스트, 입력 폼)을
  각 언어로 표시하도록 수정
- 🗞 홈 화면에 "바이크 소식" 미리보기 추가 — 유가 정보 카드 아래에 최신 리콜·정비
  소식 3건(날짜+제목)을 바로 보여줌. 탭하면 전체 소식 목록으로 이동
- 🐛 라이딩 거리 오기록 수정 — 장거리 이동 중 앱이 오랜 시간 백그라운드에 있다가
  재개될 때, GPS 신호 공백 구간이 실제보다 훨씬 큰 거리(수백 km)로 잘못 더해지던
  문제 수정. 60초 넘는 GPS 공백 구간과 시간이 역전된 GPS 포인트는 거리 누적에서 제외
- 📝 스토어 등록정보: 앱 이름을 "Ridemate: 오토바이 관리 도우미"(KO) / "Ridemate:
  Bike Maintenance"(EN) / "Ridemate: Bảo dưỡng xe máy"(VN)로 변경, 베트남어 스크린샷 교체

### Play 스토어 출시 노트 (사용자용, 언어별)

**ko-KR**
```
• 홈 화면에서 최신 바이크 소식(리콜·정비 팁)을 바로 확인할 수 있어요
• 라이딩 거리 기록 정확도 개선 — 장거리 이동 중 앱이 오랫동안 백그라운드에 있다가 재개될 때 거리가 실제보다 크게 부풀려지던 문제를 수정했습니다
```
**en-US**
```
• The emergency SOS screen is now fully translated into English
• See the latest bike news (recalls, maintenance tips) right on the home screen
• Improved ride distance accuracy — fixed distances being inflated when the app stayed in the background for a long time during a long trip
```
**vi-VN**
```
• Màn hình SOS khẩn cấp nay đã có đầy đủ tiếng Việt
• Xem tin xe máy mới nhất (triệu hồi, mẹo bảo dưỡng) ngay trên màn hình chính
• Cải thiện độ chính xác quãng đường — sửa lỗi quãng đường bị tính phồng lên khi ứng dụng ở chế độ nền lâu trong chuyến đi dài
```

## v3.0.7 (versionCode 31) — 2026-08-13

- 🧾 "판매용 정비 이력서" 공유 기능 신설 — 차량별 정비 이력(번호판·연식·주행거리·
  비용 포함)을 PDF 한 장으로 만들어 Zalo/메신저 등으로 바로 공유. 중고 거래 시
  정비 이력 신뢰 신호로 활용
- 🐛 PDF 생성 관련 버그 2건 수정 — 화면 밖 렌더링 방식을 좌표 오프셋 대신 크기 0
  래퍼로 감싸는 방식으로 변경, jsPDF 페이지 방향을 실제 캡처 비율에 맞춰 명시(안
  그러면 이력이 적은 차량의 PDF가 강제로 세로 페이지에 눌려 오른쪽이 잘려나가는
  문제가 있었음)
- 💾 안드로이드 자동 백업이 기기 변경 시 데이터를 못 살리는 사례가 확인되어, 자동
  백업 안내 문구를 제거하고 정기 수동 백업(내보내기)을 재촉하는 경고 문구로 교체.
  마지막 백업이 30일 이상 지났으면 홈 화면에 리마인드 배너 표시
- ℹ️ 더보기 화면 하단에 현재 앱 버전 표시 추가
- 🚧 "다녀온 곳 지도 보기" 기능 진입점을 정식 출시 전까지 숨김 — 완성도가 더
  올라올 때까지 보류(`VISITED_PLACES_ENABLED` 플래그 하나로 다시 켤 수 있음, 코드/
  데이터는 그대로 유지)

## v3.0.6 (versionCode 28) — 2026-08-09

- 🗺 "다녀온 곳" 신규 기능 — 라이딩 중 한 곳에서 30분 이상 머문 지점을 자동 감지해
  지역별 지도(버블 마커)와 리스트로 보여줌. 라이딩 종료 시 실제 장소명을 Google
  Places API로 조회해 확인하는 플로우도 포함(그동안 개발자 본인 기기로만 테스트,
  이번 버전부터 전체 사용자 대상으로 오픈)
- 🐛 방문 지역 집계 로직을 라이딩 단위로 재설계 — 같은 장소를 서로 다른 날 각각
  방문/확인해도 물리적 거리만으로 하나로 합쳐지지 않고 정확히 별도 횟수로 집계
  되도록 수정
- 📊 "이번 달 정비비" 카드를 월별 통계에서 **정비 이력** 화면으로 이동, 정비 이력에도
  월 단위 이동 버튼을 추가해 해당 월 기록만 보이도록 개편
- 🆙 앱 업데이트 배너 개선 — 업데이트 버튼을 누른 뒤 "요청 중…" → "다운로드 중 N%"
  → "재시작" 순으로 진행 상태가 보이도록 수정 (기존에는 다운로드가 진행되는 동안
  아무 안내 없이 배너가 멈춰 있어 정상 동작 여부를 알 수 없었음). 취소/실패 시에는
  다시 "업데이트" 상태로 자동 복구

## v3.0.5 (versionCode 27) — 2026-08-03

- 🐛 베트남어 화면 섹션 제목/모달 제목 폰트 불일치 수정 — Bebas Neue 폰트가 일부
  베트남어 성조 부호 글자(Ả, Ầ, Ỡ 등)의 글리프를 갖고 있지 않아 그 글자만 시스템
  기본 폰트로 자동 대체되어 한 줄 안에서 폰트가 섞여 보이던 문제. `.sec-title`/
  `.modal-title`을 Inter로 통일해서 항상 일관되게 렌더링되도록 수정
- 💾 기기 변경 시 데이터 보호 강화 — Android 자동 백업(`allowBackup`)을 다시 활성화하고,
  설정 화면에 자동 백업 안내 문구 추가 (기존 수동 JSON 백업/복원은 그대로 유지)
- 📊 월별 통계에 "이번 달 정비비" 집계 타일 추가 — 정비 이력에 입력한 비용을 해당
  월·차량 기준으로 자동 합산해서 표시

## v3.0.4 (versionCode 26) — 2026-08-02

- 🎨 EN/VN 섹션 제목 대소문자 통일 — "Recent Service"/"Bảo dưỡng gần đây" 등 나중에
  추가된 섹션 제목들이 소문자로 남아있어 "MY BIKES"/"XE CỦA TÔI" 같은 기존 제목들과
  섞여 들쭉날쭉해 보이던 것을 전부 대문자로 통일

## v3.0.3 (versionCode 25) — 2026-08-02

- 🐛 **v3.0.2 수정의 진짜 원인 추가 수정**: 라이딩 중 언어 전환 시 홈 화면이 텅 빈 채로
  굳는 버그가 v3.0.2(폰트 로컬 번들링) 이후에도 실기기 재현 테스트에서 남아있는 것을
  발견. 원격 디버깅(CDP)으로 실시간 재현한 결과 진짜 원인은 `_sosMotionStart()`가
  `RidingPlugin.addListener(...).then(...)`을 호출하는데, 페이지 전환 직후 네이티브
  브릿지가 아직 완전히 재연결되지 않은 시점엔 `addListener()`가 Promise 대신 핸들을
  동기적으로 반환해서 `.then is not a function` 예외가 잡히지 않은 채 스크립트 전체
  실행을 중단시키는 것이었음(그 뒤에 있던 `window.load` 리스너 등록 자체가 안 됨 →
  `renderDash()` 영구 미실행). Promise/동기 반환 둘 다 처리하도록 수정
- 🛠 `window.load` 초기화 단계 전체를 개별적으로 오류 격리(`safe()` 래퍼)하도록 강화 —
  한 단계 실패가 이후 단계(특히 `renderDash()`) 전체를 막지 못하게 함
- 실기기 원격 디버깅으로 라이딩 중 언어 전환 시나리오 재현·수정·검증 완료

## v3.0.2 (versionCode 24) — 2026-08-02

- 🐛 **중대 수정**: Google Fonts를 외부 CDN(`@import`)으로 불러오던 방식이 원인이 되어,
  라이딩 중 신호가 약해진 상태로 언어를 전환하면 앱 스크립트 실행 자체가 멈춰
  홈 화면/라이딩 상태 표시가 텅 비거나 멈춘 채로 굳는 문제 발견 및 수정.
  → 폰트를 앱에 로컬로 번들링(Bebas Neue/Inter/JetBrains Mono, latin+vietnamese
  서브셋)해서 네트워크 상태와 무관하게 항상 즉시 렌더링되도록 변경
- 🐛 라이딩 시작 후 특정 타이밍에 상단 라이딩 상태 표시줄의 제목과 부제가 서로 다른
  상태를 보여주는(예: "대기중" 제목 + "감지 활성" 부제) 불일치 수정 — GPS 업데이트마다
  전체를 재동기화하도록 구조 변경

## v3.0.1 (versionCode 23) — 2026-08-01

- 🎨 앱 전반 타이포그래피 정비 — 화면마다 들쭉날쭉하던 폰트 크기(11~19px 무작위
  혼용)를 통일된 스케일로 재정렬. 카드 타이틀/본문/캡션/라벨 계층 명확화
- 🛠 전역 버그 수정: `.btn-sm`(작은 버튼)가 오히려 기본 버튼보다 크게 렌더링되던
  문제, 입력창/드롭다운 폰트가 과도하게 크던 문제 등
- 🔘 버튼 스타일 통일 — 수정/삭제 버튼 아이콘 제거 및 박스 스타일 통일, 우측 정렬,
  주요 액션 버튼 색상 채움으로 클릭 가능함을 명확히 표시
- KO/EN/VN 3개 언어 모두 동일하게 반영

## v3.0 (versionCode 22) — 2026-07-29

- 🔧 경고등 확인(AI) 기능 신설 — 계기판 사진 촬영 시 Claude Vision이 경고등을
  분석해 의미/가능한 원인/심각도(즉시 정차 필요·정비소 방문 권장·정상)를 안내.
  더보기 메뉴 및 소모품 탭 배너에서 진입
- 🔍 소모품 "점검 완료(교체 안 함)" 기능 추가 — 점검만 하고 교체는 안 한 경우,
  주기를 리셋하지 않고 원하는 만큼만 연장 기록 가능 (예: 스파크플러그 청소만 한 경우)
- 🚨 충격/낙차 감지 상태머신을 네이티브(RidingService)로 이전 — 백그라운드에서
  WebView가 suspend되어도 감지가 멈추지 않도록 안정성 개선
- 📍 GPS 위치 정확도 필터 추가 — 저정확도 GPS 샘플로 인한 라이딩 경로 튐/최고속도
  오탐 현상 수정
- ⛽ 한국 사용자에게는 유가 정보 카드 자동 숨김 (베트남 유가라 한국에서는 불필요)
- 🎨 라이딩 위젯 색상/크기 조정, 앱 첫 사용법 안내(온보딩) 화면 최신 UI로 갱신
- fix: 이용약관/개인정보처리방침 페이지 로고 표시 오류 수정

## v2.6 (versionCode 21) — 2026-07-28

- ⛽ 유가 정보(Fuel Price) 기능 신설 — VietnamNet/MOIT 기반 E5 RON92·RON95 가격,
  전일 대비 증감 표시 홈 화면 카드 추가
- 🎴 캐릭터 카드 공유 기능 신설 — 라이딩 기록과 무관하게 캐릭터+한마디 문구만
  공유 가능
- 🧑‍💼 캐릭터 15종(회사원 편) 추가, 캐릭터 선택에 라이딩/회사 탭 구분 추가
- ⚡ 카드 생성 속도 개선 — 캐릭터 이미지 선택 시점 프리로드 + 렌더링 해상도
  조정으로 카드 생성 대기시간 대폭 단축
- 🎨 공유 카드 레이아웃 개선 — 캐릭터 이미지 확대, 로고 위치 고정, 여백 정리
- fix: 한마디 문구를 비워두면 예시 문구 대신 공백으로 유지

## v2.5 (versionCode 20) — 2026-07-24

- 🗞 바이크 소식(브랜드 뉴스) 기능 신설 — Honda/Yamaha/Kawasaki/Suzuki/NHTSA/베트남
  등록청/EU Safety Gate/아세안데일리 8개 소스 자동 수집, 카테고리 필터, KO/EN/VN
- 🏠 홈 화면 라이딩 시작/종료 위젯 추가
- 📤 월별 통계 날짜 상세 공유 기능 추가
- 🎨 캐릭터 이미지 재디자인, char_13~18 신규 추가
- fix: 최고속도 계산에 GPS 속도 정확도 기반 노이즈 필터 추가
- fix: 소모품 알림이 누락되던 버그 수정 (`toSchedule` 선언 누락)

Play Store 게재용 노트: `release-notes/whatsnew-*.txt`
