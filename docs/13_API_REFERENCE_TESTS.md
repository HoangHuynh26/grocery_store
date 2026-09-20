# 13. Danh Mục REST API & Bộ Kiểm Thử Tự Động (API Reference & Test Suite)

Tài liệu này tổng hợp toàn bộ các điểm cuối API (Endpoints) của hệ thống cùng hướng dẫn chi tiết về bộ kiểm thử tự động đã được xác minh đạt 100% (22/22 tests).

---

## 1. Quy Ước Phản Hồi Chung (Standard Response Format)

Mọi API của hệ thống đều tuân thủ cấu trúc JSON nhất quán:

### Phản hồi thành công (HTTP 200 / 201):
```json
{
  "success": true,
  "message": "Thông báo thành công bằng tiếng Việt",
  "data": { ... }
}
```

### Phản hồi lỗi (HTTP 400 / 401 / 403 / 404 / 409 / 429 / 500):
```json
{
  "success": false,
  "message": "Mô tả nguyên nhân lỗi rõ ràng",
  "code": "MA_LOI_HE_THONG"
}
```

---

## 2. Danh Mục Các Điểm Cuối REST API (API Endpoints Catalog)

### 2.1 Nhóm Xác thực (`/api/auth`)
| Phương Thức | Endpoint | Yêu Cầu Header | Quyền Hạn | Mô Tả |
|:---|:---|:---|:---:|:---|
| `POST` | `/api/auth/login` | None | Public | Đăng nhập tài khoản, trả về JWT Access Token & HttpOnly Cookie |
| `POST` | `/api/auth/refresh-token` | Cookie `refreshToken` | Public | Cấp mới Access Token khi token cũ hết hạn |
| `POST` | `/api/auth/logout` | Bearer Token | Authenticated | Đăng xuất, hủy phiên và xóa cookie |
| `GET` | `/api/auth/me` | Bearer Token | Authenticated | Lấy thông tin cá nhân của phiên đăng nhập hiện tại |

### 2.2 Nhóm Quản lý Người dùng (`/api/users`)
| Phương Thức | Endpoint | Yêu Cầu Header | Quyền Hạn | Mô Tả |
|:---|:---|:---|:---:|:---|
| `GET` | `/api/users` | Bearer Token | `SUPER_ADMIN` | Lấy danh sách tất cả tài khoản nhân viên & admin |
| `POST` | `/api/users` | Bearer Token | `SUPER_ADMIN` | Tạo tài khoản nhân viên mới kèm mã hóa mật khẩu |
| `PUT` | `/api/users/:id` | Bearer Token | `SUPER_ADMIN` | Cập nhật thông tin, chức vụ hoặc đổi mật khẩu |
| `PATCH` | `/api/users/:id/toggle-active` | Bearer Token | `SUPER_ADMIN` | Khóa hoặc mở khóa tài khoản |

### 2.3 Nhóm Danh mục & Hàng hóa (`/api/categories` & `/api/products`)
| Phương Thức | Endpoint | Yêu Cầu Header | Quyền Hạn | Mô Tả |
|:---|:---|:---|:---:|:---|
| `GET` | `/api/categories` | Bearer Token | Mọi vai trò | Lấy danh sách danh mục hàng hóa |
| `POST` | `/api/categories` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Tạo danh mục mới |
| `GET` | `/api/products` | Bearer Token | Mọi vai trò | Tìm kiếm, lọc sản phẩm theo tên, danh mục, phân trang |
| `GET` | `/api/products/lookup` | Bearer Token | Mọi vai trò | Tra cứu tức thời theo Barcode hoặc QR Token |
| `POST` | `/api/products` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Tạo sản phẩm mới (có tùy chọn sinh mã QR) |
| `PUT` | `/api/products/:id` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Cập nhật thông tin giá và sản phẩm |
| `DELETE` | `/api/products/:id` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Ngừng kinh doanh sản phẩm (Soft Delete) |

### 2.4 Nhóm Kho hàng (`/api/inventory`)
| Phương Thức | Endpoint | Yêu Cầu Header | Quyền Hạn | Mô Tả |
|:---|:---|:---|:---:|:---|
| `POST` | `/api/inventory/import` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Nhập thêm hàng vào kho |
| `POST` | `/api/inventory/adjust` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Điều chỉnh tồn kho (kiểm kê, hỏng) kèm lý do bắt buộc |
| `GET` | `/api/inventory/transactions` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Tra cứu lịch sử biến động kho |
| `GET` | `/api/inventory/low-stock` | Bearer Token | Mọi vai trò | Lấy danh sách sản phẩm chạm ngưỡng tồn kho tối thiểu |

### 2.5 Nhóm Bán hàng POS (`/api/pos`)
| Phương Thức | Endpoint | Yêu Cầu Header | Quyền Hạn | Mô Tả |
|:---|:---|:---|:---:|:---|
| `POST` | `/api/pos/checkout` | `Idempotency-Key`, Bearer Token | Mọi vai trò | Thanh toán giỏ hàng với khóa dòng `SELECT FOR UPDATE` |

### 2.6 Nhóm Hóa đơn (`/api/invoices`)
| Phương Thức | Endpoint | Yêu Cầu Header | Quyền Hạn | Mô Tả |
|:---|:---|:---|:---:|:---|
| `GET` | `/api/invoices` | Bearer Token | Mọi vai trò | Lọc danh sách hóa đơn theo ngày, thu ngân |
| `GET` | `/api/invoices/:id` | Bearer Token | Mọi vai trò | Lấy chi tiết từng món trong hóa đơn |
| `PUT` | `/api/invoices/:id/adjust` | Bearer Token | `SUPER_ADMIN` | Điều chỉnh hóa đơn tài chính có kiểm toán |

### 2.7 Nhóm Báo cáo & AI Assistant (`/api/analytics` & `/api/ai`)
| Phương Thức | Endpoint | Yêu Cầu Header | Quyền Hạn | Mô Tả |
|:---|:---|:---|:---:|:---|
| `GET` | `/api/analytics/dashboard` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Lấy chỉ số KPI, doanh thu hôm nay, hôm qua, tăng trưởng |
| `GET` | `/api/analytics/revenue` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Biểu đồ doanh thu theo giờ, 7 ngày, 30 ngày, tháng, năm |
| `POST` | `/api/ai/chat` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Hỏi đáp trợ lý kinh doanh AI LangGraph bằng tiếng Việt |
| `GET` | `/api/ai/forecast` | Bearer Token | `ADMIN`, `SUPER_ADMIN` | Lấy kết quả dự báo doanh thu Machine Learning Holt-Winters |

### 2.8 Nhóm Kiểm toán (`/api/audit-logs`)
| Phương Thức | Endpoint | Yêu Cầu Header | Quyền Hạn | Mô Tả |
|:---|:---|:---|:---:|:---|
| `GET` | `/api/audit-logs` | Bearer Token | `SUPER_ADMIN` | Tra cứu nhật ký kiểm toán Before/After và địa chỉ IP |

---

## 3. Bộ Kiểm Thử Tự Động (Automated Test Suite - `backend/test_suite.js`)

Hệ thống đi kèm một bộ kiểm thử tích hợp chuyên sâu, kiểm chứng trực tiếp các tình huống tương tranh phức tạp:

### Lệnh chạy kiểm thử:
```bash
cd backend
node test_suite.js
```

### Danh mục 22 bài kiểm thử tự động đã được kiểm định:
1. **[1] Kiểm tra Health Check**: Xác minh kết nối DB và trạng thái HTTP 200.
2. **[2] Xác thực sai mật khẩu**: Đảm bảo từ chối mật khẩu không đúng.
3. **[3] Đăng nhập Super Admin**: Xác thực tài khoản quản trị cấp cao.
4. **[4] Đăng nhập Cashier Staff**: Xác thực tài khoản thu ngân.
5. **[5] Phân quyền RBAC (Chặn Staff)**: Thu ngân không được truy cập danh sách tài khoản.
6. **[6] Phân quyền RBAC (Cho phép Super Admin)**: Super Admin truy cập toàn quyền.
7. **[7] Lấy danh mục sản phẩm**: Kiểm tra định dạng dữ liệu trả về.
8. **[8] Tìm sản phẩm có mã QR**: Kiểm tra trường `qr_token`.
9. **[9] Tra cứu nhanh bằng mã QR**: Kiểm tra tốc độ tra cứu qua chỉ mục B-Tree.
10. **[10] Khởi tạo sản phẩm test tương tranh**: Đặt số lượng tồn ban đầu là 5 cái.
11. **[11] Kiểm thử tương tranh hai luồng cùng lúc (Race Condition)**: Thu ngân A (mua 4 cái) đối đầu Thu ngân B (mua 3 cái) tại cùng một mili giây.
12. **[12] Chặn bán vượt kho**: Xác minh chỉ có đúng 1 giao dịch được thành công, giao dịch thứ hai bị từ chối.
13. **[13] Kiểm tra thông báo lỗi thiếu hàng**: Nhận đúng mã lỗi `INSUFFICIENT_STOCK`.
14. **[14] Kiểm tra tồn kho không bao giờ âm**: Tồn kho còn đúng 1 cái (chặn tuyệt đối số âm).
15. **[15] Thanh toán với Idempotency Key**: Giao dịch đầu tiên thành công.
16. **[16] Bấm trùng thanh toán (Duplicate Request)**: Giao dịch thứ hai trả về HTTP 200 mà không gây lỗi.
17. **[17] Cờ nhận diện trùng lặp**: Xác minh cờ `isDuplicate = true`.
18. **[18] Kiểm tra không trừ kho 2 lần**: Trả về đúng hóa đơn ban đầu mà không tạo hóa đơn mới.
19. **[19] Truy vấn nhật ký kiểm toán**: Lấy danh sách audit log.
20. **[20] Kiểm tra lưu vết CREATE_INVOICE**: Xác minh hành vi tạo hóa đơn được ghi vết đầy đủ.
21. **[21] Kiểm tra dự báo doanh thu AI**: Thuật toán Holt-Winters tính toán thành công.
22. **[22] Kiểm tra trợ lý AI tiếng Việt**: LangGraph Agent trả lời chính xác câu hỏi doanh thu.

👉 **Kết quả thực tế**: `TEST SUMMARY: 22 PASSED, 0 FAILED`.
