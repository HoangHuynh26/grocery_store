# HƯỚNG DẪN PUBLIC HỆ THỐNG LÊN VERCEL (FRONTEND) VÀ RENDER (BACKEND)

Tài liệu hướng dẫn chi tiết từng bước đưa hệ thống **Grocery Store POS & Management System** lên môi trường Internet thực tế miễn phí bằng:
- **Frontend (Giao diện POS Mobile-First)**: Triển khai trên **Vercel** (Global Edge CDN, chứng chỉ SSL/HTTPS tự động, tốc độ tải trang cực nhanh).
- **Backend (API & Socket.IO)**: Triển khai trên **Render Web Service** (Node.js runtime, tự động restart).
- **Database (Cơ sở dữ liệu)**: Triển khai trên **Render Managed PostgreSQL** (vùng Singapore độ trễ thấp tối ưu cho Việt Nam).

---

## 1. Cấu Trúc Đã Chuẩn Bị Cho Deployment

Dự án đã được cấu hình sẵn các tệp phục vụ triển khai tự động:
- `render.yaml`: Blueprint Infrastructure-as-Code giúp tạo Database PostgreSQL và Web Service trên Render chỉ với 1 click.
- `frontend/vercel.json`: Cấu hình định tuyến Single Page Application (SPA rewrite) trên Vercel, tránh lỗi 404 khi F5 tải lại trang.
- `frontend/src/services/api.js`: Đã hỗ trợ tự động kết nối qua biến môi trường `VITE_API_URL`.
- `frontend/src/contexts/SocketContext.jsx`: Đã hỗ trợ kết nối realtime qua `VITE_SOCKET_URL`.
- `.gitignore`: Đã loại trừ toàn bộ `node_modules`, file môi trường bí mật `.env` và dữ liệu database cục bộ.

---

## 2. Bước 1: Đẩy Mã Nguồn Lên GitHub

Nếu bạn chưa đưa code lên GitHub:

1. Mở terminal tại thư mục dự án `c:\grocery_store`.
2. Tạo commit cho toàn bộ mã nguồn:
   ```bash
   git add .
   git commit -m "feat: complete grocery store pos system with vercel and render deployment configs"
   ```
3. Tạo một repository mới trên GitHub (ví dụ đặt tên: `grocery_store`).
4. Liên kết và đẩy code lên:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<tai-khoan-github-cua-ban>/grocery_store.git
   git push -u origin main
   ```

---

## 3. Bước 2: Triển Khai Backend & Database Lên Render

### Cách 1: Sử dụng Render Blueprint (Khuyên dùng - 1 Click Tự Động)

1. Đăng nhập vào [Render.com](https://render.com).
2. Tại trang Dashboard, chọn **New +** -> **Blueprint**.
3. Kết nối với tài khoản GitHub và chọn repository `grocery_store`.
4. Render sẽ tự động đọc tệp `render.yaml` trong repo và hiển thị:
   - Dịch vụ Web: `grocery-pos-backend` (Node.js)
   - Cơ sở dữ liệu: `grocery-pos-db` (PostgreSQL)
5. Nhấn **Apply**.
6. Render sẽ tự động khởi tạo cơ sở dữ liệu PostgreSQL, liên kết chuỗi kết nối `DATABASE_URL`, tạo các khóa JWT ngẫu nhiên và build backend.
7. Khi triển khai xong, bạn sẽ nhận được một đường dẫn công khai (ví dụ: `https://grocery-pos-backend.onrender.com`).
8. Kiểm tra API bằng cách mở trên trình duyệt: `https://grocery-pos-backend.onrender.com/api/health`.

---

### Cách 2: Tạo Thủ Công Trên Render (Nếu không dùng Blueprint)

1. **Tạo Database PostgreSQL**:
   - Chọn **New +** -> **PostgreSQL**.
   - Name: `grocery-pos-db`
   - Database: `grocery_store`
   - User: `grocery_user`
   - Region: `Singapore`
   - Plan: `Free`
   - Nhấn **Create Database**, sau đó sao chép **Internal Database URL** (hoặc External Database URL).

2. **Tạo Web Service Backend**:
   - Chọn **New +** -> **Web Service**.
   - Chọn repository GitHub `grocery_store`.
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - Thêm các biến môi trường (**Environment Variables**):
     - `NODE_ENV`: `production`
     - `TZ`: `Asia/Ho_Chi_Minh`
     - `DATABASE_URL`: Dán chuỗi kết nối PostgreSQL vừa tạo ở trên.
     - `JWT_SECRET`: Nhập một chuỗi bí mật dài ngẫu nhiên.
     - `REFRESH_TOKEN_SECRET`: Nhập một chuỗi bí mật khác.
     - `CORS_ORIGIN`: `*`
   - Nhấn **Create Web Service**.

> [!NOTE]
> Khi Backend khởi động lần đầu trên Render, script `server.js` sẽ tự động chạy migration tạo toàn bộ bảng (`schema.sql`) và seed dữ liệu mẫu cùng tài khoản quản trị mặc định.

---

## 4. Bước 3: Triển Khai Frontend Lên Vercel

1. Đăng nhập vào [Vercel.com](https://vercel.com).
2. Tại Dashboard, nhấn **Add New...** -> **Project**.
3. Chọn repository `grocery_store` từ GitHub.
4. Tại phần **Configure Project**:
   - **Framework Preset**: Chọn `Vite` (mặc định Vercel sẽ tự nhận).
   - **Root Directory**: Bấm vào nút **Edit** và chọn thư mục `frontend`.
   - **Environment Variables**: Thêm 2 biến môi trường kết nối tới Render Backend:
     - `VITE_API_URL`: Nhập URL Backend Render kèm `/api` (Ví dụ: `https://grocery-pos-backend.onrender.com/api`).
     - `VITE_SOCKET_URL`: Nhập URL Backend Render (Ví dụ: `https://grocery-pos-backend.onrender.com`).
5. Nhấn **Deploy**.
6. Vercel sẽ tiến hành build trong khoảng 30-45 giây và cấp cho bạn một domain HTTPS miễn phí (ví dụ: `https://grocery-store.vercel.app`).

---

## 5. Bước 4: Kiểm Tra & Vận Hành Thực Tế

1. Truy cập vào đường link Vercel của bạn (ví dụ: `https://grocery-store.vercel.app`).
2. Màn hình đăng nhập xuất hiện:
   - **Super Admin**: `admin` / `Admin@123456`
   - **Thu ngân**: `nhanvien1` / `Staff@123456`
3. Thao tác trên thiết bị di động:
   - Mở camera điện thoại quét mã QR sản phẩm.
   - Thêm vào giỏ hàng và thực hiện thanh toán.
   - Đặt câu hỏi tự nhiên cho Trợ lý ảo AI ("Doanh thu hôm nay bao nhiêu?", "Dự đoán doanh thu tháng tới?").
4. Mọi giao dịch sẽ được đồng bộ thời gian thực (Realtime) qua Socket.IO và lưu trữ an toàn trong PostgreSQL trên Render.
