const { query } = require('../../../database');
const { parseVietnameseNaturalDate } = require('./dateParser');
const ForecastService = require('../forecasting/forecastService');

const tools = {
  /**
   * Tool: get_revenue
   */
  async getRevenue({ dateRangeText }) {
    const range = parseVietnameseNaturalDate(dateRangeText) || parseVietnameseNaturalDate('hôm nay');
    const sql = `
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(id) as invoice_count
      FROM invoices
      WHERE created_at >= $1 AND created_at <= $2 AND status != 'CANCELLED';
    `;
    const res = await query(sql, [range.startDate, range.endDate]);
    const row = res.rows[0];

    const itemsSql = `
      SELECT COALESCE(SUM(quantity), 0) as total_units
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.created_at >= $1 AND i.created_at <= $2 AND i.status != 'CANCELLED';
    `;
    const itemsRes = await query(itemsSql, [range.startDate, range.endDate]);

    return {
      period: range.label,
      revenue: parseFloat(row.total_revenue),
      invoiceCount: parseInt(row.invoice_count, 10),
      unitsSold: parseInt(itemsRes.rows[0]?.total_units || 0, 10)
    };
  },

  /**
   * Tool: get_sales_by_date
   */
  async getSalesByDate({ dateRangeText }) {
    const range = parseVietnameseNaturalDate(dateRangeText) || parseVietnameseNaturalDate('hôm nay');
    const invSql = `
      SELECT id, invoice_number, total_amount, created_at
      FROM invoices
      WHERE created_at >= $1 AND created_at <= $2 AND status != 'CANCELLED'
      ORDER BY created_at DESC;
    `;
    const invRes = await query(invSql, [range.startDate, range.endDate]);

    const itemsSql = `
      SELECT 
        ii.product_name,
        p.unit,
        SUM(ii.quantity) as total_quantity,
        SUM(ii.total_price) as total_amount
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE i.created_at >= $1 AND i.created_at <= $2 AND i.status != 'CANCELLED'
      GROUP BY ii.product_name, p.unit
      ORDER BY total_quantity DESC;
    `;
    const itemsRes = await query(itemsSql, [range.startDate, range.endDate]);

    return {
      period: range.label,
      invoicesCount: invRes.rowCount,
      invoices: invRes.rows,
      productsSold: itemsRes.rows
    };
  },

  /**
   * Tool: get_product_sales
   */
  async getProductSales({ productName, dateRangeText }) {
    const range = parseVietnameseNaturalDate(dateRangeText) || parseVietnameseNaturalDate('tháng này');
    const sql = `
      SELECT 
        ii.product_name,
        p.product_code,
        p.unit,
        p.stock_quantity as current_stock,
        COALESCE(SUM(ii.quantity), 0) as total_sold,
        COALESCE(SUM(ii.total_price), 0) as total_revenue
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE LOWER(ii.product_name) LIKE $1
        AND i.created_at >= $2 AND i.created_at <= $3 AND i.status != 'CANCELLED'
      GROUP BY ii.product_name, p.product_code, p.unit, p.stock_quantity;
    `;
    const res = await query(sql, [
      `%${(productName || '').toLowerCase().trim()}%`,
      range.startDate,
      range.endDate
    ]);

    return {
      period: range.label,
      matches: res.rows
    };
  },

  /**
   * Tool: get_top_products
   */
  async getTopProducts({ limit = 5, dateRangeText }) {
    const range = parseVietnameseNaturalDate(dateRangeText) || parseVietnameseNaturalDate('tháng này');
    const sql = `
      SELECT 
        ii.product_name,
        p.unit,
        SUM(ii.quantity) as total_sold,
        SUM(ii.total_price) as total_revenue
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE i.created_at >= $1 AND i.created_at <= $2 AND i.status != 'CANCELLED'
      GROUP BY ii.product_name, p.unit
      ORDER BY total_sold DESC
      LIMIT $3;
    `;
    const res = await query(sql, [range.startDate, range.endDate, limit]);
    return {
      period: range.label,
      topProducts: res.rows
    };
  },

  /**
   * Tool: get_inventory
   */
  async getInventory({ lowStockOnly = false }) {
    const whereSql = lowStockOnly ? 'WHERE stock_quantity <= minimum_stock AND is_active = TRUE' : 'WHERE is_active = TRUE';
    const sql = `
      SELECT product_code, name, stock_quantity, minimum_stock, unit, selling_price
      FROM products
      ${whereSql}
      ORDER BY stock_quantity ASC
      LIMIT 20;
    `;
    const res = await query(sql);
    return {
      items: res.rows,
      count: res.rowCount
    };
  },

  /**
   * Tool: get_forecast
   */
  async getForecast() {
    return await ForecastService.getLatestForecast();
  }
};

module.exports = tools;
