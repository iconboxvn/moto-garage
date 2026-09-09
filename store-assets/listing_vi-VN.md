# Play Store 등록정보 초안 — 베트남어 (vi-VN)

> 2026-09-09 작성. Play Console → 스토어 등록정보 → 언어 "Tiếng Việt (vi-VN)" 에 입력.
> 여기 넣는 "앱 이름"은 **스토어 노출명**(로케일별)이라 `strings.xml` / `capacitor.config.json`
> 의 앱 이름 `Ridemate`(절대 변경 금지)와는 별개다. KO/EN도 이미 로케일별로 다르게 넣어둠.
> 글자 수는 추정치 — Play Console 입력창이 실시간으로 세어주니 최종은 거기서 확인.

---

## 1. 앱 이름 (Tên ứng dụng) — 최대 30자

**현행 유지 권장:**
```
Ridemate: Bảo dưỡng xe máy
```
(약 25자. "bảo dưỡng xe máy" = 핵심 검색어라 그대로 두는 게 맞음)

대안:
- `Ridemate: Nhắc bảo dưỡng xe` (약 27자 — "nhắc" 검색어 포함)
- `Ridemate: Sổ bảo dưỡng xe máy` (약 29자 — "sổ xe" 계열 노림)

---

## 2. 짧은 설명 (Mô tả ngắn) — 최대 80자

Play 검색에서 제목 다음으로 가중치 높음. 아래 중 택1 (Play Console에서 글자 수 확인 후 조정):

**A (권장):**
```
Nhắc lịch thay nhớt, sổ bảo dưỡng & chi phí, nhật ký hành trình và SOS va chạm.
```

**B (유가 강조):**
```
Nhắc bảo dưỡng xe máy, sổ chi phí sửa xe, giá xăng hôm nay và cảnh báo va chạm SOS.
```

**C (짧고 안전하게):**
```
Sổ bảo dưỡng xe máy: nhắc thay nhớt, chi phí sửa xe, nhật ký chuyến đi, SOS va chạm.
```

---

## 3. 자세한 설명 (Mô tả đầy đủ) — 최대 4000자

```
Ridemate giúp bạn quản lý chiếc xe máy và đi lại an toàn hơn — hoàn toàn miễn phí.

Bạn hay quên lịch thay nhớt? Không nhớ lần trước thay lọc gió, má phanh hay nhông xích là khi nào? Ridemate ghi lại toàn bộ lịch sử bảo dưỡng và nhắc bạn trước khi tới hạn, để xe bền hơn và tiết kiệm xăng hơn.

🔧 NHẮC BẢO DƯỠNG & SỔ CHI PHÍ
• Theo dõi chu kỳ thay nhớt, lọc gió, má phanh, nhông xích, bugi, dầu phanh…
• Nhắc theo số km đã đi hoặc theo thời gian — thông báo vào 8 giờ sáng
• Ghi lại chi phí mỗi lần sửa xe và tổng hợp chi phí bảo dưỡng theo tháng
• Xuất "phiếu lịch sử bảo dưỡng" dạng PDF — rất tiện khi bán lại xe

🛰 NHẬT KÝ HÀNH TRÌNH
• Tự động ghi quãng đường, tốc độ và lộ trình của mỗi chuyến đi
• Thống kê theo tháng, xem lại những nơi bạn đã ghé
• Không cần đăng nhập, không cần tạo tài khoản

🆘 CẢNH BÁO VA CHẠM SOS
• Khi phát hiện va chạm mạnh lúc đang chạy xe, ứng dụng hiển thị đếm ngược 60 giây
• Nếu bạn không huỷ, ứng dụng tự gửi tin nhắn kèm vị trí cho người thân mà bạn đã chọn trước
• Bạn cũng có thể tự bấm nút SOS bất cứ lúc nào

⛽ GIÁ XĂNG VIỆT NAM
• Xem giá xăng E5 RON92 và RON95 mới nhất ngay trên màn hình chính
• Hiển thị mức tăng/giảm so với kỳ điều chỉnh trước, kèm ngày giờ áp dụng

🗞 TIN XE MÁY
• Tin triệu hồi (recall), xe mới, cải tiến kỹ thuật và chính sách giao thông từ Honda, Yamaha, Suzuki, Kawasaki, VinFast và nhiều hãng khác
• Các cảnh báo an toàn được làm nổi bật trong danh sách

🚔 TIỆN ÍCH KHÁC
• Tra cứu phạt nguội — mở sẵn trang CSGT với biển số xe của bạn
• Hướng dẫn nhận biết các đèn cảnh báo trên đồng hồ xe
• Nhắc hạn bảo hiểm xe

📴 DÙNG ĐƯỢC KHI SÓNG YẾU
Dữ liệu được lưu ngay trên máy của bạn, mở là chạy — kể cả khi mạng chập chờn.

🌐 3 NGÔN NGỮ
Tiếng Việt · English · 한국어

Ridemate không thu thập thông tin cá nhân của bạn để quảng cáo. Số điện thoại người thân dùng cho SOS chỉ được lưu trên máy của bạn.

Tải Ridemate và bắt đầu quản lý chiếc xe máy của bạn ngay hôm nay.
```

---

## 4. 그래픽 / 스크린샷 캡션 (선택)

스크린샷 자체에 얹는 짧은 카피 (베트남어 스크린샷 교체 시):
1. `Nhắc bảo dưỡng trước khi tới hạn` (홈)
2. `Chu kỳ thay nhớt, lọc gió, má phanh…` (소모품)
3. `Lịch sử bảo dưỡng — xuất PDF khi bán xe` (정비이력)
4. `SOS tự gửi vị trí cho người thân` (SOS)
5. `Giá xăng & tin triệu hồi xe máy` (유가/소식)

---

## 5. 반영 시 체크리스트

- [ ] vi-VN 스토어 등록정보에 위 3개 필드 입력 (Play Console가 글자 수 실시간 표시 — 초과 시 짧은 설명부터 조정)
- [ ] KO/EN 등록정보도 같은 구조로 키워드 보강 여부 검토
- [ ] "데이터 보안" 섹션과 설명이 일치하는지 확인 (SMS/위치 = 기기 내 저장, 광고 수집 없음)
- [ ] 베트남어 스크린샷 5장 교체 (`store-assets/screenshots/vi_*.png`)
- [ ] 변경 후 `RELEASE_NOTES.md`에 등록정보 변경 기록 (기존 관행)
