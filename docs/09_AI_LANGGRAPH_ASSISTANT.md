# 09. Trợ Lý Kinh Doanh AI LangGraph Tiếng Việt (AI Business Assistant)

Module Trợ lý AI mang đến khả năng hỏi đáp dữ liệu bán hàng bằng tiếng Việt tự nhiên, được xây dựng trên nền tảng **LangGraph & LangChain** với kiến trúc Agent gọi Tool có cấu trúc (Tool-Calling Agent).

---

## 1. Vấn Đề Của Việc Cho AI Tự Sinh SQL (Tại Sao Chọn Tool-Calling?)

Nhiều giải pháp thông thường cho mô hình ngôn ngữ lớn (LLM) tự sinh câu lệnh SQL thô (Text-to-SQL). Tuy nhiên, cách làm này tiềm ẩn rủi ro rất lớn:
1. **Lỗ hổng SQL Injection & Xóa nhầm dữ liệu**: LLM có thể sinh ra các câu `DROP TABLE`, `UPDATE` sai lệch.
2. **Ảo giác số liệu (Hallucination)**: LLM tự bịa ra con số thống kê hoặc tính toán sai phép cộng trừ.
3. **Lệch múi giờ**: LLM không hiểu rõ ngữ cảnh thời gian thực tế tại Việt Nam (`UTC+7`).

👉 **Giải pháp của hệ thống**: Sử dụng **LangGraph Tool-Calling Agent** kết hợp bộ phân tích ngày tiếng Việt xác định (**Deterministic Date Parser**).

---

## 2. Kiến Trúc Luồng Hoạt Động Của LangGraph (`langGraphAgent.js`)

```mermaid
graph TD
    UserMsg["💬 Người Dùng: 'Doanh thu hôm qua bao nhiêu?'"] --> Parser["🗓️ Bộ Phân Tích Ngày Tiếng Việt (dateParser.js)"]
    Parser --> AgentNode["🤖 LangGraph Agent Node (Phân Tích Ý Định)"]
    
    AgentNode --> Decision{"Cần Gọi Tool Nào?"}
    
    Decision -->|Hỏi Doanh Thu| ToolRev["Tool: get_revenue_analytics(startDate, endDate)"]
    Decision -->|Hỏi Tồn Kho / Sắp Hết| ToolInv["Tool: get_inventory_status(lowStockOnly)"]
    Decision -->|Hỏi Dự Báo Tương Lai| ToolForecast["Tool: get_revenue_forecast()"]
    Decision -->|Hỏi Hóa Đơn Gần Đây| ToolInvList["Tool: get_recent_invoices(limit)"]
    Decision -->|Hỏi Hàng Bán Chạy| ToolTop["Tool: get_top_products(limit)"]
    
    ToolRev --> DBQuery["Truy Vấn PostgreSQL An Toàn (Parameterized SQL)"]
    ToolInv --> DBQuery
    ToolForecast --> MLEngine["Gọi Mô Hình Toán Học Holt-Winters ML"]
    ToolInvList --> DBQuery
    ToolTop --> DBQuery
    
    DBQuery --> Synthesizer["✍️ LangGraph Synthesis Node (Định Dạng Tiếng Việt)"]
    MLEngine --> Synthesizer
    Synthesizer --> FinalResp["🎉 Phản Hồi: 'Doanh thu hôm qua (19/09) đạt 3.450.000đ với 28 đơn hàng...'"]
```

---

## 3. Bộ Phân Tích Thời Gian Tiếng Việt (`dateParser.js`)

Module tự động nhận diện chính xác các cụm từ chỉ thời gian thường ngày của người Việt Nam:
- **Từ ngữ tương đối**: `"hôm nay"`, `"hôm qua"`, `"hôm kia"`, `"tuần này"`, `"tuần trước"`, `"tháng này"`, `"tháng trước"`, `"năm nay"`, `"năm ngoái"`.
- **Cụ thể theo ngày**: `"ngày 15"`, `"ngày 20/09"`, `"ngày 5 tháng 8"`.
- **Khoảng thời gian**: `"7 ngày qua"`, `"30 ngày gần nhất"`.

### Chuẩn hóa múi giờ:
Mọi mốc thời gian đều được ép dải chính xác:
- Bắt đầu: `YYYY-MM-DD 00:00:00.000 +07:00`
- Kết thúc: `YYYY-MM-DD 23:59:59.999 +07:00`
Ngăn chặn hoàn toàn lỗi lệch ngày do múi giờ server trên Cloud (Render mặc định chạy múi giờ UTC).

---

## 4. Danh Mục Công Cụ (Agent Tools - `tools.js`)

1. **`get_revenue_analytics`**:
   - Tham số: `startDate`, `endDate`.
   - Kết quả: Doanh thu thực tế, số đơn hàng, giá trị đơn trung bình (AOV).
2. **`get_inventory_status`**:
   - Tham số: `lowStockOnly` (boolean).
   - Kết quả: Danh sách sản phẩm tồn kho ít hơn ngưỡng cảnh báo `min_stock_alert`.
3. **`get_top_products`**:
   - Tham số: `limit` (số lượng mặt hàng, mặc định 5).
   - Kết quả: Danh sách các món bán chạy nhất kèm số lượng và doanh thu.
4. **`get_revenue_forecast`**:
   - Kết nối trực tiếp với mô hình Machine Learning Holt-Winters để trả lời câu hỏi: *"Dự đoán tháng tới cửa hàng bán được bao nhiêu?"*.
5. **`get_recent_invoices`**:
   - Tham số: `limit`.
   - Kết quả: Các hóa đơn vừa phát sinh gần nhất kèm tên thu ngân và tổng tiền.

---

## 5. Trải Nghiệm Giao Diện Người Dùng (Frontend AI Chat)

Trang [AiAssistantPage.jsx](file:///c:/grocery_store/frontend/src/pages/AiAssistantPage.jsx):
- Hỗ trợ các nút gợi ý câu hỏi một chạm (Quick Prompts):
  - *"Hôm nay doanh thu thế nào?"*
  - *"Sản phẩm nào sắp hết hàng trong kho?"*
  - *"Dự đoán doanh thu tháng tới bằng AI?"*
  - *"Top 5 sản phẩm bán chạy nhất?"*
- Hiển thị Markdown trực quan, tự động làm nổi bật các con số tài chính (VND) và ngày tháng.
