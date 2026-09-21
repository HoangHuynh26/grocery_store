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
  startTime = null,
  endTime = null,
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

  // Date filtering (independent support for startDate and/or endDate)
  if (startDate) {
    // If startDate has time or timezone already
    let startTimestamp = startDate;
    if (!startDate.includes('T') && !startDate.includes(' ')) {
      startTimestamp = `${startDate}T00:00:00+07:00`;
    }
    whereClauses.push(`i.created_at >= $${idx++}`);
    params.push(startTimestamp);
  }

  if (endDate) {
    let endTimestamp = endDate;
    if (!endDate.includes('T') && !endDate.includes(' ')) {
      endTimestamp = `${endDate}T23:59:59+07:00`;
    }
    whereClauses.push(`i.created_at <= $${idx++}`);
    params.push(endTimestamp);
  }

  // Time-of-day filtering (e.g. for shifts: 06:00 to 12:00)
  if (startTime) {
    const formattedStartTime = startTime.length === 5 ? `${startTime}:00` : startTime;
    whereClauses.push(`(i.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time >= $${idx++}::time`);
    params.push(formattedStartTime);
  }

  if (endTime) {
    const formattedEndTime = endTime.length === 5 ? `${endTime}:59` : endTime;
    whereClauses.push(`(i.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time <= $${idx++}::time`);
    params.push(formattedEndTime);
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

  // Aggregate summary & total count for the filtered period
  const countSql = `
    SELECT 
      COUNT(DISTINCT i.id) as total,
      COALESCE(SUM(i.total_amount), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' THEN i.total_amount ELSE 0 END), 0) as cash_revenue,
      COALESCE(SUM(CASE WHEN p.payment_method = 'TRANSFER' THEN i.total_amount ELSE 0 END), 0) as transfer_revenue
    FROM invoices i
    LEFT JOIN users u ON i.user_id = u.id
    LEFT JOIN payments p ON i.id = p.invoice_id
    ${whereSql};
  `;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);
  const totalRevenue = parseFloat(countRes.rows[0]?.total_revenue || 0);
  const cashRevenue = parseFloat(countRes.rows[0]?.cash_revenue || 0);
  const transferRevenue = parseFloat(countRes.rows[0]?.transfer_revenue || 0);
  const averageOrderValue = total > 0 ? Math.round(totalRevenue / total) : 0;

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
  // Create pagination params copy to preserve original params for countSql
  const dataParams = [...params, limit, offset];
  const dataRes = await query(dataSql, dataParams);

  return {
    items: dataRes.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      totalOrders: total,
      totalRevenue,
      cashRevenue,
      transferRevenue,
      averageOrderValue
    }
  };
}

module.exports = {
  findByIdempotencyKey,
  findById,
  listInvoices
};
