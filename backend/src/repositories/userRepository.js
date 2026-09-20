const { query } = require('../database');

async function findByUsernameOrEmail(identifier) {
  const sql = `
    SELECT * FROM users 
    WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1))
    LIMIT 1;
  `;
  const res = await query(sql, [identifier]);
  return res.rows[0] || null;
}

async function findById(id) {
  const sql = `
    SELECT id, username, email, full_name, phone, role, is_active, created_at, updated_at
    FROM users 
    WHERE id = $1;
  `;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

async function createUser({ username, email, passwordHash, fullName, phone, role }) {
  const sql = `
    INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
    RETURNING id, username, email, full_name, phone, role, is_active, created_at;
  `;
  const res = await query(sql, [username, email, passwordHash, fullName, phone, role]);
  return res.rows[0];
}

async function updateUser(id, { fullName, phone, role, isActive, passwordHash }) {
  const updates = [];
  const params = [id];
  let idx = 2;

  if (fullName !== undefined) {
    updates.push(`full_name = $${idx++}`);
    params.push(fullName);
  }
  if (phone !== undefined) {
    updates.push(`phone = $${idx++}`);
    params.push(phone);
  }
  if (role !== undefined) {
    updates.push(`role = $${idx++}`);
    params.push(role);
  }
  if (isActive !== undefined) {
    updates.push(`is_active = $${idx++}`);
    params.push(isActive);
  }
  if (passwordHash !== undefined) {
    updates.push(`password_hash = $${idx++}`);
    params.push(passwordHash);
  }
  updates.push(`updated_at = NOW()`);

  const sql = `
    UPDATE users 
    SET ${updates.join(', ')} 
    WHERE id = $1
    RETURNING id, username, email, full_name, phone, role, is_active, updated_at;
  `;
  const res = await query(sql, params);
  return res.rows[0] || null;
}

async function listUsers({ page = 1, limit = 20, search = '' }) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const params = [];
  let idx = 1;

  if (search) {
    whereClauses.push(`(LOWER(username) LIKE $${idx} OR LOWER(full_name) LIKE $${idx} OR LOWER(email) LIKE $${idx})`);
    params.push(`%${search.toLowerCase()}%`);
    idx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) as total FROM users ${whereSql};`, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  params.push(limit, offset);
  const sql = `
    SELECT id, username, email, full_name, phone, role, is_active, created_at, updated_at
    FROM users
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${idx++} OFFSET $${idx++};
  `;
  const res = await query(sql, params);

  return {
    items: res.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

async function recordLoginLog({ userId, username, ipAddress, userAgent, status, failureReason }) {
  const sql = `
    INSERT INTO login_logs (user_id, username, ip_address, user_agent, status, failure_reason, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW());
  `;
  await query(sql, [userId, username, ipAddress, userAgent, status, failureReason]);
}

async function getLoginLogs({ limit = 30 }) {
  const sql = `
    SELECT l.*, u.full_name
    FROM login_logs l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC
    LIMIT $1;
  `;
  const res = await query(sql, [limit]);
  return res.rows;
}

module.exports = {
  findByUsernameOrEmail,
  findById,
  createUser,
  updateUser,
  listUsers,
  recordLoginLog,
  getLoginLogs
};
