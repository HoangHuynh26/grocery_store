# 12. Hướng Dẫn Triển Khai Lên Render & Vercel (Production DevOps & Deployment)

Hệ thống được thiết kế theo kiến trúc tách rời (**Decoupled Client-Server**), cho phép triển khai tối ưu chi phí và hiệu năng:
- **Backend & Cơ sở dữ liệu PostgreSQL**: Triển khai trên nền tảng **Render**.
- **Frontend React SPA**: Triển khai trên mạng phân phối toàn cầu **Vercel Edge Network**.

---

## 1. Sơ Đồ Hạ Tầng Điện Toán Đám Mây (Cloud Architecture)

```mermaid
graph LR
    subgraph VercelCloud ["🌐 Vercel Edge Network (Global CDN)"]
        SPA["Frontend React SPA (Vite Production Bundle)"]
        Rewrite["vercel.json (SPA Client-Side Rewrites)"]
    end

    subgraph RenderCloud ["☁️ Render Cloud Platform"]
        WebService["🚀 Backend Node.js Web Service (grocery-pos-backend)"]
        ManagedDB[("🗄️ PostgreSQL Database (grocery-pos-db)")]
    end

    Users["📱 Người Dùng (Mobile / Desktop)"] -->|1. Tải HTML/JS/CSS (Siêu Nhanh)| VercelCloud
    SPA -->|2. Gọi REST API & WebSockets| WebService
    WebService -->|3. Kết nối an toàn (SSL)| ManagedDB
```

---

## 2. Triển Khai Backend & Database Lên Render

Hệ thống đã cấu hình sẵn bản thiết kế Blueprint [render.yaml](file:///c:/grocery_store/render.yaml) ở thư mục gốc:

### Các bước thực hiện:
1. Đăng nhập vào [Render Dashboard](https://dashboard.render.com).
2. Chọn **Blueprints** -> Nhấn **New Blueprint Instance**.
3. Chọn kho lưu trữ GitHub `HoangHuynh26/grocery_store`.
4. Render sẽ tự động phát hiện file `render.yaml` và khởi tạo song song 2 dịch vụ:
   - **PostgreSQL Database**: `grocery-pos-db` (PostgreSQL 16).
   - **Web Service**: `grocery-pos-backend` (Node.js runtime).
5. Tự động liên kết chuỗi kết nối `DATABASE_URL` từ Database sang Web Service.

### Danh sách biến môi trường Backend trên Render:
| Tên Biến Môi Trường | Giá Trị Mẫu | Mô Tả |
|:---|:---|:---|
| `NODE_ENV` | `production` | Bật chế độ tối ưu hiệu năng Node.js |
| `PORT` | `5000` | Cổng dịch vụ lắng nghe |
| `DATABASE_URL` | *(Render tự cấp)* | Chuỗi kết nối cơ sở dữ liệu PostgreSQL |
| `JWT_SECRET` | *(Chuỗi ngẫu nhiên 64 ký tự)* | Khóa bí mật ký Access Token |
| `JWT_REFRESH_SECRET` | *(Chuỗi ngẫu nhiên 64 ký tự)* | Khóa bí mật ký Refresh Token |
| `CLIENT_URL` | `https://ten-du-an-cua-ban.vercel.app` | URL Frontend trên Vercel để cấu hình CORS |
| `GEMINI_API_KEY` | *(Tùy chọn)* | Khóa API Google Gemini nếu muốn tăng cường AI |

---

## 3. Triển Khai Frontend Lên Vercel

Hệ thống đã cấu hình sẵn file [frontend/vercel.json](file:///c:/grocery_store/frontend/vercel.json) để xử lý định tuyến SPA (tránh lỗi 404 khi tải lại các trang con như `/pos`, `/inventory`, `/analytics`):

### Các bước thực hiện:
1. Đăng nhập vào [Vercel Dashboard](https://vercel.com).
2. Nhấn **Add New Project** -> Chọn kho GitHub `HoangHuynh26/grocery_store`.
3. Cấu hình cài đặt dự án (Project Settings):
   - **Root Directory**: Chọn thư mục `frontend`.
   - **Framework Preset**: Chọn `Vite`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Cấu hình Biến môi trường (Environment Variables):
   - `VITE_API_URL`: Điền URL Backend Render vừa tạo (ví dụ: `https://grocery-pos-backend.onrender.com/api`).
5. Nhấn **Deploy**. Sau khoảng 1 phút, Vercel sẽ cung cấp tên miền HTTPS miễn phí (ví dụ: `https://grocery-store.vercel.app`).

---

## 4. Kiểm Tra Sức Khỏe Sau Triển Khai (Post-Deployment Verification)

Sau khi hoàn tất, kiểm tra các điểm sau:
1. **API Health Check**: Truy cập `https://<backend-render-url>/api/health` -> Kết quả trả về `{"status":"OK","database":"CONNECTED"}`.
2. **Đăng nhập lần đầu**: Truy cập trang Vercel, đăng nhập bằng tài khoản Super Admin mặc định (`admin` / `Admin@123456`).
3. **Đổi mật khẩu**: Tiến hành đổi mật khẩu mới cho tài khoản quản trị để đảm bảo an toàn tuyệt đối.
