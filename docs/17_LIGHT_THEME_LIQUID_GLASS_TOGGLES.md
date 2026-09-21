# TÀI LIỆU KỸ THUẬT: GIAO DIỆN SÁNG (LIGHT THEME), THANH ĐIỀU HƯỚNG LIQUID GLASS & CÔNG TẮC TOGGLE SWITCH

---

## 1. TỔNG QUAN & YÊU CẦU
Theo yêu cầu người dùng, phiên bản Phase 22 nâng cấp toàn diện trải nghiệm thị giác và tương tác:
1. **Chuyển toàn bộ giao diện thành màu sáng (Light Theme)**:
   - Thay thế toàn bộ theme tối (Dark navy) bằng hệ thống màu sáng lấy cảm hứng từ Apple macOS & iOS.
   - Nền sáng tinh tế (`#f8fafc`), bề mặt thẻ trắng sứ (`#ffffff`), đường viền sắc nét nhẹ nhàng (`#e2e8f0`), phân cấp văn bản đá phiến Slate (`#0f172a`, `#334155`, `#64748b`) với độ tương phản cao, chống mỏi mắt.
2. **Nâng cao Navbar & tạo hiệu ứng Liquid Glass Apple**:
   - Tăng chiều cao thanh điều hướng: Desktop Header nâng lên **68px**, Mobile Bottom Nav nâng lên **72px** (hỗ trợ thêm `env(safe-area-inset-bottom)` cho iPhone/iPad).
   - Kính lỏng Frosted Glass: `backdrop-filter: blur(28px) saturate(190%)`, nền bán trong suốt `rgba(255, 255, 255, 0.82)`, viền phản quang `1px solid rgba(226, 232, 240, 0.85)` và bóng đổ ambient mềm mại.
   - Viên nang Active (Capsule Pill): Các mục đang chọn có nền viên nang kính ngọc lục bảo `rgba(5, 150, 105, 0.09)` kèm hiệu ứng nảy mượt mà `cubic-bezier(0.4, 0, 0.2, 1)`.
3. **Chuyển các trạng thái 2 dạng thành nút công tắc Toggle Switch**:
   - Xây dựng component chuẩn iOS `ToggleSwitch.jsx` với đường rãnh viên nang và con trượt tròn trượt êm ái.
   - Ứng dụng ngay trên bảng **Quản Lý Danh Mục** (`/categories`): Gạt để bật / tắt trạng thái "Đang hoạt động" ↔ "Tạm ngưng".
   - Ứng dụng trên bảng **Quản Trị Viên & Nhân Sự** (`/admins`): Gạt để "Hoạt động" ↔ "Tạm khóa" tài khoản.
   - **Quy tắc ngoại lệ**: Các trạng thái có từ 3 dạng trở lên (như Hóa đơn: `PAID`, `CANCELLED`, `PENDING` hay Mô hình dự báo: `PENDING_EVALUATION`, `EVALUATED`, `ARCHIVED`) **giữ nguyên dạng Badge màu**, không dùng toggle switch để tránh nhầm lẫn logic đa trạng thái.

---

## 2. HỆ THỐNG DESIGN TOKENS MỚI (LIGHT MODE & APPLE GLASS)

Tại `frontend/src/index.css`:

```css
:root {
  --font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  
  /* Bảng màu chủ đạo ngọc lục bảo (Emerald) */
  --primary: #059669;
  --primary-hover: #047857;
  --primary-light: rgba(5, 150, 105, 0.08);
  --primary-border: rgba(5, 150, 105, 0.25);

  /* Bề mặt & Nền sáng tinh tế Apple */
  --bg-main: #f8fafc;
  --bg-card: #ffffff;
  --bg-card-hover: #f1f5f9;
  --bg-card-secondary: #f1f5f9;
  --bg-input: #ffffff;
  --border-color: #e2e8f0;
  --border-focus: #059669;

  /* Phân cấp Typography Slate */
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --text-muted: #64748b;
  --text-inverse: #ffffff;

  /* Màu trạng thái trên nền sáng */
  --success: #059669;
  --success-bg: #ecfdf5;
  --warning: #d97706;
  --warning-bg: #fffbeb;
  --danger: #dc2626;
  --danger-bg: #fef2f2;
  --info: #2563eb;
  --info-bg: #eff6ff;

  /* Kích thước Navbar được nâng cao */
  --sidebar-width: 260px;
  --mobile-nav-height: 72px; /* Tăng từ 64px */
  --header-height: 68px;     /* Tăng từ 64px */

  /* Bóng đổ mờ cao cấp */
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 4px 16px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 16px 36px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.06);
}
```

---

## 3. THÀNH PHẦN NÚT CÔNG TẮC TOGGLE SWITCH (`ToggleSwitch.jsx`)

File: `frontend/src/components/common/ToggleSwitch.jsx`

### Thông số kỹ thuật:
- **Rãnh trượt (Track)**: Bo tròn pill `9999px`, kích thước `44px x 24px` (size md) hoặc `34px x 20px` (size sm).
  - Khi `checked = true`: Nền xanh ngọc lục bảo `var(--primary)`, bóng ánh sáng `0 2px 8px rgba(5, 150, 105, 0.25)`.
  - Khi `checked = false`: Nền xám nhạt `#cbd5e1`.
- **Con trượt (Thumb)**: Vòng tròn trắng tinh khiết với bóng nổi 3D `0 2px 5px rgba(0, 0, 0, 0.18)`.
- **Hiệu ứng trượt**: `transform: translateX(translate)` với gia tốc lò xo Apple `cubic-bezier(0.34, 1.56, 0.64, 1)` thời lượng 0.28s.
- **Tiếp cận (Accessibility)**: `role="switch"`, `aria-checked`, hỗ trợ phím Space / Enter, ngăn chặn hiện tượng nổi bọt sự kiện (Event Bubbling) khi nằm trong hàng của bảng.

---

## 4. TÍCH HỢP NÚT GẠT TRẠNG THÁI VÀO CÁC TRANG

### 4.1. Trang Quản Lý Danh Mục (`CategoriesPage.jsx`)
- Thay thế nhãn Badge cố định thành:
  ```jsx
  <ToggleSwitch
    checked={cat.is_active}
    onChange={() => handleToggleCategoryStatus(cat)}
    label={cat.is_active ? 'Đang hoạt động' : 'Tạm ngưng'}
    size="sm"
  />
  ```
- Cơ chế **Optimistic UI Update**: Cập nhật trạng thái hiển thị trên state React ngay lập tức khi nhân viên click, đồng thời gọi API `PUT /api/categories/:id` chạy nền. Nếu server báo lỗi, state sẽ tự động rollback.

### 4.2. Trang Quản Trị Viên & Nhân Sự (`AdminsPage.jsx`)
- Cột "Trạng Thái" của bảng tài khoản người dùng:
  ```jsx
  <ToggleSwitch
    checked={u.is_active}
    onChange={() => handleToggleStatus(u)}
    label={u.is_active ? 'Hoạt động' : 'Tạm khóa'}
    size="sm"
  />
  ```
- Thao tác gạt nút sẽ gọi trực tiếp `handleToggleStatus(u)` để khóa / mở khóa tài khoản an toàn.

### 4.3. Các Trạng Thái Giữ Nguyên Dạng Badge (Không Dùng Toggle)
- **Hóa đơn** (`InvoicesPage.jsx`): Trạng thái 3 dạng `PAID` (Đã thanh toán), `CANCELLED` (Đã hủy), `PENDING` (Chờ thanh toán).
- **Dự báo doanh thu** (`Forecasts`): Trạng thái `PENDING_EVALUATION`, `EVALUATED`, `ARCHIVED`.
- **Tồn kho**: `Hết hàng`, `Sắp hết`, `Còn hàng`.
- **Vai trò người dùng**: `SUPER_ADMIN`, `ADMIN`, `STAFF`.

---

## 5. THIẾT KẾ APPLE LIQUID GLASS NAVBAR

### 5.1. Mobile Bottom Bar (`MobileBottomNav.jsx`)
- Nâng độ cao lên **72px** kết hợp `env(safe-area-inset-bottom)`.
- Hiệu ứng Liquid Glass cao cấp:
  ```css
  background-color: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  border-top: 1px solid rgba(226, 232, 240, 0.85);
  box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.07), 0 -1px 2px rgba(15, 23, 42, 0.04);
  ```
- Drawer "Thêm" mở từ dưới lên với bán kính bo cong 24px và kính mờ chống chói.

### 5.2. Desktop Header Bar (`Navbar.jsx`)
- Chiều cao **68px**, thanh thoát, cố định trên đầu trang (`position: sticky`).
- Kính lỏng tương thích hoàn hảo với cuộn trang nội dung bên dưới.

### 5.3. Desktop Sidebar (`Sidebar.jsx`)
- Nền kính bán trong suốt `rgba(255, 255, 255, 0.88)` tạo cảm giác nhẹ nhàng, hiện đại.
- Các mục kích hoạt (Active Item) được viền màu ngọc lục bảo và nền mềm mại.

---

## 6. BẢO ĐẢM CHẤT LƯỢNG & KIỂM THỬ

- **Kiểm thử đóng gói Frontend**: `npm run build` hoàn thành với **0 lỗi** (645ms).
- **Kiểm thử tự động Backend**: `node test_suite.js` đạt **38/38 bài kiểm thử vượt qua thành công (100% PASS)**.
