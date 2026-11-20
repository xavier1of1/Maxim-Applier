import pg, { type PoolClient } from 'pg';
import { config } from './config';
let pool: pg.Pool | undefined;
export function database() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config().databaseUrl, max: 8, connectionTimeoutMillis: 3000, statement_timeout: 10000, query_timeout: 10000 });
    pool.on('error', () => console.warn('Workspace database connection interrupted.'));
  }
  return pool;
}
export async function closeDatabase() {
  const closing=pool;
  pool=undefined;
  await closing?.end();
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
