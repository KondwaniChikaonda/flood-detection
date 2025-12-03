import { Pool } from 'pg';

const {
  DATABASE_URL,
  PGHOST,
  PGPORT,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  NODE_ENV,
} = process.env;

let pool: Pool;

// Prefer DATABASE_URL, otherwise use individual PG_* env vars
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 });
} else if (PGHOST) {
  pool = new Pool({
    host: PGHOST,
    port: PGPORT ? Number(PGPORT) : undefined,
    database: PGDATABASE,
    user: PGUSER,
    password: PGPASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  // No DB config provided — create a pool that will error on connect with a clear message
  pool = new Pool({ host: 'localhost', port: 5432, database: 'postgres', max: 1 });
}

let isConnected = false;

export async function connect() {
  if (!DATABASE_URL && !PGHOST) {
    const hint = 'No database configuration found. Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE in environment.';
    console.error('[db] ' + hint);
    return { ok: false, error: hint };
  }

  try {
    const client = await pool.connect();
    client.release();
    if (!isConnected) {
      console.log('[db] Connected to Postgres ✅');
      isConnected = true;
    }
    return { ok: true };
  } catch (err) {
    console.error('[db] Connection error:', err);
    isConnected = false;
    return { ok: false, error: (err as Error).message };
  }
}

export default pool;
