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

Hệ thống cung cấp sẵn file [database.sql](file:///c:/grocery_store/backend/database.sql) độc lập hoàn chỉnh:

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

### Cách 1: Sử dụng Render Blueprint (Khuyên dùng - Nhanh nhất)
1. Đăng nhập vào [Render Dashboard](https://dashboard.render.com).
2. Chọn **New +** -> **Blueprint**.
3. Kết nối kho GitHub `HoangHuynh26/grocery_store`.
4. Render sẽ tự động đọc file `render.yaml` ở thư mục gốc và chuẩn bị toàn bộ cấu hình.
5. Điền giá trị cho các biến môi trường được yêu cầu (đặc biệt là `DATABASE_URL` từ Neon).
6. Nhấn **Apply**.

### Cách 2: Tạo Thủ Công Web Service
1. Chọn **New +** -> **Web Service**.
2. Chọn kho lưu trữ GitHub `HoangHuynh26/grocery_store`.
3. Cấu hình dịch vụ:
   - **Name**: `grocery-pos-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health` hoặc `/health`
4. **Cấu hình Biến Môi Trường (Environment Variables)**:
   | Tên Biến Môi Trường | Giá Trị Mẫu | Mô Tả |
   |:---|:---|:---|
   | `NODE_ENV` | `production` | Bật chế độ tối ưu hiệu năng Node.js & cookie bảo mật |
   | `PORT` | `5000` | Render tự động cấp hoặc để 5000 (Backend lắng nghe trên 0.0.0.0) |
   | `DATABASE_URL` | *(Dán chuỗi kết nối Neon)* | Chuỗi kết nối PostgreSQL từ Neon Console |
   | `JWT_SECRET` | *(Chuỗi ngẫu nhiên 64 ký tự)* | Khóa bí mật ký Access Token |
   | `REFRESH_TOKEN_SECRET` | *(Chuỗi ngẫu nhiên 64 ký tự)* | Khóa bí mật ký Refresh Token |
   | `CLIENT_URL` | `https://ten-du-an.vercel.app` | URL Frontend trên Vercel để cấu hình CORS |
   | `GEMINI_API_KEY` | *(Khóa API từ Google AI Studio)* | Kích hoạt AI Trợ lý kinh doanh, Voice & Vision |

---

## 4. Triển Khai Frontend Lên Vercel (https://vercel.com)

1. Đăng nhập vào [Vercel Dashboard](https://vercel.com).
2. Nhấn **Add New...** -> **Project** -> Chọn kho GitHub `HoangHuynh26/grocery_store`.
3. Cấu hình dự án:
   - **Root Directory**: Chọn `frontend` (hoặc để mặc định `./` vì đã có sẵn file `vercel.json` ở root hỗ trợ).
   - **Framework Preset**: `Vite`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Cấu hình Biến Môi Trường (Environment Variables)**:
   | Tên Biến Môi Trường | Giá Trị Mẫu | Mô Tả |
   |:---|:---|:---|
   | `VITE_API_URL` | `https://grocery-store-ss76.onrender.com/api` | URL Backend Render (hỗ trợ có hoặc không có `/api`) |
5. Nhấn **Deploy**.

---

## 4B. Triển Khai Frontend Lên Netlify (https://netlify.com)

1. Đăng nhập vào [Netlify Dashboard](https://app.netlify.com).
2. Nhấn **Add new site** -> Chọn **Import an existing project**.
3. Kết nối với kho GitHub `HoangHuynh26/grocery_store`.
4. Cấu hình tự động thông qua file `netlify.toml` có sẵn:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. **Cấu hình Biến Môi Trường (Site configuration -> Environment variables)**:
   | Tên Biến Môi Trường | Giá Trị Mẫu | Mô Tả |
   |:---|:---|:---|
   | `VITE_API_URL` | `https://grocery-store-ss76.onrender.com/api` | URL Backend Render |
6. Nhấn **Deploy grocery-store**.
7. Hệ thống đã tích hợp sẵn file `frontend/public/_redirects` và `netlify.toml`, bảo đảm toàn bộ SPA routing không bao giờ bị lỗi 404 khi làm mới trang!

---

## 5. Tài Khoản Quản Trị Mặc Định (Mật khẩu: Admin@123)

- **Super Admin**: `admin` hoặc `admin@grocerystore.vn` / Mật khẩu: `Admin@123`
- **Thu ngân**: `nhanvien1` hoặc `staff1@grocerystore.vn` / Mật khẩu: `Admin@123`

---

## 6. Các Điểm Tối Ưu Hóa Kỹ Thuật Đã Áp Dụng Cho Vercel & Render

1. **CORS Linh Hoạt & An Toàn**:
   - Backend tự động nhận diện tất cả các tên miền con của Vercel (`*.vercel.app`) bao gồm cả Preview Deployments và Production Domain.
   - Hỗ trợ đầy đủ `credentials: true` và preflight `OPTIONS` requests.
2. **Cross-Site Cookies & Fallback Token Refresh**:
   - Trên môi trường `production`, cookie refresh token được gắn cờ `sameSite: 'none'` và `secure: true`.
   - Bổ sung cơ chế dự phòng truyền `refreshToken` qua request body nếu trình duyệt của người dùng kích hoạt chặn cookie bên thứ ba (như Safari ITP hoặc Chrome Incognito).
3. **Chuẩn Hóa URL Tự Động (Foolproof URL Normalizer)**:
   - Frontend tự động phát hiện và thêm đuôi `/api` chuẩn xác dù người dùng điền `https://xyz.onrender.com` hay `https://xyz.onrender.com/api/`.
4. **Realtime WebSockets (Socket.IO Gateway)**:
   - Socket client tự động kết nối trực tiếp đến backend Render thông qua URL trích xuất từ `VITE_API_URL`, hỗ trợ chuyển đổi mượt mà giữa WebSocket và Polling.
5. **Cấu Hình Root Fallback Vercel (`vercel.json`)**:
   - Cho phép người dùng deploy trực tiếp từ root repository mà không bị lỗi thiếu file build hoặc sai thư mục đầu ra.

