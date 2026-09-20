const { query } = require('../database');

async function listCategories(onlyActive = true) {
  const whereSql = onlyActive ? 'WHERE c.is_active = TRUE' : '';
  const sql = `
    SELECT 
      c.*,
      COUNT(p.id) FILTER (WHERE p.is_active = TRUE) as active_products_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    ${whereSql}
    GROUP BY c.id
    ORDER BY c.name ASC;
  `;
  const res = await query(sql);
  return res.rows;
}

async function findById(id) {
  const sql = `SELECT * FROM categories WHERE id = $1;`;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

async function findByNameOrSlug(name, slug) {
  const sql = `SELECT * FROM categories WHERE LOWER(name) = LOWER($1) OR LOWER(slug) = LOWER($2);`;
  const res = await query(sql, [name, slug]);
  return res.rows[0] || null;
}

async function createCategory({ name, slug, description }) {
  const sql = `
    INSERT INTO categories (name, slug, description, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, TRUE, NOW(), NOW())
    RETURNING *;
  `;
  const res = await query(sql, [name, slug, description]);
  return res.rows[0];
}

async function updateCategory(id, { name, slug, description, isActive }) {
  const updates = [];
  const params = [id];
  let idx = 2;

  if (name !== undefined) {
    updates.push(`name = $${idx++}`);
    params.push(name);
  }
  if (slug !== undefined) {
    updates.push(`slug = $${idx++}`);
    params.push(slug);
  }
  if (description !== undefined) {
    updates.push(`description = $${idx++}`);
    params.push(description);
  }
  if (isActive !== undefined) {
    updates.push(`is_active = $${idx++}`);
    params.push(isActive);
  }
  updates.push(`updated_at = NOW()`);

  const sql = `
    UPDATE categories
    SET ${updates.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;
  const res = await query(sql, params);
  return res.rows[0] || null;
}

async function countProductsInCategory(categoryId) {
  const sql = `SELECT COUNT(*) as total FROM products WHERE category_id = $1 AND is_active = TRUE;`;
  const res = await query(sql, [categoryId]);
  return parseInt(res.rows[0]?.total || '0', 10);
}

module.exports = {
  listCategories,
  findById,
  findByNameOrSlug,
  createCategory,
  updateCategory,
  countProductsInCategory
};
