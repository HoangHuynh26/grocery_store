const { query } = require('../../../database');
const { removeVietnameseAccents } = require('../../../utils/text');

const EMBEDDING_DIMENSIONS = 128;
const EMBEDDING_MODEL_NAME = 'grocery-semantic-embed-v1';

// Seeded hash for deterministic feature mapping
function hashString(str, seed = 0) {
  let h = seed ^ 0x12345678;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/**
 * High-Precision Deterministic Semantic Dense Vector Generator (128-D)
 * Tailored for Vietnamese Grocery Products
 */
function generateDenseVector(text, metadata = {}) {
  const vector = new Float32Array(EMBEDDING_DIMENSIONS);
  const raw = (text || '').trim().toLowerCase();
  const clean = removeVietnameseAccents(raw);

  // 1. Word token hashing with TF-IDF-like weighting
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const weight = 1.0 / Math.sqrt(i + 1); // Position discount

    // Map word to 3 distinct dimensions via independent hashes
    for (let k = 0; k < 3; k++) {
      const idx = hashString(word, k * 31) % EMBEDDING_DIMENSIONS;
      const sign = (hashString(word, k * 37 + 1) % 2 === 0) ? 1 : -1;
      vector[idx] += sign * weight * 1.5;
    }
  }

  // 2. Character 3-grams for subword / typo robustness (e.g. "choc", "hoco", "pie")
  if (clean.length >= 3) {
    for (let i = 0; i <= clean.length - 3; i++) {
      const trigram = clean.substring(i, i + 3);
      const idx = hashString(trigram, 97) % EMBEDDING_DIMENSIONS;
      const sign = (hashString(trigram, 101) % 2 === 0) ? 1 : -1;
      vector[idx] += sign * 0.4;
    }
  }

  // 3. Category Semantic Feature Embedding (dims 0 - 20 dedicated to category clusters)
  const categoryName = removeVietnameseAccents((metadata.categoryName || '').toLowerCase());
  const categoryClusters = [
    { patterns: ['nuoc', 'giai khat', 'uong', 'beverage', 'bia', 'sting', 'coca'], dim: 0 },
    { patterns: ['mi', 'bun', 'kho', 'noodle', 'chao', 'pho'], dim: 2 },
    { patterns: ['banh', 'keo', 'snack', 'bim bim', 'orion', 'chocopie'], dim: 4 },
    { patterns: ['sua', 'milk', 'dairy', 'yaourt', 'chua'], dim: 6 },
    { patterns: ['gia vi', 'dau an', 'sauce', 'spice', 'mam', 'muoi'], dim: 8 },
    { patterns: ['pha che', 'tuoi', 'ca phe', 'tra sua'], dim: 10 },
    { patterns: ['ve sinh', 'hoa pham', 'tay rua', 'household'], dim: 12 }
  ];

  categoryClusters.forEach(({ patterns, dim }) => {
    const matches = patterns.some(p => clean.includes(p) || categoryName.includes(p));
    if (matches) {
      vector[dim] += 2.0;
      vector[dim + 1] += 1.5;
    }
  });

  // 4. Unit Feature Embedding
  const unit = removeVietnameseAccents((metadata.unit || '').toLowerCase());
  const unitMap = { 'lon': 15, 'chai': 16, 'goi': 17, 'hop': 18, 'loc': 19, 'cai': 20, 'kg': 21 };
  if (unitMap[unit] !== undefined) {
    vector[unitMap[unit]] += 1.2;
  }

  // 5. Price tier normalization feature
  const price = parseFloat(metadata.sellingPrice || 0);
  if (price > 0) {
    const logPrice = Math.log10(price); // ~ 4.0 for 10.000đ, 5.0 for 100.000đ
    vector[25] += (logPrice - 4.0) * 0.8;
  }

  // 6. L2 Normalization (unit vector so cosine similarity is simple dot product)
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      vector[i] = Math.round((vector[i] / norm) * 100000) / 100000;
    }
  }

  return Array.from(vector);
}

/**
 * Calculates Cosine Similarity between two L2-normalized float vectors
 * Range: [-1.0, 1.0] (1.0 = identical, 0.0 = orthogonal)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Math.max(-1, Math.min(1, dot));
}

class EmbeddingService {
  /**
   * Generates embedding payload for a single product record
   */
  static buildEmbeddingPayload(product) {
    const textToEmbed = [
      product.name || '',
      product.product_code || '',
      product.category_name || '',
      product.description || '',
      product.unit ? `Đơn vị: ${product.unit}` : ''
    ].filter(Boolean).join(' | ');

    const vector = generateDenseVector(textToEmbed, {
      categoryName: product.category_name || '',
      unit: product.unit || '',
      sellingPrice: product.selling_price || 0
    });

    return {
      vector,
      dimensions: EMBEDDING_DIMENSIONS,
      model: EMBEDDING_MODEL_NAME,
      text_hash: removeVietnameseAccents(textToEmbed.toLowerCase().substring(0, 120)),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Trigger 1: Update embedding for a specific product by ID
   * Called automatically whenever a new product is added or modified
   */
  static async updateProductEmbedding(productId) {
    if (!productId) return null;

    const sql = `
      SELECT p.id, p.product_code, p.name, p.description, p.unit, p.selling_price, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1;
    `;
    const res = await query(sql, [productId]);
    if (res.rows.length === 0) return null;

    const product = res.rows[0];
    const payload = this.buildEmbeddingPayload(product);

    await query(`
      UPDATE products 
      SET embedding = $1, embedding_updated_at = NOW()
      WHERE id = $2;
    `, [JSON.stringify(payload), productId]);

    console.log(`[Embedding] Generated embedding for product "${product.name}" (${product.product_code})`);
    return payload;
  }

  /**
   * Trigger 2: Update embeddings for all active products
   * Called at 12:00 AM (midnight) daily or via manual sync
   */
  static async updateAllProductEmbeddings({ force = false } = {}) {
    const startTime = Date.now();
    const condition = force ? 'WHERE p.is_active = TRUE' : 'WHERE p.is_active = TRUE AND (p.embedding IS NULL OR p.embedding_updated_at IS NULL)';
    
    const sql = `
      SELECT p.id, p.product_code, p.name, p.description, p.unit, p.selling_price, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${condition}
      ORDER BY p.name ASC;
    `;
    const res = await query(sql);
    const products = res.rows;
    let updatedCount = 0;
    let failedCount = 0;

    for (const prod of products) {
      try {
        const payload = this.buildEmbeddingPayload(prod);
        await query(`
          UPDATE products 
          SET embedding = $1, embedding_updated_at = NOW()
          WHERE id = $2;
        `, [JSON.stringify(payload), prod.id]);
        updatedCount++;
      } catch (err) {
        console.error(`[Embedding] Failed to update embedding for product ${prod.id}:`, err.message);
        failedCount++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Embedding] Batch update complete: ${updatedCount} updated, ${failedCount} failed in ${durationMs}ms`);

    return {
      success: true,
      totalFound: products.length,
      updatedCount,
      failedCount,
      durationMs,
      model: EMBEDDING_MODEL_NAME,
      completedAt: new Date().toISOString()
    };
  }

  /**
   * Semantic Vector Search for Products
   * Computes cosine similarity between user query vector and all product embeddings
   */
  static async searchSimilarProducts(queryText, limit = 5) {
    const raw = (queryText || '').trim();
    if (!raw) return [];

    const queryVector = generateDenseVector(raw);
    const sql = `
      SELECT p.id, p.product_code, p.name, p.selling_price, p.stock_quantity, p.unit, 
             p.embedding, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE AND p.embedding IS NOT NULL;
    `;
    const res = await query(sql);

    const scored = [];
    for (const row of res.rows) {
      const emb = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
      if (emb && emb.vector) {
        const sim = cosineSimilarity(queryVector, emb.vector);
        scored.push({
          id: row.id,
          productCode: row.product_code,
          name: row.name,
          categoryName: row.category_name,
          sellingPrice: parseFloat(row.selling_price),
          stockQuantity: row.stock_quantity,
          unit: row.unit,
          similarity: Math.round(sim * 1000) / 1000
        });
      }
    }

    // Rank descending by similarity
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  /**
   * Returns current statistics of the embedding database
   */
  static async getEmbeddingStats() {
    const res = await query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(embedding) as embedded_products,
        MAX(embedding_updated_at) as last_updated
      FROM products
      WHERE is_active = TRUE;
    `);
    const row = res.rows[0];
    const total = parseInt(row.total_products || 0, 10);
    const embedded = parseInt(row.embedded_products || 0, 10);

    return {
      totalProducts: total,
      embeddedProducts: embedded,
      pendingProducts: Math.max(0, total - embedded),
      lastUpdated: row.last_updated,
      model: EMBEDDING_MODEL_NAME,
      dimensions: EMBEDDING_DIMENSIONS
    };
  }
}

module.exports = {
  EmbeddingService,
  generateDenseVector,
  cosineSimilarity,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_NAME
};
