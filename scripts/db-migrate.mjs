import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { developmentPool, foundationTables, authTables, legacyTables, safeFailure } from './db-common.mjs'

// All migrations and the optional explicit-table reset commit as one transaction.
// Neither public nor neon_auth is dropped; cross-schema dependencies cause failure.
export async function migrate(client, reset = false) {
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'))
  await client.query('BEGIN')
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('schoolhub-foundation-migrations'))")
    if (reset) {
      if (process.argv[3] !== 'schoolhub-fresh-dev') throw new Error('Reset requires: --reset schoolhub-fresh-dev')
      const owned = [...foundationTables, ...authTables, ...legacyTables]
      const existing = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map(r => r.tablename)
      if (existing.some(t => !owned.includes(t))) throw new Error('Unexpected public tables; reset refused')
      const selected = owned.filter(t => existing.includes(t)).map(t => `"public"."${t}"`)
      if (selected.length) await client.query(`DROP TABLE ${selected.join(', ')} RESTRICT`)
      for (const name of ['foundation_mutable_guard','foundation_immutable_guard','foundation_validate','foundation_audit_guard']) {
        await client.query(`DROP FUNCTION IF EXISTS public.${name}() RESTRICT`)
      }
      await client.query('DROP TABLE IF EXISTS drizzle.__drizzle_migrations RESTRICT')
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle')
    await client.query('CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)')
    const applied = (await client.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows
    for (let i = 0; i < journal.entries.length; i++) {
      const entry = journal.entries[i]
      const source = readFileSync(`drizzle/${entry.tag}.sql`, 'utf8')
      const hash = createHash('sha256').update(source).digest('hex')
      if (applied[i]) {
        if (applied[i].hash !== hash || String(applied[i].created_at) !== String(entry.when)) throw new Error('Migration history mismatch; use an explicit development reset')
        continue
      }
      await client.query(source)
      await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1,$2)', [hash, entry.when])
    }
    if (applied.length > journal.entries.length) throw new Error('Unexpected migration history')
    await client.query('COMMIT')
    console.log('Migration PASS: authoritative foundation history applied')
  } catch (error) { await client.query('ROLLBACK'); throw error }
}
const pool = developmentPool()
try { const client = await pool.connect(); try { await migrate(client, process.argv[2] === '--reset') } finally { client.release() } }
catch (error) { safeFailure(error) } finally { await pool.end() }
