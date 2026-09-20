const { query } = require('../../../database');
const { parseVietnameseNaturalDate } = require('./dateParser');
const { removeVietnameseAccents } = require('../../../utils/text');
const ForecastService = require('../forecasting/forecastService');

const tools = {
  /**
   * Tool: search_product (Search products by name/SKU, get prices, stock, units)
   */
  async searchProduct({ keyword }) {
    const raw = (keyword || '').trim();
    if (!raw) return { products: [], count: 0 };
    const clean = removeVietnameseAccents(raw.toLowerCase());

    const sql = `
      SELECT 
        p.id, p.product_code, p.name, p.selling_price, p.cost_price, 
        p.stock_quantity, p.minimum_stock, p.unit, p.qr_code_token,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE
        AND (
          LOWER(p.name) LIKE $1 
          OR LOWER(p.product_code) LIKE $1
          OR LOWER(c.name) LIKE $1
        )
      ORDER BY 
        CASE WHEN LOWER(p.name) LIKE $2 THEN 0 ELSE 1 END,
        p.name ASC
      LIMIT 10;
    `;
    const res = await query(sql, [`%${raw.toLowerCase()}%`, `${raw.toLowerCase()}%`]);
    let products = res.rows;

    if (products.length === 0) {
      const allRes = await query(`
        SELECT p.id, p.product_code, p.name, p.selling_price, p.cost_price, 
               p.stock_quantity, p.minimum_stock, p.unit, p.qr_code_token,
               c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = TRUE
        LIMIT 300;
      `);
      products = allRes.rows.filter(p => {
        const pClean = removeVietnameseAccents(p.name.toLowerCase());
        const codeClean = removeVietnameseAccents(p.product_code.toLowerCase());
        return pClean.includes(clean) || codeClean.includes(clean);
      }).slice(0, 10);
    }

    return {
      keyword: raw,
      products,
      count: products.length
    };
  },

  /**
   * Tool: get_store_summary (Overall Store Stats: Products count, total inventory value, low stock, today revenue)
   */
  async getStoreSummary() {
    const prodRes = await query(`
      SELECT 
        COUNT(*) as total_products,
        COALESCE(SUM(stock_quantity), 0) as total_units,
        COALESCE(SUM(cost_price * stock_quantity), 0) as total_cost_value,
        COUNT(*) FILTER (WHERE stock_quantity <= minimum_stock) as low_stock_count,
        COUNT(*) FILTER (WHERE stock_quantity = 0) as out_of_stock_count
      FROM products
      WHERE is_active = TRUE;
    `);

    const catRes = await query(`SELECT COUNT(*) as total_categories FROM categories WHERE is_active = TRUE;`);
    const userRes = await query(`SELECT COUNT(*) as total_staff FROM users WHERE is_active = TRUE;`);

    const range = parseVietnameseNaturalDate('hôm nay');
    const todaySales = await query(`
      SELECT COALESCE(SUM(total_amount), 0) as today_revenue, COUNT(*) as today_invoices
      FROM invoices
      WHERE created_at >= $1 AND created_at <= $2 AND status != 'CANCELLED';
    `, [range.startDate, range.endDate]);

    const prod = prodRes.rows[0];
    return {
      totalProducts: parseInt(prod.total_products, 10),
      totalStockUnits: parseInt(prod.total_units, 10),
      totalInventoryCostValue: parseFloat(prod.total_cost_value),
      lowStockCount: parseInt(prod.low_stock_count, 10),
      outOfStockCount: parseInt(prod.out_of_stock_count, 10),
      totalCategories: parseInt(catRes.rows[0].total_categories, 10),
      totalStaff: parseInt(userRes.rows[0].total_staff, 10),
      todayRevenue: parseFloat(todaySales.rows[0].today_revenue),
      todayInvoices: parseInt(todaySales.rows[0].today_invoices, 10)
    };
  },

  /**
   * Tool: get_categories (Get category lists or products inside a specific category)
   */
  async getCategoriesWithProducts({ categoryName = '' }) {
    if (categoryName && categoryName.trim()) {
      const clean = removeVietnameseAccents(categoryName.toLowerCase().trim());
      const catSql = `
        SELECT c.id, c.name, c.slug, c.description,
               COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_active = TRUE
        WHERE c.is_active = TRUE
        GROUP BY c.id, c.name, c.slug, c.description;
      `;
      const catRes = await query(catSql);
      const matched = catRes.rows.find(c => {
        const cClean = removeVietnameseAccents(c.name.toLowerCase());
        const slugClean = (c.slug || '').toLowerCase();
        return cClean.includes(clean) || clean.includes(cClean) || slugClean.includes(clean);
      });

      if (matched) {
        const prodRes = await query(`
          SELECT name, product_code, selling_price, stock_quantity, unit
          FROM products
          WHERE category_id = $1 AND is_active = TRUE
          ORDER BY name ASC
          LIMIT 20;
        `, [matched.id]);
        return {
          found: true,
          category: matched,
          products: prodRes.rows
        };
      }
    }

    const allCatSql = `
      SELECT c.id, c.name, c.slug, c.description,
             COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = TRUE
      WHERE c.is_active = TRUE
      GROUP BY c.id, c.name, c.slug, c.description
      ORDER BY product_count DESC, c.name ASC;
    `;
    const allRes = await query(allCatSql);
    return {
      found: false,
      categories: allRes.rows
    };
  },

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
      SELECT product_code, name, stock_quantity, minimum_stock, unit, selling_price, cost_price
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
