# Tài Liệu Kỹ Thuật: Khắc Phục Triệt Để Lỗi Tràn Chiều Ngang & Mất Góc Trái Màn Hình POS Di Động (Mobile POS Layout Clipping Fix)

## 1. Bản Chất & Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

### 1.1. Hiện Tượng Gặp Phải
Khi người dùng truy cập màn hình POS bán hàng trên thiết bị di động (hoặc chế độ giả lập Device Toolbar trong DevTools), toàn bộ nội dung của trang bị dồn/trôi lệch sang phía bên trái:
- **Hàng sản phẩm cột 1 (bên trái)**: Bị cắt cụt góc trái (ví dụ: `"Còn 19 hộp"` thành `"n 19 hộp"`, `"Bánh ChocoPie"` thành `"h ChocoPie"`, `"32.000 đ"` thành `"000 đ"`).
- **Thanh tìm kiếm & thanh điều hướng (Navbar)**: Logo và biểu tượng kính lúp bị đẩy sát hoặc tràn ra ngoài mép trái của khung nhìn màn hình.
- **Phía bên phải**: Lại xuất hiện khoảng đệm (padding ~10-15px) bình thường.

### 1.2. Cơ Chế Lỗi Trong CSS Grid & Flexbox
1. **Ràng buộc `1fr` trong CSS Grid (`repeat(2, 1fr)`)**:
   - Theo quy chuẩn W3C, đơn vị `1fr` trong CSS Grid tương đương `minmax(auto, 1fr)`. Giá trị `auto` này tính toán kích thước thu nhỏ tối thiểu (`min-content`) dựa trên các thành phần con bên trong.
   - Bên trong thẻ sản phẩm có các phần tử chứa nhãn mã hàng (`product_code`) với thuộc tính `white-space: nowrap`. Khi một sản phẩm có mã dài (như `BRAND-NEW-UNIQUE-CODE-1789965324910` hoặc `BANH-CHOCORE-01`), `min-content` buộc cột của Grid phải nở rộng ra vượt quá kích thước nửa màn hình.
2. **Thiếu `min-width: 0` trên các Flex & Grid Items**:
   - Mặc định các phần tử flex và grid item có `min-width: auto`. Khi không được đặt `min-width: 0`, chúng không thể co nhỏ hơn nội dung con, gây hiện tượng vỡ khung ngang (horizontal overflow).
3. **Cơ chế cuộn ngang tự động của trình duyệt di động**:
   - Khi tổng chiều rộng của `.pos-product-grid` hoặc `.pos-controls-container` vượt quá `100vw`, trang bị sinh ra thanh cuộn ngang ngầm. Khi người dùng chạm vuốt tay trên màn hình cảm ứng theo góc hơi chéo, trình duyệt lập tức trượt ngang khung nhìn sang phải ~30-40px, dẫn đến toàn bộ mép trái bị cắt mất khỏi tầm nhìn.
4. **Vite Hot Module Replacement (HMR) trên Windows**:
   - Trình theo dõi tệp tin mặc định của Vite không tự động bắt các thay đổi sau khi switch git branch trên Windows nếu không cấu hình `usePolling`.

---

## 2. Các Giải Pháp Kỹ Thuật Đã Triển Khai

### 2.1. Ép Ràng Buộc Cột Grid Không Vượt Quá Khung Hình (`index.css`)
Thay thế `repeat(2, 1fr)` bằng cấu trúc `minmax(0, 1fr)` tuyệt đối an toàn:
```css
/* POS Product Grid */
.pos-product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
@media (max-width: 640px) {
  .pos-product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
    width: 100% !important;
    max-width: 100% !important;
  }
}

.product-card {
  min-width: 0 !important;
  max-width: 100% !important;
  width: 100% !important;
  box-sizing: border-box !important;
  overflow: hidden;
}
```

### 2.2. Khóa Tràn Chiều Ngang Cấp Hệ Thống (Strict Horizontal Containment)
Đảm bảo tất cả các container từ cấp gốc `html, body` đến `.main-content`, `.pos-layout-wrapper`, `.pos-catalog-scroll` đều có `overflow-x: hidden` và `max-width: 100vw`:
- `html, body, #root`: `max-width: 100vw; overflow-x: hidden; position: relative;`
- `.app-layout`: `max-width: 100vw; min-width: 0; overflow-x: hidden;`
- `.main-content`: `min-width: 0; max-width: 100%; width: 100%; overflow-x: hidden;`
- `.pos-catalog-scroll`: `max-width: 100%; min-width: 0; overflow-x: hidden !important;`

### 2.3. Loại Bỏ Các Ràng Buộc Kích Thước Tối Thiểu Cố Định (`PosPage.jsx`)
- Thay thế inline `minWidth: '160px'` trên `.pos-search-wrapper` thành `minWidth: 0` để thanh tìm kiếm co giãn linh hoạt trên mọi kích thước màn hình nhỏ.
- Thêm `wordBreak: 'break-word'`, `minWidth: 0`, `maxWidth: '100%'` vào cụm tên món và mã sản phẩm để chức năng `ellipsis` hoạt động chuẩn xác 100% mà không đẩy bung thẻ hàng.

### 2.4. Bật Cơ Chế Polling Cho Vite Dev Server (`vite.config.js`)
Thêm `watch: { usePolling: true, interval: 100 }` vào `server` trong `vite.config.js` để đảm bảo mọi thay đổi mã nguồn luôn được Vite cập nhật tức thì tới trình duyệt mà không bị lỡ nhịp.

---

## 3. Kiểm Thử & Xác Nhận Chất Lượng

1. **Frontend Production Build**:
   ```bash
   npm run build
   ```
   Kết quả: **Biên dịch thành công 100% trong 552ms, 0 lỗi cảnh báo.**

2. **Automated Backend Test Suite**:
   ```bash
   node test_suite.js
   ```
   Kết quả: **43/43 bài kiểm thử đạt PASS 100%.**
