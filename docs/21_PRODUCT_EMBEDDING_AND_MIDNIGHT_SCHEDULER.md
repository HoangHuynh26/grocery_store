# Tài Liệu Kỹ Thuật: Tự Động Cập Nhật Embedding Sản Phẩm Khi Thêm Mới & Lịch Định Kỳ 12 Giờ Tối (Midnight Cron)

> **Mã tài liệu**: `21_PRODUCT_EMBEDDING_AND_MIDNIGHT_SCHEDULER.md`  
> **Phiên bản áp dụng**: v2.6.0 (Phase 26)  
> **Tác giả**: Đội ngũ Kỹ thuật & AI Grocery Store  
> **Trạng thái**: Production Ready  

---

## 1. Yêu Cầu Nghiệp Vụ (Requirements)

Người dùng yêu cầu cơ chế tự động hóa việc cập nhật Embedding cho sản phẩm theo 2 luồng:
1. **Luồng tức thời (Real-time Event-driven Trigger)**: Mỗi khi có một sản phẩm mới được thêm vào hệ thống (thông qua Quản lý sản phẩm, Nhập hàng mới bằng AI, hay API), hệ thống phải **ngay lập tức** tạo và cập nhật vector embedding cho sản phẩm đó.
2. **Luồng định kỳ hàng ngày (Scheduled Batch Trigger)**: Vào đúng **12 giờ tối (00:00:00 Midnight)** hằng ngày theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`), hệ thống tự động chạy tác vụ ngầm (Cron Scheduler) để đồng bộ và cập nhật lại embedding cho toàn bộ danh mục sản phẩm đang kinh doanh.

---

## 2. Kiến Trúc & Thiết Kế Kỹ Thuật (System Architecture)

### 2.1. Cấu Trúc Lưu Trữ Dữ Liệu Embedding Trong PostgreSQL
Trong bảng `products`, bổ sung 2 trường dữ liệu:
- `embedding JSONB`: Lưu trữ payload embedding bao gồm mảng vector số thực chuẩn hóa L2, độ dài chiều (128-D), tên mô hình, chuỗi hash văn bản và thời điểm cập nhật.
- `embedding_updated_at TIMESTAMPTZ`: Ghi nhận mốc thời gian cập nhật embedding gần nhất.

Cấu trúc JSONB lưu trong database:
```json
{
  "vector": [0.04512, -0.12034, 0.58912, ...],
  "dimensions": 128,
  "model": "grocery-semantic-embed-v1",
  "text_hash": "coca cola lon 330ml | nuoc giai khat",
  "updated_at": "2026-09-21T05:11:35.259Z"
}
```

### 2.2. Động Cơ Sinh Vector Ngữ Nghĩa 128 Chiều (`EmbeddingService`)
- Tọa lạc tại: `backend/src/modules/ai/embedding/embeddingService.js`.
- Không phụ thuộc vào API bên ngoài (chạy hoàn toàn cục bộ với độ trễ < 1ms mỗi sản phẩm, 0 chi phí, không sợ nghẽn mạng).
- Kết hợp đa tầng đặc trưng:
  1. **Tần số từ vựng (Word Tokens) & Trọng số vị trí**.
  2. **N-grams ký tự (Character 3-grams)** để bắt trúng các lỗi chính tả hoặc từ viết tắt (ví dụ: "choc", "pie", "pep").
  3. **Cụm ngữ nghĩa danh mục (Category Semantic Clusters)**: Nước giải khát, Mì bún khô, Bánh kẹo & Snack, Sữa, Gia vị & Dầu ăn, Đồ uống tươi, Hóa mỹ phẩm.
  4. **Đặc trưng đơn vị tính (Unit Features)**: lon, chai, gói, hộp, lốc, cái, kg.
  5. **Chuẩn hóa bậc giá (Logarithmic Price Tiering)**.
  6. **Chuẩn hóa L2 (L2 Normalization)**: Đảm bảo độ dài vector bằng 1.0, cho phép tính độ tương đồng Cosine Similarity chỉ bằng tích vô hướng (Dot Product).

### 2.3. Luồng Tự Động Khi Thêm Mới Sản Phẩm (`ProductService`)
- Trong `ProductService.createNewProduct` và `ProductService.updateExistingProduct`:
  Ngay sau khi bản ghi sản phẩm được lưu và ghi vết Audit Log, hệ thống tự động gọi:
  ```javascript
  await EmbeddingService.updateProductEmbedding(created.id);
  ```
- Luồng hoạt động hoàn toàn tự động, đảm bảo sản phẩm vừa tạo ra là đã có sẵn embedding để phục vụ tìm kiếm ngữ nghĩa.

### 2.4. Động Cơ Lập Lịch Tự Động 12 Giờ Tối (`CronScheduler`)
- Tọa lạc tại: `backend/src/modules/ai/embedding/cronScheduler.js`.
- Thuật toán tính toán mốc 00:00:00 tiếp theo theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7):
  ```javascript
  const vnNow = new Date(now.getTime() + VN_OFFSET_HOURS * 3600 * 1000);
  const nextMidnightTime = Date.UTC(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth(),
    vnNow.getUTCDate() + 1,
    0, 0, 0, 0
  ) - VN_OFFSET_HOURS * 3600 * 1000;
  ```
- Tự động kích hoạt khi Server khởi động (`server.js`):
  `[Cron Scheduler] 🕛 12:00 AM (Midnight) Embedding Auto-Sync scheduled for 22/09/2026 00:00:00 (in ~11.8 hours) [Asia/Ho_Chi_Minh]`
- Khi đồng hồ điểm đúng 12 giờ tối:
  1. Chạy hàm batch update toàn bộ sản phẩm: `EmbeddingService.updateAllProductEmbeddings({ force: true })`.
  2. Ghi nhận nhật ký thống kê: số sản phẩm đã cập nhật, thời gian thực thi (ms).
  3. Tự động lập lịch cho 12 giờ tối của ngày tiếp theo.

---

## 3. Danh Mục API Endpoints Mới

| Phương Thức | Endpoint | Quyền Hạn | Mô Tả |
|:---|:---|:---|:---|
| `GET` | `/api/ai/embeddings/status` | Đăng nhập | Xem trạng thái embedding (tổng số sản phẩm, số sản phẩm đã có embedding, thời gian chạy gần nhất, lịch chạy 12 giờ tối tiếp theo) |
| `POST` | `/api/ai/embeddings/sync` | `ADMIN`, `SUPER_ADMIN` | Kích hoạt đồng bộ thủ công embedding cho toàn bộ danh mục |
| `POST` | `/api/ai/embeddings/search` | Đăng nhập | Tìm kiếm sản phẩm bằng độ tương đồng ngữ nghĩa vector (Cosine Similarity) |

---

## 4. Kết Quả Kiểm Thử (Verification Results)

Bộ kiểm thử tự động toàn diện [test_suite.js](file:///c:/grocery_store/backend/test_suite.js) bổ sung `TEST 12: Product Embeddings & 12:00 AM Midnight Auto-Sync`:
- Kiểm tra endpoint trạng thái embedding: **PASS** (trả về đúng 128-D, múi giờ `Asia/Ho_Chi_Minh`, mốc 12:00 AM).
- Kiểm tra đồng bộ thủ công: **PASS** (cập nhật thành công toàn bộ sản phẩm).
- Kiểm tra tự động tạo embedding khi thêm sản phẩm mới: **PASS** (tạo sản phẩm `EMB-AUTO-...` và kiểm tra database thấy ngay vector 128 phần tử và mốc thời gian).
- Kiểm tra tìm kiếm vector ngữ nghĩa: **PASS** (truy vấn "redbull tăng lực giải khát" trả về điểm tương đồng Cosine cao: 0.441).

**Tổng kết**: **67/67 bài kiểm thử đạt PASS 100%**.
Vite Frontend build: **645ms, 0 lỗi**.
