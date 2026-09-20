# Tài Liệu Kỹ Thuật: Tối Ưu Giao Diện Điện Thoại & Tự Động Tạo Mã Sản Phẩm

Hệ thống POS Quản lý Tạp hóa được thiết kế theo triết lý **Mobile-First & Ultra-Responsive**, tối ưu cho nhân viên và chủ cửa hàng thao tác trực tiếp trên điện thoại thông minh (iPhone, Android) với tốc độ cao, cùng cơ chế **tự động sinh mã sản phẩm và kiểm tra trùng lặp thời gian thực**.

---

## 1. Kiến Trúc Tối Ưu Giao Diện Điện Thoại (Mobile-First UI/UX)

### 1.1 Hỗ Trợ Safe-Area-Insets Toàn Diện
- Tích hợp thẻ meta viewport chuẩn Apple iOS & Android:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  ```
- Định nghĩa biến CSS và khoảng đệm an toàn tránh tai thỏ (Notch), Dynamic Island và thanh điều hướng cảm ứng ở đáy màn hình:
  ```css
  .main-content {
    padding-bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px) + 24px);
  }
  .mobile-bottom-nav {
    height: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  ```

### 1.2 Lưới POS 2 Cột Chuẩn Điện Thoại (`.pos-product-grid`)
- Trên màn hình lớn: lưới tự co giãn `repeat(auto-fill, minmax(180px, 1fr))`.
- Trên màn hình điện thoại (<= 640px): tự động chia đều **2 cột (`repeat(2, 1fr)`)**:
  - Thẻ sản phẩm hiển thị ảnh rõ nét, tên sản phẩm rút gọn 2 dòng, giá bán xanh ngọc đậm và nút bấm "+" tiện dụng.
  - Người dùng xem được từ 4 - 6 sản phẩm mỗi màn hình mà không cần cuộn quá nhiều.

### 1.3 Bảng Dữ Liệu Chống Bẹp Cột (`.table-responsive` & `.table-wide`)
- Cố định độ rộng tối thiểu cho các bảng quản lý (`min-width: 680px` - `780px`) và bật cuộn gia tốc phần cứng `-webkit-overflow-scrolling: touch;`.
- Đảm bảo các bảng nhiều cột (Sản phẩm, Hóa đơn, Tồn kho, Audit Log) không bao giờ bị dồn nén văn bản thành các chữ cái dọc.

### 1.4 Bố Cục POS Đa Chế Độ & Loại Bỏ Xung Đột Cuộn Kép
- **Trên Desktop (>= 1024px)**: Giữ nguyên bố cục chia đôi cố định (`.pos-layout-wrapper` cao `calc(100vh - var(--header-height))`), danh mục cuộn bên trái, giỏ hàng cố định bên phải.
- **Trên Mobile (< 1024px)**:
  - Loại bỏ hoàn toàn `height: 100vh` và `overflow-y: auto` lồng nhau. Toàn bộ trang cuộn tự nhiên theo trục dọc của điện thoại.
  - Vùng đệm chân trang linh hoạt: `padding-bottom: 120px` khi giỏ trống và `180px` khi thanh giỏ hàng nổi xuất hiện (`.pos-catalog-scroll.has-cart`), đảm bảo món hàng cuối cùng ("Nước suối") luôn cách thanh điều hướng đáy ít nhất 40px–60px, không bị che khuất.

### 1.5 Thanh Lọc Danh Mục Viên Thuốc Chống Cắt Nửa Chữ (`.category-pills-bar`)
- Ẩn hoàn toàn thanh cuộn ngang mặc định chiếm diện tích của trình duyệt (`scrollbar-width: none !important; ::-webkit-scrollbar { display: none !important; }`).
- Cố định chiều cao nút `.category-pill-btn` 38px, cho phép vuốt chạm ngang êm mượt mà không bị thanh cuộn trình duyệt đè cắt nửa thân chữ.

### 1.6 Tinh Gọn Cột Bảng Trên Màn Hình Nhỏ (`.hide-mobile` & `.show-mobile-only`)
- Tự động ẩn các cột thông tin phụ (Mã slug, Mô tả, Giá vốn, Mã QR, Thu ngân) trên màn hình `<= 640px`.
- Chuyển các thông tin phụ thành chú thích nhỏ nằm ngay dưới tên thực thể, giúp bảng dữ liệu luôn hiển thị 4 - 5 cột rõ ràng, không bị dồn ép.

### 1.7 Hộp Thoại & Form Nhập Liệu Co Giãn (`.form-grid-2`)
- Trên Desktop: Form chia 2 cột logic.
- Trên Mobile: Tự động xếp chồng 1 cột (`grid-template-columns: 1fr`), chiều cao tối đa `90dvh` / `94dvh`, các nút bấm lưu/hủy luôn hiển thị nổi trên bàn phím ảo.

---

## 2. Tính Năng Tự Động Sinh Mã Sản Phẩm & Kiểm Tra Trùng Thời Gian Thực

### 2.1 Thuật Toán Sinh Mã Tiếng Việt Chuẩn Hóa
Hệ thống sử dụng module `frontend/src/utils/codeGenerator.js`:
1. Loại bỏ toàn bộ dấu thanh và dấu mũ tiếng Việt (`á, à, ả, ã, ạ, đ, ê, ô, ư...`).
2. Thay thế khoảng trắng và ký tự đặc biệt bằng dấu gạch ngang `-`.
3. Chuyển đổi thành chữ IN HOA chuẩn mã vạch / SKU quốc tế.
4. Cắt tỉa độ dài tối đa 28 ký tự để hiển thị trọn vẹn trên tem nhãn in nhiệt.

**Ví dụ:**
- `"Nước ngọt Coca Cola lon 330ml"` ➔ `COCA-COLA-LON-330ML`
- `"Mì Hảo Hảo tôm chua cay"` ➔ `MI-HAO-HAO-TOM-CHUA-CAY`
- `"Dầu ăn Tường An 1 lít"` ➔ `DAU-AN-TUONG-AN-1-LIT`

### 2.2 Kiểm Tra Trùng Lặp Thời Gian Thực (Debounced API)
- **API Endpoint:** `GET /api/products/check-code?code={CODE}&excludeId={ID}`
- Khi người dùng nhập tên sản phẩm, hệ thống tự động điền mã gợi ý và kích hoạt kiểm tra trong 300ms.
- **Trường hợp mã hợp lệ**:
  - Hiển thị dấu tích xanh ✔️ *"Mã hợp lệ, có thể sử dụng"*.
- **Trường hợp mã đã tồn tại**:
  - Đổi viền ô nhập sang màu đỏ cảnh báo.
  - Hiển thị hộp thông báo lỗi chi tiết: ⚠️ *"Mã sản phẩm '[MÃ]' đã tồn tại (Sản phẩm: '[Tên]'). Vui lòng chọn hoặc đổi mã khác."*
  - Cung cấp nút tiện ích 1-chạm: **`+ Đổi mã (Thêm đuôi -01, -02)`**.
  - Khóa tiến trình gửi form nếu người dùng chưa sửa mã trùng.
