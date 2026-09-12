import { developmentPool, safeFailure } from './db-common.mjs'
const pool = developmentPool()
try {
  console.log((await pool.query("select current_database() as database, table_schema, table_name from information_schema.tables where table_schema in ('public','drizzle') order by 2,3")).rows)
} catch (error) { safeFailure(error) } finally { await pool.end() }
