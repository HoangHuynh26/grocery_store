# 12. Hướng Dẫn Triển Khai Lên Neon, Render & Vercel (Production DevOps & Deployment)

Hệ thống được thiết kế theo kiến trúc tối ưu hiệu năng và độ ổn định cao:
- **Cơ sở dữ liệu (Database)**: Triển khai trên **Neon Serverless PostgreSQL** (https://neon.tech - Tốc độ cao, tự động scale, kết nối SSL, không phụ thuộc Docker).
- **Máy chủ ứng dụng (Backend)**: Triển khai trên **Render Web Service** (Node.js runtime, kết nối trực tiếp đến Neon).
- **Giao diện người dùng (Frontend)**: Triển khai trên **Vercel Edge Network** (Global CDN, chứng chỉ SSL/HTTPS tự động).

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
    end

    subgraph NeonCloud ["⚡ Neon Serverless PostgreSQL (neon.tech)"]
        NeonDB[("🗄️ Neon Cloud PostgreSQL (neondb)")]
    end

    Users["📱 Người Dùng (Mobile / Desktop)"] -->|1. Tải HTML/JS/CSS (Siêu Nhanh)| VercelCloud
    SPA -->|2. Gọi REST API & WebSockets| WebService
    WebService -->|3. Kết nối an toàn (SSL / Pooler)| NeonDB
```

---

## 2. Khởi Tạo Cơ Sở Dữ Liệu Neon (https://neon.tech)

Hệ thống cung cấp sẵn file [database.sql](file:///c:/grocery_store/database.sql) độc lập hoàn chỉnh:

### Các bước thực hiện:
1. Đăng ký tài khoản miễn phí tại [Neon.tech](https://neon.tech).
2. Tạo Project mới (chọn khu vực `AWS ap-southeast-1` - Singapore).
3. Lấy chuỗi kết nối (Connection String) từ Neon Console:
   ```text
   postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. **Nạp cấu trúc và dữ liệu mẫu**:
   - Mở mục **SQL Editor** trên Neon Console.
   - Mở file `database.sql`, copy toàn bộ và dán vào SQL Editor.
   - Nhấn **RUN**. Toàn bộ bảng, ràng buộc chống âm kho, chỉ mục và tài khoản quản trị sẽ được khởi tạo trong 1 giây!
   - Hoặc dán chuỗi kết nối vào `backend/.env` rồi chạy:
     ```bash
     cd backend
     npm run db:neon:init
     ```

---

## 3. Triển Khai Backend Lên Render (https://render.com)

1. Đăng nhập vào [Render Dashboard](https://dashboard.render.com).
2. Chọn **New +** -> **Web Service**.
3. Chọn kho lưu trữ GitHub `HoangHuynh26/grocery_store`.
4. Cấu hình dịch vụ:
   - **Name**: `grocery-pos-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. **Cấu hình Biến Môi Trường (Environment Variables)**:
   | Tên Biến Môi Trường | Giá Trị Mẫu | Mô Tả |
   |:---|:---|:---|
   | `NODE_ENV` | `production` | Bật chế độ tối ưu hiệu năng Node.js |
   | `PORT` | `5000` | Cổng dịch vụ lắng nghe |
   | `DATABASE_URL` | *(Dán chuỗi kết nối Neon)* | Chuỗi kết nối PostgreSQL từ Neon Console |
   | `JWT_SECRET` | *(Chuỗi ngẫu nhiên 64 ký tự)* | Khóa bí mật ký Access Token |
   | `REFRESH_TOKEN_SECRET` | *(Chuỗi ngẫu nhiên 64 ký tự)* | Khóa bí mật ký Refresh Token |
   | `CLIENT_URL` | `https://ten-du-an-cua-ban.vercel.app` | URL Frontend trên Vercel để cấu hình CORS |

---

## 4. Triển Khai Frontend Lên Vercel (https://vercel.com)

1. Đăng nhập vào [Vercel Dashboard](https://vercel.com).
2. Nhấn **Add New...** -> **Project** -> Chọn kho GitHub `HoangHuynh26/grocery_store`.
3. Cấu hình:
   - **Root Directory**: Chọn `frontend`.
   - **Framework Preset**: `Vite`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Cấu hình Biến môi trường:
   - `VITE_API_URL`: Điền URL Backend Render kèm `/api` (ví dụ: `https://grocery-pos-backend.onrender.com/api`).
5. Nhấn **Deploy**.

---

## 5. Tài Khoản Quản Trị Mặc Định

- **Super Admin**: `admin` / `Admin@123456`
- **Thu ngân**: `nhanvien1` / `Staff@123456`
