const { query } = require('../database');

async function findByIdempotencyKey(key, dbClient = null) {
  if (!key) return null;
  const sql = `
    SELECT i.*, p.payment_method, p.payment_status, p.amount_paid, p.change_amount
    FROM invoices i
    LEFT JOIN payments p ON i.id = p.invoice_id
    WHERE i.idempotency_key = $1;
  `;
  const executor = dbClient ? dbClient.query.bind(dbClient) : query;
  const res = await executor(sql, [key]);
  return res.rows[0] || null;
}

async function findById(id) {
  const invoiceSql = `
    SELECT 
      i.*,
      u.full_name as created_by_name,
      u.username as created_by_username,
      p.payment_method,
      p.payment_status,
      p.amount_due,
      p.amount_paid,
      p.change_amount,
      p.transaction_reference
    FROM invoices i
    LEFT JOIN users u ON i.user_id = u.id
    LEFT JOIN payments p ON i.id = p.invoice_id
    WHERE i.id = $1;
  `;
  const invRes = await query(invoiceSql, [id]);
  if (invRes.rowCount === 0) return null;

  const invoice = invRes.rows[0];

  const itemsSql = `
    SELECT ii.*, p.image_url as current_image_url
    FROM invoice_items ii
    LEFT JOIN products p ON ii.product_id = p.id
    WHERE ii.invoice_id = $1
    ORDER BY ii.created_at ASC;
  `;
  const itemsRes = await query(itemsSql, [id]);
  invoice.items = itemsRes.rows;

  // Fetch related audit logs for this invoice
  const logsSql = `
    SELECT a.*, u.full_name as actor_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.entity_type = 'INVOICE' AND a.entity_id = $1
    ORDER BY a.created_at DESC;
  `;
  const logsRes = await query(logsSql, [id]);
  invoice.audit_logs = logsRes.rows;

  return invoice;
}

async function listInvoices({
  search = '',
  startDate = null,
  endDate = null,
  userId = null,
  paymentMethod = null,
  status = null,
  page = 1,
  limit = 20
}) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const params = [];
  let idx = 1;

  if (search) {
    whereClauses.push(`(LOWER(i.invoice_number) LIKE $${idx} OR LOWER(u.full_name) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`);
    idx++;
  }

  if (startDate && endDate) {
    whereClauses.push(`i.created_at >= $${idx++} AND i.created_at <= $${idx++}`);
    params.push(startDate, endDate);
  }

  if (userId) {
    whereClauses.push(`i.user_id = $${idx++}`);
    params.push(userId);
  }

  if (status) {
    whereClauses.push(`i.status = $${idx++}`);
    params.push(status);
  }

  if (paymentMethod) {
    whereClauses.push(`p.payment_method = $${idx++}`);
    params.push(paymentMethod);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(DISTINCT i.id) as total
    FROM invoices i
    LEFT JOIN users u ON i.user_id = u.id
    LEFT JOIN payments p ON i.id = p.invoice_id
    ${whereSql};
  `;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const dataSql = `
    SELECT 
      i.id,
      i.invoice_number,
      i.total_amount,
      i.status,
      i.created_at,
      u.full_name as created_by_name,
      p.payment_method,
      p.payment_status,
      COUNT(ii.id) as items_count,
      SUM(ii.quantity) as total_units_sold
    FROM invoices i
    LEFT JOIN users u ON i.user_id = u.id
    LEFT JOIN payments p ON i.id = p.invoice_id
    LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
    ${whereSql}
    GROUP BY i.id, u.full_name, p.payment_method, p.payment_status
    ORDER BY i.created_at DESC
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
  findByIdempotencyKey,
  findById,
  listInvoices
};
