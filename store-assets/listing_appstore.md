# App Store 등록정보 초안 — KO / EN / VI

> 2026-10-13 작성. App Store Connect → 앱 → 앱 정보 / iOS 앱 버전 페이지에 입력.
> Play 등록정보(`listing_vi-VN.md`)와 구조는 같지만 **iOS v1 범위에 맞춰 낙차 감지·자동 SOS 문자·홈 위젯 문구를 모두 뺐다**.
> 없는 기능을 쓰면 심사 2.3.1(정확한 메타데이터)로 거절되므로, iOS에 기능이 추가되기 전엔 넣지 말 것.
> 앱 이름 `Ridemate`(코드상 이름, 변경 금지)와 스토어 노출명은 별개. 베트남어는 원어민 검수 필요.
> **설명에 이모지 금지** — 2026-10-19 App Store Connect가 🔧🛰🆘⛽ 등 섹션 아이콘을 "유효하지 않은 문자"로 거부해서 모두 뺐음(Play 등록정보엔 그대로 둬도 됨).
> 글자 수는 `python3`로 셌음(공백 포함). 키워드는 100바이트 제한이라 한글·베트남어는 바이트 기준으로 확인할 것.

## 공통 정보

| 항목 | 값 |
|---|---|
| 번들 ID | `com.iconbox.motogarage` |
| SKU | `ridemate-ios` |
| 기본 언어 | 베트남어 (사용자 98%가 베트남) — 한국어·영어는 현지화로 추가 |
| 카테고리 | 1차 **유틸리티**, 2차 **내비게이션** |
| 가격 | 무료, 앱 내 구입 없음 |
| 개인정보 처리방침 URL | KO `https://ridemate.iconbox.com/privacy_policy/` · EN `.../privacy_policy_en/` · VI `.../privacy_policy_vn/` (2026-10-13 세 주소 모두 200 확인) |
| 지원 URL | `https://ridemate.iconbox.com/` (로케일별 `/en/` `/vn/`) |
| 마케팅 URL | 지원 URL과 동일 |
| 저작권 | `2026 iconbox` |
| 연령 등급 | 4+ (설문 전 항목 "없음") |
| 암호화 | Info.plist `ITSAppUsesNonExemptEncryption = NO` 반영됨(ebe45d2) — 업로드마다 묻지 않음 |
| 스크린샷 | `store-assets/screenshots/ios/` 6.9" 1320×2868, 언어별 5장 (홈→소모품→정비이력→SOS 시트→소식) |

### 심사 메모 (App Review Information → Notes, 영어)
```
Ridemate is a motorcycle maintenance and riding log app. No account or login is required — all data is stored on the device.
- Location is used only while recording a ride (distance/speed) and to show the user's coordinates in the SOS sheet. Background location continues a ride that the user started; it stops when the ride ends.
- Camera/photos are used to identify dashboard warning lights; the photo is sent to our server for analysis and is not stored.
- Push notifications: one daily weather/maintenance summary, which can be turned off in Settings.
- The SOS sheet only opens the phone dialer (tel: links) and shows emergency numbers and phrases; the app does not call or message anyone automatically.
```

---

## 한국어 (ko)

**이름** (30자)
```
Ridemate: 바이크 정비 관리
```
**부제** (30자)
```
교체 알림·정비 기록·주행 기록
```
**프로모션 텍스트** (170자, 심사 없이 수시 변경 가능)
```
엔진오일·브레이크패드 교체 시기를 놓치지 마세요. 정비 기록과 비용, 라이딩 기록을 한 곳에서 관리하고 오전 8시에 알림을 받으세요.
```
**키워드** (100바이트)
```
오토바이,스쿠터,엔진오일,소모품,교체주기,정비일지,주행거리,리콜,유가
```
**설명**
```
Ridemate는 오토바이를 오래, 안전하게 타기 위한 정비 관리 앱입니다. 회원가입 없이 바로 쓸 수 있어요.

엔진오일 교체 언제 했더라? 브레이크패드는 아직 괜찮나? Ridemate가 정비 기록을 모아 두고 교체 시기 전에 미리 알려드립니다.

[교체 알림과 정비 기록]
• 엔진오일, 에어필터, 브레이크패드, 체인, 점화플러그, 브레이크액 등의 교체 주기 관리
• 주행거리나 기간 기준으로 오전 8시에 알림
• 정비할 때마다 비용을 기록하고 연간·월별 정비비 확인
• 중고로 팔 때 보여줄 수 있는 정비 이력 PDF

[라이딩 기록]
• 주행거리, 속도, 경로를 자동으로 기록
• 월별 통계와 달력으로 라이딩 이력 확인
• 주행거리계에 라이딩 거리를 자동 반영

[사고 현장 도움]
• 구급차·경찰 등 긴급번호를 바로 전화
• 현지어로 "사람이 다쳤어요" 같은 도움 요청 문장을 소리로 재생
• 현재 위치 좌표 복사, 가까운 병원 찾기
• 병원에 보여줄 의료 정보 카드

[베트남 유가]
• E5 RON92·RON95 최신 가격과 지난 조정 대비 증감을 홈 화면에

[바이크 소식]
• 혼다·야마하·스즈키·가와사키·빈패스트 등의 리콜, 신차, 정책 소식
• 안전·리콜 소식은 눈에 띄게 표시

[그 밖에]
• 계기판 경고등을 사진으로 찍으면 무슨 뜻인지 알려줘요
• 교통위반(벌금) 조회 — 베트남 교통경찰(CSGT) 조회 페이지 바로 열기
• 보험 만료일 알림
• 매일 아침 날씨와 정비 상태 요약 알림(설정에서 끌 수 있음)

데이터는 기기에 저장돼 인터넷이 약해도 잘 열립니다.
한국어 · English · Tiếng Việt
```

---

## English (en-US)

**Name** (30)
```
Ridemate: Motorcycle Service
```
**Subtitle** (30)
```
Oil change reminders, ride log
```
**Promotional text** (170)
```
Never miss an oil change or brake pad swap again. Keep your service history, costs and rides in one place, with a reminder at 8 AM.
```
**Keywords** (100 bytes)
```
motorbike,scooter,maintenance,mileage,odometer,brake,tire,recall,fuel price,vietnam,logbook
```
**Description**
```
Ridemate helps you keep your motorcycle in good shape and ride safer. No sign-up needed.

When did you last change the oil? Are the brake pads still OK? Ridemate keeps your service history and reminds you before parts are due.

REMINDERS & SERVICE HISTORY
• Track oil, air filter, brake pads, chain, spark plug, brake fluid and more
• Reminders by distance or time, delivered at 8 AM
• Log the cost of every service and see yearly and monthly totals
• Export a service-history PDF to show buyers when you sell

RIDE LOG
• Automatically records distance, speed and route
• Monthly stats and a calendar of your rides
• Ride distance is added to your odometer automatically

HELP AT AN ACCIDENT SCENE
• Call ambulance and police numbers with one tap
• Play help phrases out loud in Vietnamese
• Copy your coordinates and find nearby hospitals
• A medical info card to show hospital staff

VIETNAM FUEL PRICES
• Latest E5 RON92 and RON95 prices and the change since the last adjustment, right on the home screen

BIKE NEWS
• Recalls, new models and policy news from Honda, Yamaha, Suzuki, Kawasaki, VinFast and more
• Safety and recall news stands out

ALSO
• Snap a dashboard warning light to learn what it means
• Traffic fine lookup — opens Vietnam's official CSGT lookup page
• Insurance expiry reminders
• A daily morning summary of weather and maintenance status (can be turned off)

Your data stays on your phone, so the app opens fast even with a weak signal.
English · Tiếng Việt · 한국어
```

---

## Tiếng Việt (vi)

**Tên** (30)
```
Ridemate: Bảo dưỡng xe máy
```
**Phụ đề** (30)
```
Nhắc thay nhớt, giá xăng
```
**Văn bản quảng cáo** (170)
```
Không còn quên lịch thay nhớt hay má phanh. Lưu lịch sử bảo dưỡng, chi phí và hành trình ở một nơi, nhận nhắc nhở lúc 8 giờ sáng.
```
**Từ khóa** (100 byte)
```
xe may,nhot,ma phanh,lop,chi phi,hanh trinh,trieu hoi,honda,yamaha,phat nguoi
```
**Mô tả**
```
Ridemate giúp bạn quản lý chiếc xe máy và đi lại an toàn hơn — miễn phí, không cần đăng ký tài khoản.

Bạn hay quên lịch thay nhớt? Không nhớ lần trước thay lọc gió, má phanh hay nhông xích là khi nào? Ridemate ghi lại toàn bộ lịch sử bảo dưỡng và nhắc bạn trước khi tới hạn.

NHẮC BẢO DƯỠNG & SỔ CHI PHÍ
• Theo dõi chu kỳ thay nhớt, lọc gió, má phanh, nhông xích, bugi, dầu phanh…
• Nhắc theo số km hoặc theo thời gian — thông báo lúc 8 giờ sáng
• Ghi lại chi phí mỗi lần sửa xe, xem tổng chi phí theo năm và theo tháng
• Xuất phiếu lịch sử bảo dưỡng dạng PDF — tiện khi bán lại xe

NHẬT KÝ HÀNH TRÌNH
• Tự động ghi quãng đường, tốc độ và lộ trình mỗi chuyến đi
• Thống kê theo tháng và lịch các ngày đã chạy xe
• Tự cộng quãng đường vào số km của xe

HỖ TRỢ KHI GẶP TAI NẠN
• Gọi cấp cứu, cảnh sát chỉ với một chạm
• Phát câu nhờ giúp đỡ bằng giọng nói
• Sao chép tọa độ hiện tại, tìm bệnh viện gần nhất
• Thẻ thông tin y tế để đưa cho nhân viên bệnh viện

GIÁ XĂNG VIỆT NAM
• Giá E5 RON92 và RON95 mới nhất cùng mức tăng/giảm so với kỳ trước, ngay trên màn hình chính

TIN XE MÁY
• Tin triệu hồi, xe mới và chính sách giao thông từ Honda, Yamaha, Suzuki, Kawasaki, VinFast và nhiều hãng khác
• Tin an toàn, triệu hồi được làm nổi bật

TIỆN ÍCH KHÁC
• Chụp ảnh đèn cảnh báo trên đồng hồ xe để biết ý nghĩa
• Tra cứu phạt nguội — mở sẵn trang CSGT
• Nhắc hạn bảo hiểm xe
• Thông báo buổi sáng về thời tiết và tình trạng bảo dưỡng (có thể tắt)

Dữ liệu lưu ngay trên máy, mở là chạy — kể cả khi mạng yếu.
Tiếng Việt · English · 한국어
```

---

## 앱 개인정보 라벨 (App Privacy) 초안

`ios/App/App/PrivacyInfo.xcprivacy`와 일치시킬 것. 추적(Tracking) **없음**.

| 데이터 유형 | 용도 | 사용자와 연결 | 근거 |
|---|---|---|---|
| 위치 → 정확한 위치 | 앱 기능 | 아니요 | 날씨 알림용 좌표를 서버(notifyTargets)에 보냄 |
| 사용자 콘텐츠 → 사진 또는 비디오 | 앱 기능 | 아니요 | 경고등 사진 AI 분석(저장 안 함) |
| 사용 데이터 → 제품 상호작용 | 분석 | 아니요 | Firebase Analytics |
| 식별자 → 기기 ID | 앱 기능, 분석 | 아니요 | 알림 대상 deviceId·FCM 토큰, Analytics |

⚠️ 확인 필요: Apple 기준상 기기 ID와 묶인 데이터는 "사용자와 연결"로 보는 해석도 있음 — 매니페스트(Linked=false)와 라벨을 같은 쪽으로 맞추되, 제출 전 한 번 더 검토.

## 제출 전 체크리스트
- [ ] 개발자 프로그램 승인 → App Store Connect에 앱 생성(이름 가용 여부 확인 — "Ridemate: …"가 이미 있으면 대안 필요)
- [ ] 위 필드 KO/EN/VI 입력, 스크린샷 업로드(6.9"만 올리면 작은 기기는 자동 축소)
- [ ] 개인정보 처리방침 URL이 실제로 열리는지 확인
- [ ] 베트남어 문구 원어민 검수 — 2026-10-19 사용자 결정: 일단 이 초안으로 올리고 출시 후 검수(프로모션 텍스트는 심사 없이, 나머지는 다음 버전 제출 때 수정)
- [x] iOS 실기기에서 PDF 내보내기·경고등 사진·날씨 푸시·백그라운드 라이딩 확인(2026-10-19, TestFlight 3.1.2(2)) — 설명문 그대로 유지
- [x] 스토어 노출 이름 KO/EN/VI 확정(2026-10-19)
