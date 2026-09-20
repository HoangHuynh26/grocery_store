const fs = require('fs');
const path = require('path');
const config = require('../config/env');

let pool = null;
let pgliteInstance = null;
let isEmbedded = false;

async function getDb() {
  if (pool) return { type: 'pg', client: pool };
  if (pgliteInstance) return { type: 'pglite', client: pgliteInstance };

  if (config.databaseUrl && (config.databaseUrl.startsWith('postgres://') || config.databaseUrl.startsWith('postgresql://'))) {
    const { Pool } = require('pg');

    // Neon PostgreSQL and Cloud PostgreSQL require SSL encryption
    const isNeon = config.databaseUrl.includes('neon.tech') || 
                   config.databaseUrl.includes('sslmode=require') || 
                   config.databaseUrl.includes('ssl=true');
    const sslConfig = (isNeon || process.env.NODE_ENV === 'production') 
      ? { rejectUnauthorized: false } 
      : false;

    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: sslConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    
    // Test pool error listener
    pool.on('error', (err) => {
      console.error('[Database Pool Error]:', err.message);
    });

    isEmbedded = false;
    const isNeonLabel = isNeon ? ' (Neon Serverless PostgreSQL)' : '';
    console.log(`[Database] Connected to external PostgreSQL${isNeonLabel}`);
    return { type: 'pg', client: pool };
  } else {
    const { PGlite } = require('@electric-sql/pglite');
    const dataDir = path.resolve(process.cwd(), config.databaseDataDir);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
    isEmbedded = true;
    console.log(`[Database] DATABASE_URL not set. Running local database at ${dataDir}`);
    return { type: 'pglite', client: pgliteInstance };
  }
}

async function query(text, params = []) {
  const db = await getDb();
  if (db.type === 'pg') {
    const res = await db.client.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount };
  } else {
    const res = await db.client.query(text, params);
    return { rows: res.rows || [], rowCount: (res.rows || []).length };
  }
}

// Transaction client helper
// In standard PostgreSQL: pool.connect() -> client -> client.query -> client.release()
// In PGlite: transactions are sequential on the instance or use BEGIN/COMMIT
async function getClient() {
  const db = await getDb();
  if (db.type === 'pg') {
    const client = await db.client.connect();
    return {
      query: (text, params) => client.query(text, params),
      release: () => client.release()
    };
  } else {
    // For PGlite: sequential query executor with locking emulation
    return {
      query: async (text, params) => {
        const res = await db.client.query(text, params);
        return { rows: res.rows || [], rowCount: (res.rows || []).length };
      },
      release: () => {
        // No-op for in-process single instance
      }
    };
  }
}

async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Split and execute statements
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const db = await getDb();
  console.log(`[Database] Running schema migrations (${statements.length} statements)...`);

  for (const statement of statements) {
    try {
      await query(statement);
    } catch (err) {
      // Ignore "already exists" errors during migration
      if (!err.message.includes('already exists')) {
        console.error('[Database Migration Warning]:', err.message);
      }
    }
  }

  console.log('[Database] Schema migrations completed successfully.');
}

module.exports = {
  getDb,
  query,
  getClient,
  initDb,
  isEmbedded: () => isEmbedded
};
