import { Pool, PoolConfig } from 'pg';

/**
 * Get PostgreSQL connection pool configuration
 * This function is called lazily to ensure environment variables are loaded
 */
function getPoolConfig(): PoolConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'tracker_v2',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'tracker_password',
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  };
}

/**
 * Global connection pool instance (lazy-loaded)
 */
let poolInstance: Pool | null = null;

/**
 * Get or create the connection pool
 * This ensures the pool is only created after environment variables are loaded
 */
export function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool(getPoolConfig());

    // Set up event handlers
    poolInstance.on('connect', () => {
      console.log('Database client connected');
    });

    poolInstance.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }
  return poolInstance;
}

/**
 * Export pool for backward compatibility
 * Note: This getter ensures lazy initialization
 */
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return getPool()[prop as keyof Pool];
  }
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database');

    // Test query
    const result = await client.query('SELECT NOW()');
    console.log('Database time:', result.rows[0].now);

    client.release();
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  }
}

/**
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  try {
    if (poolInstance) {
      await poolInstance.end();
      poolInstance = null;
      console.log('Database pool has been closed');
    }
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

/**
 * Execute a query with the pool
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Override the release method to clear timeout
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release();
  };

  return client;
}
