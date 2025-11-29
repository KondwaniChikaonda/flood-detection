import { Pool } from 'pg';

// Database configuration - match user's provided credentials
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'flood',
  user: 'postgres',
  password: 'konchi22',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

let isConnected = false;

export async function connect() {
  try {
    // Try to get a client and release it immediately to validate connection
    const client = await pool.connect();
    client.release();
    if (!isConnected) {
      console.log('[db] Connected to Postgres ✅');
      isConnected = true;
    } else {
      console.log('[db] Connection check OK');
    }
    return { ok: true };
  } catch (err) {
    console.error('[db] Connection error:', err);
    isConnected = false;
    return { ok: false, error: (err as Error).message };
  }
}

export default pool;
