# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG: VERCEL (FRONTEND) + RENDER (BACKEND) + NEON (DATABASE)

Tài liệu hướng dẫn chi tiết từng bước đưa hệ thống **Grocery Store POS & Management System** lên môi trường Internet thực tế miễn phí bằng bộ ba công nghệ tối ưu:
- **Database (Cơ sở dữ liệu)**: Triển khai trên **Neon Serverless PostgreSQL** (https://neon.tech - Serverless, tự động sao lưu, phân nhánh dữ liệu, hỗ trợ SSL an toàn).
- **Backend (API & Socket.IO)**: Triển khai trên **Render Web Service** (Node.js runtime, kết nối trực tiếp tới Neon).
- **Frontend (Giao diện POS Mobile-First)**: Triển khai trên **Vercel** (Global Edge CDN, chứng chỉ SSL/HTTPS tự động, tốc độ tải trang cực nhanh).

---

## 1. Bước 1: Khởi Tạo Cơ Sở Dữ Liệu Trên Neon (https://neon.tech)

1. Đăng ký/Đăng nhập tài khoản miễn phí tại [Neon.tech](https://neon.tech).
2. Tạo một Project mới (ví dụ đặt tên: `grocery-store-pos`), chọn khu vực gần Việt Nam nhất (ví dụ: `AWS ap-southeast-1` - Singapore).
3. **Lấy chuỗi kết nối (Connection String)**:
   - Tại trang Dashboard của Neon, chọn **Connection Details**.
   - Chọn kiểu: `Postgres` hoặc `Node.js`.
   - Copy chuỗi kết nối dạng:
     ```text
     postgresql://neondb_owner:MatKhauCuaBan@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
     ```
4. **Khởi tạo dữ liệu vào Neon (2 cách đơn giản)**:
   - **Cách 1 (Nhanh nhất - Dùng Neon SQL Editor)**:
     - Mở mục **SQL Editor** trên giao diện Neon Console.
     - Mở tệp [database.sql](file:///c:/grocery_store/database.sql), copy toàn bộ nội dung và dán vào ô nhập lệnh.
     - Bấm nút **RUN** (Xanh lá). Trong 1 giây, toàn bộ 7 bảng, các chỉ mục, tài khoản quản trị và 12 sản phẩm kèm hình ảnh rõ nét sẽ được tạo sẵn sàng!
   - **Cách 2 (Dùng lệnh tự động từ Terminal dự án)**:
     - Mở tệp `backend/.env`, dán chuỗi kết nối vào dòng `DATABASE_URL=...`
     - Chạy lệnh:
       ```bash
       cd backend
       npm run db:neon:init
       ```

---

## 2. Bước 2: Triển Khai Backend Lên Render (https://render.com)

1. Đăng nhập vào [Render.com](https://render.com).
2. Chọn **New +** -> **Web Service**.
3. Kết nối với tài khoản GitHub và chọn repository `HoangHuynh26/grocery_store`.
4. Điền các thông số cơ bản:
   - **Name**: `grocery-pos-backend`
   - **Region**: `Singapore (Southeast Asia)`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. **Cấu hình Biến môi trường (Environment Variables)**:
   | Key | Value |
   |:---|:---|
   | `NODE_ENV` | `production` |
   | `TZ` | `Asia/Ho_Chi_Minh` |
   | `DATABASE_URL` | *(Dán chuỗi kết nối Neon PostgreSQL của bạn vào đây)* |
   | `JWT_SECRET` | *(Bấm Generate hoặc điền chuỗi ngẫu nhiên 64 ký tự)* |
   | `REFRESH_TOKEN_SECRET`| *(Bấm Generate hoặc điền chuỗi ngẫu nhiên 64 ký tự)* |
   | `CORS_ORIGIN` | `https://ten-du-an-cua-ban.vercel.app` *(hoặc tạm để `*`)* |
6. Bấm **Deploy Web Service**.
7. Khi Render build xong (khoảng 2 phút), bạn sẽ nhận được URL Backend (ví dụ: `https://grocery-pos-backend.onrender.com`).
8. Kiểm tra: Mở trình duyệt truy cập `https://grocery-pos-backend.onrender.com/api/health` -> Nhận kết quả `{"status":"OK","database":"CONNECTED"}`.

---

## 3. Bước 3: Triển Khai Frontend Lên Vercel (https://vercel.com)

1. Đăng nhập vào [Vercel.com](https://vercel.com).
2. Nhấn **Add New...** -> **Project**.
3. Import repository `HoangHuynh26/grocery_store` từ GitHub.
4. Cấu hình tại màn hình **Configure Project**:
   - **Framework Preset**: Chọn `Vite`.
   - **Root Directory**: Nhấn **Edit** và chọn thư mục `frontend`.
   - **Build and Output Settings**: Giữ mặc định (`npm run build` và thư mục `dist`).
5. **Environment Variables**:
   - Thêm biến `VITE_API_URL` với giá trị là URL Backend Render kèm `/api`:
     ```text
     https://grocery-pos-backend.onrender.com/api
     ```
   - Thêm biến `VITE_SOCKET_URL` (nếu cần socket trực tiếp):
     ```text
     https://grocery-pos-backend.onrender.com
     ```
6. Bấm **Deploy**.
7. Sau 1 phút, Vercel sẽ cấp tên miền HTTPS miễn phí (ví dụ: `https://grocery-store.vercel.app`).

---

## 4. Tài Khoản Quản Trị Mặc Định Sau Khi Triển Khai

| Tài Khoản / Email | Mật Khẩu | Quyền Hạn |
|:---|:---|:---|
| `admin` (`admin@grocerystore.vn`) | `Admin@123` | **Super Admin**: Toàn quyền cấu hình, nhân viên, điều chỉnh hóa đơn, xem báo cáo & kiểm toán |
| `nhanvien1` (`staff1@grocerystore.vn`) | `Admin@123` | **Thu ngân**: Thao tác bán hàng POS, quét mã QR, in hóa đơn, kiểm tra tồn kho |
