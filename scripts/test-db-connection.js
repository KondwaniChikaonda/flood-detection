// Simple script to test DB connection using the same settings
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'flood',
  user: 'postgres',
  password: 'konchi22',
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
});

(async () => {
  try {
    const client = await pool.connect();
    console.log('[db-test] Connected to Postgres ✅');
    client.release();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('[db-test] Connection error:', err.message || err);
    process.exit(1);
  }
})();
