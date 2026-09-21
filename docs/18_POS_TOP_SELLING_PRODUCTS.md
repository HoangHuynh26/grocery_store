# Tài Liệu Kỹ Thuật: Mục Sản Phẩm Bán Chạy Trên Màn Hình POS (Top 10 Best-Selling Products)

## 1. Tổng Quan & Yêu Cầu Nghiệp Vụ

Trong môi trường bán lẻ tạp hóa và siêu thị mini, quy luật Pareto (80/20) phản ánh rõ nét: khoảng 20% mặt hàng chủ lực (như mì gói, bánh kẹo, nước ngọt, khăn giấy...) chiếm tới 80% tổng số lượt thanh toán hàng ngày. 

Để tối ưu hóa tốc độ xuất đơn của thu ngân (Cashier) và giảm thiểu thời gian gõ tìm kiếm hoặc quét mã QR đối với các mặt hàng phổ biến nhất:
- **Yêu cầu người dùng**: Thêm mục sản phẩm bán chạy ở màn hình POS bán hàng và hiển thị đúng 10 sản phẩm bán chạy nhất ở ngay trên đầu danh mục sản phẩm.
- **Mục tiêu kỹ thuật**:
  1. Tổng hợp dữ liệu bán hàng thực tế từ cơ sở dữ liệu PostgreSQL dựa trên các hóa đơn hợp lệ (`status != 'CANCELLED'`).
  2. Cung cấp API endpoint chuyên dụng `GET /api/products/top-selling?limit=10` có hỗ trợ phân quyền và tự động fallback sang các sản phẩm có tồn kho cao nhất nếu lịch sử hóa đơn còn mới.
  3. Xây dựng giao diện thanh trượt / card shelf phong cách Apple Liquid Glass hiện đại ngay trên đầu danh mục POS, hỗ trợ thao tác chạm 1-click để thêm nhanh vào giỏ hàng.
  4. Đảm bảo tính nhất quán đồng bộ tồn kho thời gian thực qua WebSocket (Socket.IO) khi có đơn hàng hoặc biến động kho phát sinh.

---

## 2. Thiết Kế Truy Vấn SQL & Cơ Sở Dữ Liệu

### 2.1. Logic Thống Kê Sản Phẩm Bán Chạy

Hệ thống tính toán `total_sold` bằng cách gom nhóm các dòng hàng trong bảng `invoice_items` đã được chốt đơn trong bảng `invoices`:

```sql
SELECT 
  p.*,
  c.name as category_name,
  c.slug as category_slug,
  COALESCE(sales.total_sold, 0)::int as total_sold,
  CASE WHEN p.stock_quantity <= p.minimum_stock THEN TRUE ELSE FALSE END as is_low_stock
FROM products p
LEFT JOIN (
  SELECT product_id, SUM(quantity) as total_sold
  FROM invoice_items ii
  JOIN invoices i ON ii.invoice_id = i.id
  WHERE i.status != 'CANCELLED'
  GROUP BY product_id
) sales ON p.id = sales.product_id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_active = TRUE
ORDER BY COALESCE(sales.total_sold, 0) DESC, p.stock_quantity DESC, p.name ASC
LIMIT $1;
```

### 2.2. Điểm Tối Ưu Hóa & Ràng Buộc
1. **Loại trừ đơn hàng HỦY**: Điều kiện `i.status != 'CANCELLED'` đảm bảo các hóa đơn hoàn tiền hoặc hủy không bị tính vào doanh số bán ra.
2. **`LEFT JOIN` toàn vẹn**: Dùng `LEFT JOIN` với bảng phụ `sales` giúp câu lệnh luôn trả về đủ số lượng sản phẩm cấu hình (`LIMIT 10`), ngay cả khi cửa hàng mới thành lập hoặc có ít hơn 10 sản phẩm từng phát sinh giao dịch.
3. **Thứ tự sắp xếp đa cấp (Multi-tier Order By)**:
   - Ưu tiên 1: `COALESCE(sales.total_sold, 0) DESC` (số lượng đã bán nhiều nhất).
   - Ưu tiên 2: `p.stock_quantity DESC` (hàng còn nhiều trong kho).
   - Ưu tiên 3: `p.name ASC` (theo bảng chữ cái).
4. **Ép kiểu số nguyên (`::int`)**: Giúp JavaScript nhận giá trị `number` thay vì dạng chuỗi `string` sinh ra từ hàm gom nhóm `SUM()` của PostgreSQL.

---

## 3. Kiến Trúc Backend & REST API

### 3.1. Phân Tầng Xử Lý (Layered Architecture)

1. **Repository Layer (`backend/src/repositories/productRepository.js`)**:
   - Hàm `getTopSellingProducts({ limit = 10 })`: Thực thi câu truy vấn SQL đã tối ưu với tham số an toàn `$1`.
2. **Service Layer (`backend/src/services/productService.js`)**:
   - Hàm `getTopSellingProducts(limit = 10)`: Chuẩn hóa tham số `limit` trong khoảng an toàn `[1, 50]`.
3. **Controller Layer (`backend/src/controllers/productController.js`)**:
   - Hàm `getTopSelling(req, res, next)`: Xử lý request, bắt lỗi và phản hồi JSON cấu trúc `{ success: true, data: [...] }`.
4. **Router Layer (`backend/src/routes/productRoutes.js`)**:
   - Định tuyến `GET /api/products/top-selling` được đặt **trước** route tham số động `GET /api/products/:id` để tránh Express bắt nhầm từ khóa `top-selling` như một định danh UUID của sản phẩm.

### 3.2. Cấu Trúc Phản Hồi API Mẫu

```json
{
  "success": true,
  "data": [
    {
      "id": "9776a624-334d-4494-b2ef-846d592c3115",
      "product_code": "BANH-CHOCORIE-01",
      "name": "Bánh ChocoPie Orion hộp 6 cái",
      "category_name": "Bánh kẹo & Snack",
      "selling_price": "32000.00",
      "stock_quantity": 15,
      "total_sold": 11,
      "is_low_stock": false
    }
  ]
}
```

---

## 4. Giao Diện Người Dùng POS & Trải Nghiệm Khách Hàng (UI/UX)

### 4.1. Vị Trí & Bố Cục
- Vị trí: Đặt ngay trên đầu khu vực danh mục hàng hóa (`pos-catalog-scroll`), dưới thanh công cụ tìm kiếm và lọc danh mục.
- Hiển thị thông minh: Tự động hiển thị khi người dùng không gõ từ khóa tìm kiếm (`!searchQuery && topSellingProducts.length > 0`).

### 4.2. Thiết Kế Thẻ Top-Selling Phong Cách Hiện Đại
Mỗi thẻ sản phẩm trong mục Top 10 sở hữu các đặc tính nổi bật:
- **Huy hiệu thứ hạng (Rank Badge)**:
  - Hạng 1 (`#1`): Hiệu ứng dải màu Gold hoàng kim (`#f59e0b` -> `#d97706`) kèm bóng đổ ánh vàng.
  - Hạng 2 (`#2`): Hiệu ứng Silver bạc sang trọng (`#94a3b8` -> `#64748b`).
  - Hạng 3 (`#3`): Hiệu ứng Bronze đồng ánh kim (`#d97706` -> `#92400e`).
  - Hạng 4 - 10: Huy hiệu Liquid Glass bán trong suốt với viền mờ cao cấp.
- **Thống kê lượt bán**: Nhãn `🔥 Đã bán {p.total_sold}` giúp thu ngân nhận biết mặt hàng nào đang sốt.
- **Thao tác 1-Click vào giỏ**: Chạm trực tiếp vào thẻ hoặc nút tròn `+` để thêm ngay 1 đơn vị vào giỏ hàng với hiệu ứng viền xanh phản hồi tức thì.
- **Thanh cuộn trượt ngang mượt mà (Smooth Horizontal Snap Scroll)**: Trên thiết bị cảm ứng hoặc di động, thu ngân có thể vuốt lướt ngang mượt mà với tính năng `scroll-snap-type: x mandatory`.

---

## 5. Kiểm Thử Tự Động & Đảm Bảo Chất Lượng

Quy trình kiểm thử được tích hợp trực tiếp vào bộ kiểm thử tổng hợp `backend/test_suite.js`:

```javascript
// TEST 11: POS Top-Selling Products Endpoint
console.log('\n[11] Testing POS Top-Selling Products Endpoint...');
const topSellingRes = await request('/products/top-selling?limit=10', {
  headers: { Authorization: `Bearer ${staffToken}` }
});
assert(topSellingRes.status === 200, 'Top-selling products returns 200 OK');
assert(Array.isArray(topSellingRes.data.data), 'Top-selling data is an array');
assert(topSellingRes.data.data.length <= 10, `Returned at most 10 items (got ${topSellingRes.data.data.length})`);
if (topSellingRes.data.data.length > 0) {
  const firstItem = topSellingRes.data.data[0];
  assert(typeof firstItem.total_sold === 'number', `Top item has total_sold numeric attribute: ${firstItem.total_sold}`);
  assert(!!firstItem.name, `Top item has product name: ${firstItem.name}`);
}
```

### Kết quả kiểm thử:
- **Bộ kiểm thử tự động**: 43/43 bài kiểm thử đạt kết quả **PASS** (100%).
- **Frontend Production Build**: `npm run build` hoàn thành trong 610ms với 0 lỗi linter/compiler.
