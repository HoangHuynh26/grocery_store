const { query } = require('../database');

async function createAuditLog({
  userId = null,
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  reason = null,
  ipAddress = null,
  userAgent = null,
  dbClient = null
}) {
  const sql = `
    INSERT INTO audit_logs (
      user_id, action, entity_type, entity_id,
      old_values, new_values, reason, ip_address, user_agent, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING *;
  `;
  const params = [
    userId,
    action,
    entityType,
    String(entityId),
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    reason,
    ipAddress,
    userAgent
  ];

  if (dbClient) {
    const res = await dbClient.query(sql, params);
    return res.rows[0];
  }
  const res = await query(sql, params);
  return res.rows[0];
}

async function getAuditLogs({
  startDate,
  endDate,
  userId,
  action,
  entityType,
  page = 1,
  limit = 20
}) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const params = [];
  let paramIdx = 1;

  if (startDate && endDate) {
    whereClauses.push(`a.created_at >= $${paramIdx++} AND a.created_at <= $${paramIdx++}`);
    params.push(startDate, endDate);
  }

  if (userId) {
    whereClauses.push(`a.user_id = $${paramIdx++}`);
    params.push(userId);
  }

  if (action) {
    whereClauses.push(`a.action = $${paramIdx++}`);
    params.push(action);
  }

  if (entityType) {
    whereClauses.push(`a.entity_type = $${paramIdx++}`);
    params.push(entityType);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM audit_logs a ${whereSql};`;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const dataSql = `
    SELECT 
      a.*,
      u.full_name as user_full_name,
      u.username as user_username,
      u.role as user_role
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ${whereSql}
    ORDER BY a.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++};
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
  createAuditLog,
  getAuditLogs
};
