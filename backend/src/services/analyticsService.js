const { query } = require('../database');
const { getDateRangeBoundaries, VN_OFFSET_HOURS } = require('../utils/timezone');

class AnalyticsService {
  /**
   * Quick Dashboard Summary KPIs
   */
  static async getDashboardSummary() {
    // 1. Time boundaries
    const today = getDateRangeBoundaries('today');
    const yesterday = getDateRangeBoundaries('yesterday');
    const thisMonth = getDateRangeBoundaries('this_month');
    const thisYear = getDateRangeBoundaries('this_year');

    // Revenue queries for periods
    const todayRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as invoice_count
       FROM invoices
       WHERE created_at >= $1 AND created_at <= $2 AND status != 'CANCELLED';`,
      [today.startDate, today.endDate]
    );

    const yesterdayRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue
       FROM invoices
       WHERE created_at >= $1 AND created_at <= $2 AND status != 'CANCELLED';`,
      [yesterday.startDate, yesterday.endDate]
    );

    const thisMonthRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as invoice_count
       FROM invoices
       WHERE created_at >= $1 AND created_at <= $2 AND status != 'CANCELLED';`,
      [thisMonth.startDate, thisMonth.endDate]
    );

    const thisYearRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue
       FROM invoices
       WHERE created_at >= $1 AND created_at <= $2 AND status != 'CANCELLED';`,
      [thisYear.startDate, thisYear.endDate]
    );

    // Products sold today
    const soldTodayRes = await query(
      `SELECT COALESCE(SUM(ii.quantity), 0) as units_sold
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.created_at >= $1 AND i.created_at <= $2 AND i.status != 'CANCELLED';`,
      [today.startDate, today.endDate]
    );

    // Inventory value & low stock count
    const stockRes = await query(
      `SELECT 
        COALESCE(SUM(stock_quantity * cost_price), 0) as total_cost_value,
        COALESCE(SUM(stock_quantity * selling_price), 0) as total_retail_value,
        COUNT(*) FILTER (WHERE stock_quantity <= minimum_stock) as low_stock_count
       FROM products
       WHERE is_active = TRUE;`
    );

    // Top 5 selling products this month
    const topProductsRes = await query(
      `SELECT 
        ii.product_name,
        p.product_code,
        p.unit,
        p.image_url,
        SUM(ii.quantity) as total_sold_units,
        SUM(ii.total_price) as total_sales_amount
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE i.created_at >= $1 AND i.created_at <= $2 AND i.status != 'CANCELLED'
       GROUP BY ii.product_name, p.product_code, p.unit, p.image_url
       ORDER BY total_sold_units DESC
       LIMIT 5;`,
      [thisMonth.startDate, thisMonth.endDate]
    );

    // Low stock items preview
    const lowStockPreviewRes = await query(
      `SELECT id, product_code, name, stock_quantity, minimum_stock, unit
       FROM products
       WHERE is_active = TRUE AND stock_quantity <= minimum_stock
       ORDER BY stock_quantity ASC
       LIMIT 5;`
    );

    return {
      todayRevenue: parseFloat(todayRes.rows[0]?.revenue || 0),
      todayInvoicesCount: parseInt(todayRes.rows[0]?.invoice_count || 0, 10),
      todaySoldUnits: parseInt(soldTodayRes.rows[0]?.units_sold || 0, 10),
      yesterdayRevenue: parseFloat(yesterdayRes.rows[0]?.revenue || 0),
      thisMonthRevenue: parseFloat(thisMonthRes.rows[0]?.revenue || 0),
      thisMonthInvoicesCount: parseInt(thisMonthRes.rows[0]?.invoice_count || 0, 10),
      thisYearRevenue: parseFloat(thisYearRes.rows[0]?.revenue || 0),
      inventoryCostValue: parseFloat(stockRes.rows[0]?.total_cost_value || 0),
      inventoryRetailValue: parseFloat(stockRes.rows[0]?.total_retail_value || 0),
      lowStockCount: parseInt(stockRes.rows[0]?.low_stock_count || 0, 10),
      topSellingProducts: topProductsRes.rows,
      lowStockItems: lowStockPreviewRes.rows
    };
  }

  /**
   * Detailed Revenue & Sales Chart Data by period
   */
  static async getChartData(period = '7days', customStart = null, customEnd = null) {
    const range = getDateRangeBoundaries(period, customStart, customEnd);

    // Group sales by day in Asia/Ho_Chi_Minh timezone
    const sql = `
      SELECT 
        TO_CHAR(created_at + INTERVAL '${VN_OFFSET_HOURS} hours', 'YYYY-MM-DD') as day_label,
        TO_CHAR(created_at + INTERVAL '${VN_OFFSET_HOURS} hours', 'DD/MM') as display_date,
        COUNT(id) as invoice_count,
        COALESCE(SUM(total_amount), 0) as total_revenue
      FROM invoices
      WHERE created_at >= $1 AND created_at <= $2 AND status != 'CANCELLED'
      GROUP BY day_label, display_date
      ORDER BY day_label ASC;
    `;
    const res = await query(sql, [range.startDate, range.endDate]);

    // Payment method breakdown
    const paymentBreakdownSql = `
      SELECT 
        p.payment_method,
        COUNT(i.id) as count,
        COALESCE(SUM(i.total_amount), 0) as total_amount
      FROM invoices i
      JOIN payments p ON i.id = p.invoice_id
      WHERE i.created_at >= $1 AND i.created_at <= $2 AND i.status != 'CANCELLED'
      GROUP BY p.payment_method;
    `;
    const payRes = await query(paymentBreakdownSql, [range.startDate, range.endDate]);

    // Category breakdown
    const categoryBreakdownSql = `
      SELECT 
        COALESCE(c.name, 'Chưa phân loại') as category_name,
        SUM(ii.quantity) as total_units,
        SUM(ii.total_price) as total_revenue
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN products p ON ii.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE i.created_at >= $1 AND i.created_at <= $2 AND i.status != 'CANCELLED'
      GROUP BY c.name
      ORDER BY total_revenue DESC;
    `;
    const catRes = await query(categoryBreakdownSql, [range.startDate, range.endDate]);

    return {
      period,
      startDate: range.startDate,
      endDate: range.endDate,
      dailyTrend: res.rows,
      paymentBreakdown: payRes.rows,
      categoryBreakdown: catRes.rows
    };
  }
}

module.exports = AnalyticsService;
