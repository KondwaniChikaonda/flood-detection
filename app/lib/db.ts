import { Pool } from 'pg';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: process.env.DB_MAX,
  idleTimeoutMillis: process.env.DB_IDLE,
  connectionTimeoutMillis: process.env.DB_TIMEOUT,
});


let isConnected = false;

export async function connect() {
  try {
    
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
