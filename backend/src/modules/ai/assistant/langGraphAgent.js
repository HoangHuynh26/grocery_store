const tools = require('./tools');
const { formatVnDateTime } = require('../../../utils/timezone');

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0)) + 'đ';
}

/**
 * LangGraph Agent Core Dispatcher & Responder
 */
class LangGraphAgent {
  static async processMessage(userQuery, chatHistory = []) {
    const query = (userQuery || '').trim();
    if (!query) {
      return {
        reply: 'Xin chào! Tôi là Trợ Lý Quản Lý Cửa Hàng Tạp Hóa. Bạn có thể hỏi tôi về doanh thu, tình hình bán hàng, tồn kho hoặc dự báo kinh doanh.',
        toolUsed: null
      };
    }

    const lower = query.toLowerCase();
    const nowTimeStr = formatVnDateTime(new Date());

    // 1. Intent: Dự đoán doanh thu
    if (lower.includes('dự đoán') || lower.includes('du doan') || lower.includes('dự báo') || lower.includes('forecast')) {
      const forecastData = await tools.getForecast();
      const cur = forecastData.currentForecast;
      if (!cur) {
        return {
          reply: 'Hiện tại chưa có đủ dữ liệu lịch sử để dự đoán doanh thu. Vui lòng thử lại sau khi có thêm giao dịch.',
          toolUsed: 'get_forecast'
        };
      }
      return {
        reply: `📊 **Dự báo doanh thu ${cur.forecast_month}**:\n- Dự kiến: **${formatCurrency(cur.predicted_revenue)}**\n- Khoảng dao động 95%: **${formatCurrency(cur.lower_bound)} - ${formatCurrency(cur.upper_bound)}**\n- Mô hình: ${cur.algorithm} (Mã phiên bản: ${cur.model_version})\n\n_Dữ liệu cập nhật lúc ${nowTimeStr}._`,
        toolUsed: 'get_forecast',
        data: cur
      };
    }

    // 2. Intent: Hỏi bán gì / hóa đơn ngày cụ thể (e.g. "ngày 15 bán gì", "hôm nay bán những gì", "ngày 15 có những đơn hàng nào")
    if (lower.includes('bán gì') || lower.includes('ban gi') || lower.includes('bán những sản phẩm gì') || lower.includes('có những đơn hàng nào') || lower.includes('bán những món gì')) {
      const salesData = await tools.getSalesByDate({ dateRangeText: query });
      if (!salesData || salesData.invoicesCount === 0) {
        return {
          reply: `Trong kỳ **${salesData.period}**, cửa hàng chưa ghi nhận hóa đơn nào được thanh toán.`,
          toolUsed: 'get_sales_by_date'
        };
      }

      let productList = salesData.productsSold.slice(0, 7).map(
        p => `• **${p.product_name}**: ${p.total_quantity} ${p.unit || 'cái'} (${formatCurrency(p.total_amount)})`
      ).join('\n');

      return {
        reply: `Trong **${salesData.period}**, cửa hàng có **${salesData.invoicesCount}** hóa đơn hoàn thành.\n\nCác sản phẩm bán chạy:\n${productList}\n\n_Cập nhật lúc ${nowTimeStr}._`,
        toolUsed: 'get_sales_by_date',
        data: salesData
      };
    }

    // 3. Intent: Hỏi số lượng bán của một sản phẩm cụ thể (e.g. "Coca Cola bán được bao nhiêu chai?", "Mì Hảo Hảo bán được bao nhiêu?")
    const matchProd = query.match(/(.+?)\s+(?:bán được|da ban|đã bán)\s+(?:bao nhiêu|mấy)/i) ||
                      query.match(/(?:bán được|da ban)\s+(?:bao nhiêu|mấy)\s+(.+)/i);
    if (matchProd && !lower.includes('doanh thu')) {
      const prodName = (matchProd[1] || matchProd[2] || '').replace(/sản phẩm|món/i, '').trim();
      const res = await tools.getProductSales({ productName: prodName, dateRangeText: query });

      if (!res.matches || res.matches.length === 0) {
        return {
          reply: `Không tìm thấy thông tin bán hàng của sản phẩm "${prodName}" trong ${res.period}.`,
          toolUsed: 'get_product_sales'
        };
      }

      const info = res.matches.map(
        m => `• **${m.product_name}** (${m.product_code}): đã bán **${m.total_sold} ${m.unit}**, doanh thu **${formatCurrency(m.total_revenue)}** (Tồn kho hiện tại: ${m.current_stock} ${m.unit})`
      ).join('\n');

      return {
        reply: `Tình hình bán hàng trong **${res.period}**:\n${info}\n\n_Dữ liệu cập nhật lúc ${nowTimeStr}._`,
        toolUsed: 'get_product_sales',
        data: res.matches
      };
    }

    // 4. Intent: Top sản phẩm bán chạy (e.g. "sản phẩm nào bán nhiều nhất", "bán chạy nhất tháng này")
    if (lower.includes('bán chạy') || lower.includes('bán nhiều nhất') || lower.includes('top sản phẩm')) {
      const topRes = await tools.getTopProducts({ limit: 5, dateRangeText: query });
      if (!topRes.topProducts || topRes.topProducts.length === 0) {
        return {
          reply: `Chưa có số liệu sản phẩm bán ra trong kỳ ${topRes.period}.`,
          toolUsed: 'get_top_products'
        };
      }

      const list = topRes.topProducts.map(
        (p, idx) => `${idx + 1}. **${p.product_name}**: ${p.total_sold} ${p.unit || 'cái'} (${formatCurrency(p.total_revenue)})`
      ).join('\n');

      return {
        reply: `🏆 **Top sản phẩm bán chạy (${topRes.period})**:\n${list}\n\n_Dữ liệu tính đến ${nowTimeStr}._`,
        toolUsed: 'get_top_products',
        data: topRes.topProducts
      };
    }

    // 5. Intent: Hỏi tồn kho / sắp hết hàng
    if (lower.includes('tồn kho') || lower.includes('ton kho') || lower.includes('sắp hết') || lower.includes('còn bao nhiêu')) {
      const lowStockOnly = lower.includes('sắp hết') || lower.includes('cảnh báo');
      const inv = await tools.getInventory({ lowStockOnly });

      if (inv.count === 0) {
        return {
          reply: lowStockOnly 
            ? 'Hiện tại không có sản phẩm nào chạm ngưỡng tồn kho tối thiểu. Kho hàng đang ở mức an toàn.'
            : 'Kho hàng hiện chưa có dữ liệu sản phẩm.',
          toolUsed: 'get_inventory'
        };
      }

      const items = inv.items.slice(0, 8).map(
        p => `• **${p.name}** (${p.product_code}): Còn **${p.stock_quantity} ${p.unit}** (Tối thiểu: ${p.minimum_stock})`
      ).join('\n');

      return {
        reply: `${lowStockOnly ? '⚠️ **Danh sách sản phẩm sắp hết hàng**' : '📦 **Tình trạng tồn kho**'}:\n${items}\n\n_Dữ liệu tính đến ${nowTimeStr}._`,
        toolUsed: 'get_inventory',
        data: inv.items
      };
    }

    // 6. Intent: Hỏi doanh thu (Mặc định nếu có chữ doanh thu, tiền, bao nhiêu, hoặc ngày cụ thể)
    if (lower.includes('doanh thu') || lower.includes('tiền') || lower.includes('bao nhiêu') || lower.includes('hôm nay') || lower.includes('hôm qua') || lower.includes('ngày')) {
      const rev = await tools.getRevenue({ dateRangeText: query });
      return {
        reply: `Trong **${rev.period}**, cửa hàng có:\n\n• Doanh thu: **${formatCurrency(rev.revenue)}**\n• Hóa đơn: **${rev.invoiceCount}**\n• Sản phẩm đã bán: **${rev.unitsSold}** đơn vị\n\n_Dữ liệu tính đến ${nowTimeStr}._`,
        toolUsed: 'get_revenue',
        data: rev
      };
    }

    // Fallback help
    return {
      reply: `Tôi có thể hỗ trợ bạn tra cứu nhanh các thông tin sau:\n\n1. **Doanh thu**: "Doanh thu hôm nay bao nhiêu?", "Hôm qua bán được bao nhiêu?", "Doanh thu tháng này?"\n2. **Chi tiết bán hàng**: "Ngày 15 bán những gì?", "Hôm qua có bao nhiêu hóa đơn?"\n3. **Sản phẩm cụ thể**: "Coca Cola bán được bao nhiêu chai?", "Sản phẩm nào bán chạy nhất tháng này?"\n4. **Tồn kho**: "Những mặt hàng nào sắp hết hàng?", "Kiểm tra tồn kho"\n5. **Dự báo**: "Dự đoán doanh thu tháng tiếp theo"`,
      toolUsed: null
    };
  }
}

module.exports = LangGraphAgent;
