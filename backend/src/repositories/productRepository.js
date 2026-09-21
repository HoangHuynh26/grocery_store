const { query } = require('../database');

async function listProducts({
  search = '',
  categoryId = null,
  lowStockOnly = false,
  onlyActive = true,
  page = 1,
  limit = 20,
  sortBy = 'name',
  sortOrder = 'ASC'
}) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const params = [];
  let idx = 1;

  if (onlyActive) {
    whereClauses.push(`p.is_active = TRUE`);
  }

  if (lowStockOnly) {
    whereClauses.push(`p.stock_quantity <= p.minimum_stock`);
  }

  if (categoryId) {
    whereClauses.push(`p.category_id = $${idx++}`);
    params.push(categoryId);
  }

  if (search) {
    whereClauses.push(
      `(LOWER(p.name) LIKE $${idx} OR LOWER(p.product_code) LIKE $${idx} OR LOWER(p.qr_code_token) LIKE $${idx} OR LOWER(c.name) LIKE $${idx})`
    );
    params.push(`%${search.toLowerCase()}%`);
    idx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Allowed sorting columns to prevent SQL injection
  const allowedSortCols = {
    name: 'p.name',
    product_code: 'p.product_code',
    stock_quantity: 'p.stock_quantity',
    selling_price: 'p.selling_price',
    created_at: 'p.created_at'
  };
  const sortCol = allowedSortCols[sortBy] || 'p.name';
  const orderDir = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const countSql = `
    SELECT COUNT(*) as total 
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereSql};
  `;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const dataSql = `
    SELECT 
      p.*,
      c.name as category_name,
      c.slug as category_slug,
      u1.full_name as created_by_name,
      u2.full_name as updated_by_name,
      CASE WHEN p.stock_quantity <= p.minimum_stock THEN TRUE ELSE FALSE END as is_low_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN users u1 ON p.created_by = u1.id
    LEFT JOIN users u2 ON p.updated_by = u2.id
    ${whereSql}
    ORDER BY ${sortCol} ${orderDir}
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

async function findById(id) {
  const sql = `
    SELECT 
      p.*,
      c.name as category_name,
      c.slug as category_slug,
      CASE WHEN p.stock_quantity <= p.minimum_stock THEN TRUE ELSE FALSE END as is_low_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = $1;
  `;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

async function findByCode(productCode) {
  const sql = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE LOWER(p.product_code) = LOWER($1);
  `;
  const res = await query(sql, [productCode]);
  return res.rows[0] || null;
}

async function findByQrToken(qrToken) {
  const sql = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE (p.qr_code_token = $1 OR LOWER(p.product_code) = LOWER($1)) AND p.is_active = TRUE;
  `;
  const res = await query(sql, [qrToken]);
  return res.rows[0] || null;
}

async function createProduct({
  productCode,
  name,
  categoryId,
  description,
  imageUrl,
  costPrice,
  sellingPrice,
  stockQuantity = 0,
  minimumStock = 5,
  unit = 'cái',
  qrCodeToken = null,
  hasQr = true,
  userId
}) {
  const sql = `
    INSERT INTO products (
      product_code, name, category_id, description, image_url,
      cost_price, selling_price, stock_quantity, minimum_stock, unit,
      qr_code_token, has_qr, is_active, created_by, updated_by, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, TRUE, $13, $13, NOW(), NOW()
    ) RETURNING *;
  `;
  const res = await query(sql, [
    productCode,
    name,
    categoryId || null,
    description || '',
    imageUrl || '',
    costPrice,
    sellingPrice,
    stockQuantity,
    minimumStock,
    unit,
    qrCodeToken,
    hasQr,
    userId
  ]);
  return res.rows[0];
}

async function updateProduct(id, fields, userId) {
  const allowed = [
    'name', 'product_code', 'category_id', 'description', 'image_url',
    'cost_price', 'selling_price', 'minimum_stock', 'unit', 'has_qr', 'qr_code_token', 'is_active'
  ];
  const updates = [];
  const params = [id];
  let idx = 2;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = $${idx++}`);
      params.push(fields[key]);
    }
  }

  updates.push(`updated_by = $${idx++}`);
  params.push(userId);
  updates.push(`updated_at = NOW()`);

  const sql = `
    UPDATE products
    SET ${updates.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;
  const res = await query(sql, params);
  return res.rows[0] || null;
}

async function softDeleteProduct(id, userId) {
  const sql = `
    UPDATE products
    SET is_active = FALSE, updated_by = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;
  const res = await query(sql, [id, userId]);
  return res.rows[0] || null;
}

async function getTopSellingProducts({ limit = 10 } = {}) {
  const sql = `
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
  `;
  const res = await query(sql, [limit]);
  return res.rows;
}

module.exports = {
  listProducts,
  findById,
  findByCode,
  findByQrToken,
  createProduct,
  updateProduct,
  softDeleteProduct,
  getTopSellingProducts
};
