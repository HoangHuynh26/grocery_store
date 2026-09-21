# Tài Liệu Kỹ Thuật: Tra Cứu Doanh Thu Theo Giờ Cụ Thể & Chuẩn Hóa Văn Bản Không Dấu Sao (*) Của Trợ Lý AI

> **Mã tài liệu**: `20_AI_SPECIFIC_HOUR_REVENUE_AND_CLEAN_FORMAT.md`  
> **Phiên bản áp dụng**: v2.5.0 (Phase 25)  
> **Tác giả**: Đội ngũ Kỹ thuật & AI Grocery Store  
> **Trạng thái**: Production Ready  

---

## 1. Bối Cảnh & Vấn Đề (Problem Statement)

Trong quá trình sử dụng Trợ lý AI (LangGraph Agent), người dùng phản ánh 2 vấn đề:
1. **Câu hỏi về thời gian/khung giờ cụ thể chưa được trả lời đúng trọng tâm**:
   - Khi người dùng hỏi: *"Vào lúc 13 giờ hôm nay có doanh thu nào không?"*
   - Hệ thống trước đây chỉ nhận diện từ khóa *"hôm nay"* và gọi hàm tổng hợp toàn bộ doanh thu trong ngày (ví dụ: `525.000đ` với 14 hóa đơn), hoàn toàn bỏ qua mốc thời gian *"13 giờ"*. Người dùng cần biết chính xác vào khung giờ 13h (13:00 - 13:59) có đơn hàng nào phát sinh không, doanh thu là bao nhiêu, hoặc xác nhận rõ ràng rằng khung giờ đó chưa có doanh thu.
2. **Ký tự thô Markdown (`*`, `**`, `_`) hiển thị trực tiếp trên giao diện**:
   - Các câu trả lời từ AI chứa định dạng markdown như `**BÁO CÁO DOANH THU**`, `**525.000đ**`, `_Dữ liệu cập nhật_`.
   - Vì chat bubble hiển thị `white-space: pre-wrap` không qua bộ lọc, các dấu sao `*` và dấu gạch dưới `_` hiển thị thô ra màn hình gây rối mắt và khó chịu cho người sử dụng.

---

## 2. Giải Pháp Kỹ Thuật (Architectural Solutions)

### 2.1. Phân Tích & Trích Xuất Khung Giờ Tự Nhiên Tiếng Việt (`dateParser.js`)

Hàm `extractHourInfo(text)` được bổ sung với khả năng nhận diện đa dạng các cách diễn đạt giờ trong tiếng Việt:
- **Dạng có tiền tố**: `"vào lúc 13 giờ"`, `"lúc 13h"`, `"khoảng 14 giờ"`, `"khung giờ 15h"`, `"hồi 13h"`.
- **Dạng 24h & 12h kèm thời điểm**: `"8 giờ tối"` (tự động cộng thành 20h), `"2h chiều"` (14h), `"9h sáng"` (9h), `"12h trưa"` (12h).
- **Dạng định dạng số điện tử**: `"13:00"`, `"13:30"`.
- **Dạng khoảng thời gian (Hour Range)**: `"từ 13h đến 15h"`, `"13h - 15h"`.

Khi phát hiện có chỉ định giờ:
```javascript
const startH = hourInfo.startHour;
const endH = hourInfo.endHour;
// Quy đổi chính xác theo múi giờ Asia/Ho_Chi_Minh (UTC+7)
const start = new Date(Date.UTC(y, m, d, startH, 0, 0, 0) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
const end = new Date(Date.UTC(y, m, d, endH, 59, 59, 999) - VN_OFFSET_HOURS * 3600 * 1000).toISOString();
```
- Nếu câu hỏi không nêu rõ ngày (ví dụ: *"lúc 13 giờ có doanh thu nào không"*), hệ thống tự động gán mặc định là **hôm nay** (ngày hiện tại).

### 2.2. Xử Lý Phản Hồi Trọng Tâm & Chính Xác Tại `langGraphAgent.js`

Khi người dùng hỏi doanh thu/bán hàng theo giờ:
- **Trường hợp không có hóa đơn nào (`invoiceCount === 0`)**:
  ```text
  Vào lúc 13:00 hôm nay (21/09/2026), cửa hàng không có doanh thu nào (0đ, 0 hóa đơn hoàn thành).

  • Doanh thu: 0đ
  • Số đơn hoàn thành: 0 hóa đơn
  • Sản phẩm đã bán: 0 đơn vị

  Dữ liệu cập nhật lúc 21/09/2026 12:03:58.
  ```
  => Trả lời trực diện, xác thực rõ ràng thông tin cho người quản lý.

- **Trường hợp có hóa đơn (`invoiceCount > 0`)**:
  ```text
  Vào lúc 11:00 hôm nay (21/09/2026), cửa hàng có ghi nhận doanh thu:

  • Doanh thu thực tế: 225.000đ
  • Số đơn hàng hoàn thành: 6 hóa đơn
  • Tổng số sản phẩm đã bán: 15 đơn vị
  • Giá trị trung bình/đơn: 37.500đ

  Dữ liệu cập nhật lúc 21/09/2026 12:03:58.
  ```

- **Thêm tính năng xem thống kê theo từng khung giờ**:
  Khi hỏi *"doanh thu theo từng khung giờ hôm nay"*, hệ thống gọi `tools.getHourlyBreakdown` và liệt kê chi tiết từng khung giờ phát sinh doanh thu.

### 2.3. Loại Bỏ Triệt Để Dấu Sao `*` và Gạch Dưới `_` (`cleanFormatting`)

1. **Ở Backend (`langGraphAgent.js`)**:
   - Tất cả template trả lời được viết lại dạng text tự nhiên thuần túy không chứa `**`, `*`, `_`.
   - Bộ lọc `cleanFormatting(text)` được áp dụng qua hàm `formatResult(reply, toolUsed, data)` trước khi bất kỳ thông điệp nào gửi về client:
     ```javascript
     function cleanFormatting(text) {
       if (!text) return '';
       return text
         .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
         .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
         .replace(/`([^`]+)`/g, '$1')
         .replace(/\*/g, '')
         .trim();
     }
     ```
2. **Ở Frontend (`AiAssistantPage.jsx`)**:
   - Cập nhật câu chào mừng `welcome`: Bỏ toàn bộ `**`.
   - Áp dụng `cleanAiText` khi nhận response và khi render nội dung tin nhắn.
   - Bổ sung chip câu hỏi mẫu: `"Vào lúc 13 giờ hôm nay có doanh thu nào không?"`.

---

## 3. Danh Sách File Cập Nhật

| File | Chức Năng |
|:---|:---|
| `backend/src/modules/ai/assistant/dateParser.js` | Bổ sung `extractHourInfo` phân tích giờ tiếng Việt, xử lý `isHourly` và khung giờ UTC+7 |
| `backend/src/modules/ai/assistant/tools.js` | Trả về metadata `isHourly`, `targetHour`, `hourDisplay`, bổ sung `getHourlyBreakdown` |
| `backend/src/modules/ai/assistant/langGraphAgent.js` | Tích hợp `cleanFormatting`, xử lý hội thoại theo giờ trọng tâm, loại bỏ toàn bộ `*` |
| `frontend/src/pages/AiAssistantPage.jsx` | Làm sạch câu chào, áp dụng `cleanAiText`, thêm gợi ý câu hỏi 13h |
| `backend/test_suite.js` | Bổ sung bài kiểm tra tự động cho câu hỏi lúc 13h, kiểm tra khung giờ và xác minh 0 dấu `*` |

---

## 4. Kết Quả Kiểm Thử Tự Động (Automated Test Results)

Chạy kiểm thử với `node test_suite.js`:
```
====================================================
 STARTING GROCERY STORE AUTOMATED TEST SUITE        
====================================================
...
[8] Testing AI Assistant & Forecasting...
  ✅ PASS: AI Revenue Forecast available
  ✅ PASS: AI Assistant answered today revenue query
  ✅ PASS: AI Assistant response has 0 asterisks (*)
  ✅ PASS: AI Assistant handled specific hour 13 revenue query
  ✅ PASS: AI Assistant response specifies hour 13:00
  ✅ PASS: AI Assistant accurately answers whether there was revenue at hour 13
  ✅ PASS: Hour 13 response has 0 asterisks (*)
  ✅ PASS: AI Assistant handled hourly breakdown query
  ✅ PASS: Hourly breakdown response has 0 asterisks (*)
...
====================================================
 TEST SUMMARY: 54 PASSED, 0 FAILED
====================================================
```

Frontend production build:
```
vite v8.3.0 building client environment for production...
✓ built in 895ms (0 errors)
```
