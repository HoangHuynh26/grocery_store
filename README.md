# 🛒 Grocery Store Management & Smart POS System

Hệ thống Quản lý Bán hàng Tạp hóa & POS Thông minh tích hợp Trợ lý Trí tuệ Nhân tạo (AI Agent), Thị giác Máy tính nhận diện bao bì & mã vạch camera, Dự báo doanh thu chuỗi thời gian, và Khóa tương tranh chống âm kho đạt chuẩn ACID.

---

## 🌐 Đường Dẫn Truy Cập Trực Tuyến (Public Cloud Live Links)

Hệ thống đã được cấu hình chế độ **Dual-Mode** thông minh, cho phép chạy song song cả trên máy tính cục bộ (Localhost) lẫn trên đám mây công cộng (Public Cloud) cùng lúc mà không cần thay đổi code:

| Thành Phần | Dịch Vụ Lưu Trữ | Đường Dẫn Công Khai (Public Live Link) | Trạng Thái |
|:---|:---|:---|:---|
| **Frontend Web App (Netlify)** | Netlify Edge CDN | [https://taphoasonhien.netlify.app](https://taphoasonhien.netlify.app) | 🟢 Live / Sẵn sàng |
| **Frontend Web App (Vercel)** | Vercel Edge Global CDN | [https://grocery-store-app.vercel.app](https://grocery-store-app.vercel.app) | 🟢 Live / Sẵn sàng |
| **Backend API Gateway** | Render Cloud Web Service | [https://grocery-store-ss76.onrender.com](https://grocery-store-ss76.onrender.com) | 🟢 Live / Sẵn sàng |
| **Kiểm Tra Sức Khỏe API** | Render Cloud Web Service | [https://grocery-store-ss76.onrender.com/api/health](https://grocery-store-ss76.onrender.com/api/health) | 🟢 200 OK |
| **Cơ Sở Dữ Liệu** | Neon Serverless PostgreSQL | Singapore AWS Region (`ap-southeast-1`) | ⚡ SSL Encrypted |

---

## 🔑 Tài Khoản Quản Trị & Dùng Thử Mẫu (Demo Credentials)

| Vai Trò | Tên Đăng Nhập | Email | Mật Khẩu | Quyền Hạn |
|:---|:---|:---|:---|:---|
| **Super Admin** | `admin` | `admin@grocerystore.vn` | `Admin@123` | Toàn quyền quản trị hệ thống, nhân viên, cấu hình, báo cáo & kiểm toán |
| **Thu ngân (Admin)** | `nhanvien1` | `staff1@grocerystore.vn` | `Admin@123` | Thao tác bán hàng POS, quét mã QR/Bao bì AI, in hóa đơn, quản lý kho |

---

## 🚀 Hướng Dẫn Chạy Cục Bộ (Local Development)

### 1. Khởi động Backend (Cổng 5000)
```bash
cd backend
npm install
npm run dev
```
Máy chủ API sẽ lắng nghe tại: `http://localhost:5000`

### 2. Khởi động Frontend (Cổng 5173)
```bash
cd frontend
npm install
npm run dev
```
Giao diện ứng dụng sẽ chạy tại: `http://localhost:5173`

> Khi chạy tại `localhost`, ứng dụng tự động kích hoạt Proxy nội bộ kết nối trực tiếp đến Backend máy tính của bạn. Khi truy cập qua domain Vercel, ứng dụng tự động chuyển hướng kết nối sang Backend Render công khai.

---

## 📚 Bộ Tài Liệu Kỹ Thuật Chi Tiết (Documentation)

Toàn bộ tài liệu kiến trúc, thuật toán và API được lưu tại thư mục [docs/](./docs/README.md):
- [12_DEPLOYMENT_DEVOPS.md](./docs/12_DEPLOYMENT_DEVOPS.md): Hướng dẫn chi tiết triển khai lên Render, Vercel và Neon.
- [01_DATABASE_ARCHITECTURE.md](./docs/01_DATABASE_ARCHITECTURE.md): Kiến trúc dữ liệu PostgreSQL, ràng buộc ACID.
- [05_POS_CONCURRENCY_CONTROL.md](./docs/05_POS_CONCURRENCY_CONTROL.md): Thuật toán khóa dòng `SELECT FOR UPDATE` & Idempotency.
- [09_AI_LANGGRAPH_ASSISTANT.md](./docs/09_AI_LANGGRAPH_ASSISTANT.md): Kiến trúc Trợ lý AI và xử lý ngôn ngữ tự nhiên.
- [10_AI_REVENUE_FORECASTING.md](./docs/10_AI_REVENUE_FORECASTING.md): Mô hình toán học ML Holt-Winters dự báo doanh thu.
