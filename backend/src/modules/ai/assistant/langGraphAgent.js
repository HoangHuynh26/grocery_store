const tools = require('./tools');
const { formatVnDateTime } = require('../../../utils/timezone');
const { removeVietnameseAccents } = require('../../../utils/text');

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0)) + 'đ';
}

/**
 * Removes raw markdown formatting (asterisks, underscores, backticks)
 * so that AI messages display cleanly as natural text in the chat interface.
 */
function cleanFormatting(text) {
  if (!text) return '';
  return text
    // Replace markdown bold/italic asterisks: ***text***, **text**, *text*
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Replace markdown underscores: ___text___, __text__, _text_
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Replace inline code ticks: `code`
    .replace(/`([^`]+)`/g, '$1')
    // Remove any remaining raw asterisks
    .replace(/\*/g, '')
    .trim();
}

function formatResult(reply, toolUsed = null, data = null) {
  return {
    reply: cleanFormatting(reply),
    toolUsed,
    data
  };
}

/**
 * Intelligent Vietnamese Grocery Store AI Assistant
 */
class LangGraphAgent {
  static async processMessage(userQuery, chatHistory = []) {
    const rawQuery = (userQuery || '').trim();
    if (!rawQuery) {
      return formatResult(
        'Xin chào! Tôi là Trợ Lý Quản Lý Cửa Hàng Tạp Hóa. Bạn có thể hỏi tôi về giá sản phẩm, tồn kho, doanh thu (theo ngày hoặc theo từng giờ), mặt hàng bán chạy hoặc dự báo kinh doanh.'
      );
    }

    const lower = rawQuery.toLowerCase();
    const cleanQuery = removeVietnameseAccents(lower);
    const nowTimeStr = formatVnDateTime(new Date());

    // -------------------------------------------------------------------------
    // 1. INTENT: Chào hỏi, giới thiệu bản thân, hỏi năng lực
    // -------------------------------------------------------------------------
    const isGreeting = /^(chao|chào|hello|hi|alo|hé lô|helo|xin chao|xin chào|good morning|hey)\b/i.test(lower) ||
                       cleanQuery === 'chao' || cleanQuery === 'hello' || cleanQuery === 'hi' ||
                       lower.includes('bạn là ai') || cleanQuery.includes('ban la ai') ||
                       lower.includes('bạn tên gì') || cleanQuery.includes('ban ten gi') ||
                       lower.includes('làm được gì') || cleanQuery.includes('lam duoc gi') ||
                       lower.includes('giúp gì') || cleanQuery.includes('giup gi');

    if (isGreeting && !lower.includes('doanh thu') && !lower.includes('giá') && !lower.includes('tồn kho')) {
      return formatResult(
        `👋 Xin chào bạn! Tôi là Trợ Lý Thông Minh của Cửa Hàng Tạp Hóa.\n\nTôi có thể hỗ trợ bạn tức thì các công việc sau:\n• 🏷️ Tra cứu giá & thông tin sản phẩm: "Coca Cola giá bao nhiêu?", "Bánh ChocoPie giá mấy?"\n• 📦 Kiểm tra tồn kho: "Còn bao nhiêu lon Coca?", "Những mặt hàng nào sắp hết?"\n• 📊 Doanh thu & Bán hàng: "Doanh thu hôm nay bao nhiêu?", "Vào lúc 13 giờ hôm nay có doanh thu nào không?"\n• 🏆 Hàng bán chạy: "Sản phẩm nào bán chạy nhất tháng này?"\n• 🗂️ Danh mục hàng hóa: "Có những danh mục nào?", "Danh mục nước giải khát có gì?"\n• 📈 Dự báo kinh doanh AI: "Dự đoán doanh thu tháng tới?"\n• ℹ️ Tổng quan cửa hàng: "Cửa hàng có bao nhiêu sản phẩm?"\n\nBạn cần tra cứu thông tin gì hôm nay?`,
        'greeting'
      );
    }

    // -------------------------------------------------------------------------
    // 2. INTENT: Hướng dẫn sử dụng hệ thống & các thao tác POS / Kho
    // -------------------------------------------------------------------------
    if (lower.includes('hướng dẫn') || cleanQuery.includes('huong dan') ||
        lower.includes('cách dùng') || cleanQuery.includes('cach dung') ||
        lower.includes('làm sao để') || cleanQuery.includes('lam sao de') ||
        lower.includes('cách tạo đơn') || lower.includes('cách quét') || cleanQuery.includes('cach quet') ||
        lower.includes('cách nhập hàng') || cleanQuery.includes('cach nhap hang')) {
      return formatResult(
        `📖 CẨM NANG HƯỚNG DẪN THAO TÁC HỆ THỐNG:\n\n1. Bán Hàng Tại Quầy (POS):\n   • Chọn sản phẩm từ danh sách hoặc dùng Camera/Máy quét mã QR để thêm vào giỏ.\n   • Chỉnh số lượng, áp dụng chiết khấu (nếu có), chọn hình thức Tiền mặt hoặc Chuyển khoản và bấm Thanh Toán.\n   • Sau khi thanh toán, bạn có thể in hóa đơn nhiệt ngay lập tức.\n\n2. Nhập Thêm Hàng Vào Kho:\n   • Vào trang Kho Hàng -> Bấm Nhập Hàng Có Sẵn (nếu hàng đã có) hoặc Nhập Hàng Mới AI (hệ thống sẽ tự động phân loại danh mục, sinh mã SKU và kiểm tra trùng lặp).\n\n3. Quản Lý Sản Phẩm:\n   • Thêm sản phẩm mới với ảnh chụp rõ nét, mã SKU tự động và mã QR độc quyền bảo mật.\n\n4. Tra cứu báo cáo & AI:\n   • Theo dõi biểu đồ doanh số thời gian thực tại Tổng Quan, hoặc trò chuyện với tôi để tra cứu số liệu ngay lập tức!`,
        'user_guide'
      );
    }

    // -------------------------------------------------------------------------
    // 3. INTENT: Dự đoán doanh thu (Forecasting)
    // -------------------------------------------------------------------------
    if (lower.includes('dự đoán') || cleanQuery.includes('du doan') ||
        lower.includes('dự báo') || cleanQuery.includes('du bao') ||
        lower.includes('forecast')) {
      const forecastData = await tools.getForecast();
      const cur = forecastData.currentForecast;
      if (!cur) {
        return formatResult(
          'Hiện tại chưa có đủ dữ liệu lịch sử để dự đoán doanh thu. Vui lòng thử lại sau khi có thêm giao dịch bán hàng.',
          'get_forecast'
        );
      }
      return formatResult(
        `📊 DỰ BÁO DOANH THU KINH DOANH (${cur.forecast_month}):\n\n• Doanh thu dự kiến: ${formatCurrency(cur.predicted_revenue)}\n• Khoảng tin cậy 95%: ${formatCurrency(cur.lower_bound)} - ${formatCurrency(cur.upper_bound)}\n• Thuật toán: Holt-Winters Exponential Smoothing\n• Phiên bản mô hình: ${cur.model_version} (Độ lỗi MAPE: ${cur.model_mape || 0}%)\n\nDữ liệu phân tích cập nhật lúc ${nowTimeStr}.`,
        'get_forecast',
        cur
      );
    }

    // -------------------------------------------------------------------------
    // 4. INTENT: Tổng quan cửa hàng / Thống kê số lượng sản phẩm / Kho
    // -------------------------------------------------------------------------
    if (cleanQuery.includes('bao nhieu san pham') || cleanQuery.includes('bao nhieu mat hang') ||
        cleanQuery.includes('tong so san pham') || cleanQuery.includes('tong mat hang') ||
        cleanQuery.includes('tong quan cua hang') || cleanQuery.includes('tinh hinh cua hang') ||
        cleanQuery.includes('tong gia tri ton kho') || cleanQuery.includes('kho co bao nhieu hang') ||
        cleanQuery === 'tong quan') {
      const summary = await tools.getStoreSummary();
      return formatResult(
        `🏪 TỔNG QUAN TÌNH HÌNH CỬA HÀNG:\n\n• 📦 Sản phẩm đang bán: ${summary.totalProducts} mặt hàng (${summary.totalCategories} danh mục)\n• 🔢 Tổng số lượng tồn kho: ${new Intl.NumberFormat('vi-VN').format(summary.totalStockUnits)} đơn vị sản phẩm\n• 💰 Tổng giá trị vốn trong kho: ${formatCurrency(summary.totalInventoryCostValue)}\n• ⚠️ Mặt hàng sắp hết: ${summary.lowStockCount} mặt hàng (${summary.outOfStockCount} mặt hàng đã hết hàng)\n• 💵 Doanh thu hôm nay: ${formatCurrency(summary.todayRevenue)} (${summary.todayInvoices} hóa đơn hoàn thành)\n• 👥 Nhân sự hoạt động: ${summary.totalStaff} tài khoản\n\nCập nhật số liệu lúc ${nowTimeStr}.`,
        'get_store_summary',
        summary
      );
    }

    // -------------------------------------------------------------------------
    // 5. INTENT: Tra cứu giá sản phẩm cụ thể (Price Inquiry)
    // -------------------------------------------------------------------------
    const isPriceQuery = (
      cleanQuery.includes('gia cua') || cleanQuery.includes('gia bao nhieu') ||
      cleanQuery.includes('bao nhieu tien') || cleanQuery.includes('ban gia bao nhieu') ||
      cleanQuery.includes('ban gia may') || cleanQuery.includes('gia nhieu') ||
      (cleanQuery.startsWith('gia ') && !cleanQuery.includes('gia tri ton kho')) ||
      (cleanQuery.includes(' gia ') && !cleanQuery.includes('danh gia') && !cleanQuery.includes('giam gia'))
    );

    if (isPriceQuery && !cleanQuery.includes('doanh thu') && !cleanQuery.includes('ban duoc bao nhieu tien')) {
      let prodName = rawQuery
        .replace(/giá của|gia cua|giá|gia|bán giá|ban gia|bao nhiêu tiền|bao nhieu tien|là bao nhiêu|la bao nhieu|mấy tiền|may tien|nhiêu|bao nhiêu|bao nhieu|\?/gi, '')
        .replace(/sản phẩm|san pham|món|mon|hộp|hop|lon|chai|gói|goi|cái|cai/gi, '')
        .trim();

      if (prodName.length >= 2) {
        const searchRes = await tools.searchProduct({ keyword: prodName });
        if (searchRes.count > 0) {
          const lines = searchRes.products.slice(0, 5).map(p => {
            const stockStatus = p.stock_quantity <= 0 
              ? '❌ Đã hết hàng' 
              : (p.stock_quantity <= p.minimum_stock ? `⚠️ Còn ${p.stock_quantity} ${p.unit} (Sắp hết)` : `✅ Còn ${p.stock_quantity} ${p.unit}`);
            return `• ${p.name} (${p.product_code}):\n  - Giá bán: ${formatCurrency(p.selling_price)} / ${p.unit}\n  - Danh mục: ${p.category_name || 'Khác'}\n  - Tình trạng: ${stockStatus}`;
          }).join('\n\n');

          return formatResult(
            `🏷️ BẢNG GIÁ SẢN PHẨM "${prodName.toUpperCase()}":\n\n${lines}\n\nDữ liệu cập nhật lúc ${nowTimeStr}.`,
            'search_product',
            searchRes.products
          );
        } else {
          return formatResult(
            `Không tìm thấy sản phẩm nào có tên hoặc mã tương tự như "${prodName}". Bạn vui lòng kiểm tra lại tên sản phẩm hoặc gõ "Có những danh mục nào?" để xem danh sách.`,
            'search_product'
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // 6. INTENT: Tra cứu tồn kho sản phẩm cụ thể hoặc Hàng sắp hết
    // -------------------------------------------------------------------------
    const isSpecificStockCheck = (
      cleanQuery.includes('con bao nhieu') || cleanQuery.includes('con hang khong') ||
      cleanQuery.includes('con khong') || cleanQuery.includes('het hang chua') ||
      cleanQuery.includes('kiem tra ton kho') || cleanQuery.includes('con ton kho khong')
    ) && !cleanQuery.includes('ban duoc');

    if (isSpecificStockCheck) {
      let prodName = rawQuery
        .replace(/còn bao nhiêu|con bao nhieu|còn hàng không|con hang khong|còn không|con khong|hết hàng chưa|het hang chua|kiểm tra tồn kho|kiem tra ton kho|tồn kho|ton kho|\?/gi, '')
        .replace(/sản phẩm|san pham|món|mon|hộp|hop|lon|chai|gói|goi|cái|cai/gi, '')
        .trim();

      if (prodName.length >= 2) {
        const searchRes = await tools.searchProduct({ keyword: prodName });
        if (searchRes.count > 0) {
          const lines = searchRes.products.slice(0, 5).map(p => {
            const statusLabel = p.stock_quantity <= 0
              ? '❌ Hết hàng (Cần nhập gấp)'
              : (p.stock_quantity <= p.minimum_stock
                  ? `⚠️ Sắp hết (Còn ${p.stock_quantity} ${p.unit}, tối thiểu: ${p.minimum_stock})`
                  : `✅ Đủ hàng (Còn ${p.stock_quantity} ${p.unit})`);
            return `• ${p.name} [${p.product_code}]: ${statusLabel} - Giá bán: ${formatCurrency(p.selling_price)}`;
          }).join('\n');

          return formatResult(
            `📦 TÌNH TRẠNG TỒN KHO CỦA "${prodName.toUpperCase()}":\n\n${lines}\n\nDữ liệu cập nhật lúc ${nowTimeStr}.`,
            'search_product',
            searchRes.products
          );
        }
      }
    }

    // Danh sách mặt hàng sắp hết hàng / cảnh báo tồn kho
    if (cleanQuery.includes('sap het') || cleanQuery.includes('canh bao ton') || cleanQuery.includes('het hang')) {
      const inv = await tools.getInventory({ lowStockOnly: true });
      if (inv.count === 0) {
        return formatResult(
          '✅ Kho hàng đang ở mức an toàn! Hiện không có mặt hàng nào chạm ngưỡng tồn kho tối thiểu.',
          'get_inventory'
        );
      }

      const items = inv.items.slice(0, 8).map(
        p => `• ${p.name} (${p.product_code}): Còn ${p.stock_quantity} ${p.unit} (Ngưỡng cảnh báo: ${p.minimum_stock} ${p.unit})`
      ).join('\n');

      return formatResult(
        `⚠️ DANH SÁCH MẶT HÀNG SẮP HẾT CẦN NHẬP BỔ SUNG:\n\n${items}\n\n💡 Gợi ý: Bạn có thể vào mục Kho Hàng -> "Nhập Thêm Hàng" để nhập bổ sung ngay.`,
        'get_inventory',
        inv.items
      );
    }

    // -------------------------------------------------------------------------
    // 7. INTENT: Tra cứu danh mục hàng hóa (Category Inquiry)
    // -------------------------------------------------------------------------
    if (cleanQuery.includes('danh muc') || cleanQuery.includes('loai hang') ||
        cleanQuery.includes('nganh hang') || cleanQuery.includes('co nhung mat hang nao')) {
      let targetCat = '';
      const catMatch = rawQuery.match(/danh mục\s+(.+)/i) || rawQuery.match(/danh muc\s+(.+)/i);
      if (catMatch && !catMatch[1].includes('nào') && !catMatch[1].includes('nao') && !catMatch[1].includes('gì')) {
        targetCat = catMatch[1].trim();
      }

      const catData = await tools.getCategoriesWithProducts({ categoryName: targetCat });
      if (catData.found) {
        const prodList = catData.products.slice(0, 8).map(
          p => `• ${p.name} (${p.product_code}) - Giá: ${formatCurrency(p.selling_price)} - Còn: ${p.stock_quantity} ${p.unit}`
        ).join('\n');

        return formatResult(
          `📂 DANH MỤC "${catData.category.name.toUpperCase()}":\n${catData.category.description || ''}\n\nCác sản phẩm tiêu biểu:\n${prodList || 'Chưa có sản phẩm trong danh mục này.'}\n\nCập nhật lúc ${nowTimeStr}.`,
          'get_categories',
          catData
        );
      } else {
        const catList = catData.categories.map(
          (c, idx) => `${idx + 1}. ${c.name}: ${c.product_count} sản phẩm (${c.description || 'Không có mô tả'})`
        ).join('\n');

        return formatResult(
          `🗂️ DANH SÁCH DANH MỤC HÀNG HÓA TẠI CỬA HÀNG:\n\n${catList}\n\n💡 Gợi ý: Bạn có thể hỏi chi tiết hơn như "Danh mục ${catData.categories[0]?.name} có những gì?"`,
          'get_categories',
          catData.categories
        );
      }
    }

    // -------------------------------------------------------------------------
    // 8. INTENT: Thống kê doanh thu theo từng giờ trong ngày (Hourly Breakdown)
    // (e.g. "Doanh thu theo giờ hôm nay", "Thống kê theo từng khung giờ")
    // -------------------------------------------------------------------------
    const isHourlyBreakdown = (
      cleanQuery.includes('theo gio') || cleanQuery.includes('tung gio') ||
      cleanQuery.includes('cac khung gio') || cleanQuery.includes('tung khung gio')
    ) && (cleanQuery.includes('doanh thu') || cleanQuery.includes('ban hang') || cleanQuery.includes('don hang'));

    if (isHourlyBreakdown) {
      const breakdown = await tools.getHourlyBreakdown({ dateRangeText: rawQuery });
      if (!breakdown.hours || breakdown.hours.length === 0) {
        return formatResult(
          `Trong ngày ${breakdown.period}, cửa hàng chưa ghi nhận doanh thu trong bất kỳ khung giờ nào.\n\nDữ liệu cập nhật lúc ${nowTimeStr}.`,
          'get_hourly_breakdown',
          breakdown
        );
      }
      const lines = breakdown.hours.map(h => {
        const hourStr = `${String(h.hour).padStart(2, '0')}:00 - ${String(h.hour).padStart(2, '0')}:59`;
        return `• Khung ${hourStr}: ${formatCurrency(h.revenue)} (${h.invoiceCount} hóa đơn)`;
      }).join('\n');

      return formatResult(
        `📊 THỐNG KÊ DOANH THU THEO TỪNG KHUNG GIỜ (${breakdown.period}):\n\n${lines}\n\nDữ liệu cập nhật lúc ${nowTimeStr}.`,
        'get_hourly_breakdown',
        breakdown
      );
    }

    // -------------------------------------------------------------------------
    // 9. INTENT: Doanh thu & Bán hàng (Revenue & Sales Inquiry)
    // Hỗ trợ cả tra cứu theo ngày, theo tháng hoặc theo giờ cụ thể
    // (e.g. "Doanh thu hôm nay bao nhiêu?", "vào lúc 13 giờ hôm nay có doanh thu nào không")
    // -------------------------------------------------------------------------
    const isHourlyMention = /((?:vào lúc|vao luc|lúc|luc|khoảng|khoang|khung|khung giờ|khung gio)?\s*\d{1,2}\s*(?:giờ|gio|h)\b|\b\d{1,2}:[0-5]\d\b)/i.test(lower);

    const isRevenueQuery = (
      cleanQuery.includes('doanh thu') || cleanQuery.includes('doanh so') ||
      cleanQuery.includes('ban duoc bao nhieu tien') || cleanQuery.includes('thu duoc bao nhieu') ||
      cleanQuery.includes('tien ban duoc') || cleanQuery.includes('bao nhieu hoa don') ||
      (cleanQuery.includes('hom nay') && cleanQuery.includes('tien')) ||
      (cleanQuery.includes('hom qua') && cleanQuery.includes('tien')) ||
      (isHourlyMention && (
        cleanQuery.includes('co don') ||
        cleanQuery.includes('co ai mua') ||
        cleanQuery.includes('co ban') ||
        cleanQuery.includes('co khach') ||
        cleanQuery.includes('ban duoc') ||
        cleanQuery.includes('don nao') ||
        cleanQuery.includes('doanh thu')
      ))
    );

    if (isRevenueQuery) {
      const rev = await tools.getRevenue({ dateRangeText: rawQuery });

      // Nếu câu hỏi về một giờ hoặc khung giờ cụ thể
      if (rev.isHourly) {
        if (rev.invoiceCount === 0) {
          return formatResult(
            `Vào ${rev.period}, cửa hàng không có doanh thu nào (0đ, 0 hóa đơn hoàn thành).\n\n• Doanh thu: 0đ\n• Số đơn hoàn thành: 0 hóa đơn\n• Sản phẩm đã bán: 0 đơn vị\n\nDữ liệu cập nhật lúc ${nowTimeStr}.`,
            'get_revenue',
            rev
          );
        }
        return formatResult(
          `Vào ${rev.period}, cửa hàng có ghi nhận doanh thu:\n\n• Doanh thu thực tế: ${formatCurrency(rev.revenue)}\n• Số đơn hàng hoàn thành: ${rev.invoiceCount} hóa đơn\n• Tổng số sản phẩm đã bán: ${rev.unitsSold} đơn vị\n• Giá trị trung bình/đơn: ${formatCurrency(rev.revenue / rev.invoiceCount)}\n\nDữ liệu cập nhật lúc ${nowTimeStr}.`,
          'get_revenue',
          rev
        );
      }

      // Câu hỏi về ngày hoặc tháng
      if (rev.invoiceCount === 0) {
        return formatResult(
          `Trong kỳ ${rev.period}, cửa hàng chưa ghi nhận hóa đơn thanh toán nào.\n\n• Doanh thu: 0đ\n• Số lượng hóa đơn: 0\n\nDữ liệu cập nhật lúc ${nowTimeStr}.`,
          'get_revenue',
          rev
        );
      }
      return formatResult(
        `💰 BÁO CÁO DOANH THU (${rev.period}):\n\n• Doanh thu thực tế: ${formatCurrency(rev.revenue)}\n• Số đơn hàng hoàn thành: ${rev.invoiceCount} hóa đơn\n• Tổng số sản phẩm đã bán: ${rev.unitsSold} đơn vị\n• Giá trị trung bình/đơn: ${formatCurrency(rev.revenue / rev.invoiceCount)}\n\nDữ liệu cập nhật lúc ${nowTimeStr}.`,
        'get_revenue',
        rev
      );
    }

    // -------------------------------------------------------------------------
    // 10. INTENT: Bán gì / Chi tiết đơn hàng theo ngày hoặc theo giờ
    // (e.g. "Ngày 15 bán những gì?", "Lúc 13h bán những gì?")
    // -------------------------------------------------------------------------
    if (cleanQuery.includes('ban gi') || cleanQuery.includes('ban nhung san pham gi') ||
        cleanQuery.includes('co nhung don hang nao') || cleanQuery.includes('ban nhung mon gi')) {
      const salesData = await tools.getSalesByDate({ dateRangeText: rawQuery });
      if (!salesData || salesData.invoicesCount === 0) {
        return formatResult(
          `Trong kỳ ${salesData.period}, cửa hàng chưa ghi nhận hóa đơn nào được thanh toán.`,
          'get_sales_by_date',
          salesData
        );
      }

      const productList = salesData.productsSold.slice(0, 7).map(
        p => `• ${p.product_name}: ${p.total_quantity} ${p.unit || 'cái'} (${formatCurrency(p.total_amount)})`
      ).join('\n');

      return formatResult(
        `🛍️ CHI TIẾT BÁN HÀNG (${salesData.period}):\nĐã xuất ${salesData.invoicesCount} hóa đơn thành công.\n\nCác sản phẩm đã bán:\n${productList}\n\nCập nhật lúc ${nowTimeStr}.`,
        'get_sales_by_date',
        salesData
      );
    }

    // -------------------------------------------------------------------------
    // 11. INTENT: Số lượng đã bán của sản phẩm cụ thể
    // -------------------------------------------------------------------------
    const matchProdSales = rawQuery.match(/(.+?)\s+(?:bán được|da ban|đã bán)\s+(?:bao nhiêu|mấy)/i) ||
                           rawQuery.match(/(?:bán được|da ban|đã bán)\s+(?:bao nhiêu|mấy)\s+(.+)/i);

    if (matchProdSales && !cleanQuery.includes('tien') && !cleanQuery.includes('doanh thu')) {
      const prodName = (matchProdSales[1] || matchProdSales[2] || '')
        .replace(/sản phẩm|san pham|món|mon|hôm nay|hom nay|tháng này|thang nay/gi, '')
        .trim();

      if (prodName.length >= 2) {
        const res = await tools.getProductSales({ productName: prodName, dateRangeText: rawQuery });
        if (!res.matches || res.matches.length === 0) {
          return formatResult(
            `Không tìm thấy thông tin bán hàng của sản phẩm "${prodName}" trong kỳ ${res.period}.`,
            'get_product_sales'
          );
        }

        const info = res.matches.map(
          m => `• ${m.product_name} (${m.product_code}): đã bán ${m.total_sold} ${m.unit}, doanh thu ${formatCurrency(m.total_revenue)} (Hiện còn tồn: ${m.current_stock} ${m.unit})`
        ).join('\n');

        return formatResult(
          `📊 TÌNH HÌNH BÁN HÀNG SẢN PHẨM (${res.period}):\n\n${info}\n\nDữ liệu cập nhật lúc ${nowTimeStr}.`,
          'get_product_sales',
          res.matches
        );
      }
    }

    // -------------------------------------------------------------------------
    // 12. INTENT: Top sản phẩm bán chạy (Best Sellers)
    // -------------------------------------------------------------------------
    if (cleanQuery.includes('ban chay') || cleanQuery.includes('ban nhieu nhat') ||
        cleanQuery.includes('top san pham') || cleanQuery.includes('dat khach')) {
      const topRes = await tools.getTopProducts({ limit: 5, dateRangeText: rawQuery });
      if (!topRes.topProducts || topRes.topProducts.length === 0) {
        return formatResult(
          `Chưa ghi nhận số liệu sản phẩm bán ra trong kỳ ${topRes.period}.`,
          'get_top_products'
        );
      }

      const list = topRes.topProducts.map(
        (p, idx) => `${idx + 1}. ${p.product_name}: ${p.total_sold} ${p.unit || 'cái'} • Doanh số: ${formatCurrency(p.total_revenue)}`
      ).join('\n');

      return formatResult(
        `🏆 TOP SẢN PHẨM BÁN CHẠY NHẤT (${topRes.period}):\n\n${list}\n\nDữ liệu tính đến ${nowTimeStr}.`,
        'get_top_products',
        topRes.topProducts
      );
    }

    // -------------------------------------------------------------------------
    // 13. FALLBACK: Thử tìm kiếm sản phẩm xem người dùng có đang tra cứu mặt hàng nào không
    // -------------------------------------------------------------------------
    const fallbackSearch = await tools.searchProduct({ keyword: rawQuery });
    if (fallbackSearch.count > 0) {
      const list = fallbackSearch.products.slice(0, 5).map(
        p => `• ${p.name} (${p.product_code}): Giá bán ${formatCurrency(p.selling_price)} / ${p.unit} - Còn ${p.stock_quantity} ${p.unit} trong kho.`
      ).join('\n');

      return formatResult(
        `🔍 Tôi tìm thấy các sản phẩm liên quan đến câu hỏi của bạn:\n\n${list}\n\nBạn có thể hỏi thêm: "Giá của ${fallbackSearch.products[0].name}", hoặc "Còn bao nhiêu ${fallbackSearch.products[0].unit} ${fallbackSearch.products[0].name}?"`,
        'search_product',
        fallbackSearch.products
      );
    }

    // Fallback trợ giúp nếu không khớp
    return formatResult(
      `Tôi chưa hiểu rõ câu hỏi của bạn. Bạn có thể thử tra cứu theo các mẫu câu sau:\n\n• 🏷️ Hỏi giá: "Coca Cola giá bao nhiêu?", "Bánh ChocoPie giá mấy?"\n• 📦 Hỏi tồn kho: "Còn bao nhiêu lon Coca?", "Những mặt hàng nào sắp hết?"\n• 💰 Hỏi doanh thu: "Doanh thu hôm nay bao nhiêu?", "Vào lúc 13 giờ hôm nay có doanh thu nào không?"\n• 🏆 Hàng bán chạy: "Sản phẩm nào bán chạy nhất?"\n• 🗂️ Danh mục: "Có những danh mục nào?"\n• 📊 Dự báo: "Dự đoán doanh thu tháng tới?"`,
      null
    );
  }
}

module.exports = LangGraphAgent;
