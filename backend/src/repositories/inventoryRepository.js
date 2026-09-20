const { query } = require('../database');

async function getInventoryList({
  search = '',
  lowStockOnly = false,
  page = 1,
  limit = 20
}) {
  const offset = (page - 1) * limit;
  const whereClauses = ['p.is_active = TRUE'];
  const params = [];
  let idx = 1;

  if (lowStockOnly) {
    whereClauses.push(`p.stock_quantity <= p.minimum_stock`);
  }

  if (search) {
    whereClauses.push(`(LOWER(p.name) LIKE $${idx} OR LOWER(p.product_code) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`);
    idx++;
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const countSql = `SELECT COUNT(*) as total FROM products p ${whereSql};`;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const dataSql = `
    SELECT 
      p.id,
      p.product_code,
      p.name,
      p.unit,
      p.cost_price,
      p.selling_price,
      p.stock_quantity as current_stock,
      p.minimum_stock,
      (p.stock_quantity * p.cost_price) as stock_value,
      p.updated_at as last_update,
      CASE WHEN p.stock_quantity <= p.minimum_stock THEN TRUE ELSE FALSE END as is_low_stock,
      c.name as category_name,
      COALESCE(sales.total_sold, 0) as total_sold,
      COALESCE(imports.total_imported, 0) as total_imported,
      imports.last_import_date
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) as total_sold
      FROM invoice_items
      GROUP BY product_id
    ) sales ON p.id = sales.product_id
    LEFT JOIN (
      SELECT 
        product_id, 
        SUM(quantity_change) as total_imported,
        MAX(created_at) as last_import_date
      FROM inventory_transactions
      WHERE transaction_type = 'IMPORT'
      GROUP BY product_id
    ) imports ON p.id = imports.product_id
    ${whereSql}
    ORDER BY is_low_stock DESC, p.stock_quantity ASC
    LIMIT $${idx++} OFFSET $${idx++};
  `;
  params.push(limit, offset);
  const dataRes = await query(dataSql, params);

  // Summary KPI across all active products
  const summarySql = `
    SELECT 
      COUNT(*) as total_products,
      SUM(stock_quantity) as total_stock_units,
      SUM(stock_quantity * cost_price) as total_inventory_cost_value,
      SUM(stock_quantity * selling_price) as total_inventory_retail_value,
      COUNT(*) FILTER (WHERE stock_quantity <= minimum_stock) as low_stock_count
    FROM products
    WHERE is_active = TRUE;
  `;
  const summaryRes = await query(summarySql);
  const summary = summaryRes.rows[0] || {};

  return {
    items: dataRes.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      totalProducts: parseInt(summary.total_products || '0', 10),
      totalStockUnits: parseInt(summary.total_stock_units || '0', 10),
      totalInventoryCostValue: parseFloat(summary.total_inventory_cost_value || '0'),
      totalInventoryRetailValue: parseFloat(summary.total_inventory_retail_value || '0'),
      lowStockCount: parseInt(summary.low_stock_count || '0', 10)
    }
  };
}

async function createTransaction({
  productId,
  transactionType,
  quantityBefore,
  quantityChange,
  quantityAfter,
  unitCost = 0,
  userId = null,
  referenceId = null,
  reason = null,
  dbClient = null
}) {
  const sql = `
    INSERT INTO inventory_transactions (
      product_id, transaction_type, quantity_before, quantity_change, quantity_after,
      unit_cost, user_id, reference_id, reason, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING *;
  `;
  const params = [
    productId,
    transactionType,
    quantityBefore,
    quantityChange,
    quantityAfter,
    unitCost,
    userId,
    referenceId,
    reason
  ];

  if (dbClient) {
    const res = await dbClient.query(sql, params);
    return res.rows[0];
  }
  const res = await query(sql, params);
  return res.rows[0];
}

async function listTransactions({
  productId = null,
  transactionType = null,
  startDate = null,
  endDate = null,
  page = 1,
  limit = 20
}) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const params = [];
  let idx = 1;

  if (productId) {
    whereClauses.push(`it.product_id = $${idx++}`);
    params.push(productId);
  }

  if (transactionType) {
    whereClauses.push(`it.transaction_type = $${idx++}`);
    params.push(transactionType);
  }

  if (startDate && endDate) {
    whereClauses.push(`it.created_at >= $${idx++} AND it.created_at <= $${idx++}`);
    params.push(startDate, endDate);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM inventory_transactions it ${whereSql};`;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const dataSql = `
    SELECT 
      it.*,
      p.product_code,
      p.name as product_name,
      p.unit as product_unit,
      u.full_name as user_full_name,
      u.username as user_username
    FROM inventory_transactions it
    LEFT JOIN products p ON it.product_id = p.id
    LEFT JOIN users u ON it.user_id = u.id
    ${whereSql}
    ORDER BY it.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++};
  `;
  params.push(limit, offset);
  const dataRes = await query(dataSql, params);

  return {
    items: dataRes.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

module.exports = {
  getInventoryList,
  createTransaction,
  listTransactions
};
