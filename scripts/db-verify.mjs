import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { developmentPool, foundationTables, authTables, mediaTables, safeFailure } from './db-common.mjs'
const pool = developmentPool()
try {
  const actual = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows.map(r => r.tablename)
  assert.deepEqual(actual, [...foundationTables,...authTables,...mediaTables].sort())
  const snapshot = JSON.parse(readFileSync('drizzle/meta/0002_snapshot.json','utf8'))
  let columns = 0, foreignKeys = 0
  for (const table of Object.values(snapshot.tables)) {
    const rows = (await pool.query(`SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table.name])).rows
    assert.equal(rows.length,Object.keys(table.columns).length,`${table.name} column count`)
    for (const column of Object.values(table.columns)) {
      const row = rows.find(r => r.column_name === column.name)
      assert.ok(row,`${table.name}.${column.name}`)
      assert.equal(row.is_nullable,column.notNull ? 'NO' : 'YES')
      const type = column.type.startsWith('varchar') ? 'character varying' : column.type === 'timestamp' ? 'timestamp without time zone' : column.type
      assert.equal(row.data_type, type, `${table.name}.${column.name} type`)
      columns++
    }
    const constraints = (await pool.query(`SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass`, [`public."${table.name}"`])).rows.map(r => r.conname)
    for (const fk of Object.values(table.foreignKeys)) { assert.ok(constraints.includes(fk.name.slice(0,63)),fk.name); foreignKeys++ }
    for (const u of Object.values(table.uniqueConstraints)) assert.ok(constraints.includes(u.name.slice(0,63)),u.name)
    for (const c of Object.values(table.checkConstraints)) assert.ok(constraints.includes(c.name.slice(0,63)),c.name)
  }
  const invalid = await pool.query("SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND NOT convalidated")
  assert.equal(invalid.rowCount,0)
  const unindexed = await pool.query(`SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.contype='f' AND n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indpred IS NULL AND i.indisvalid AND ARRAY(SELECT unnest(i.indkey) LIMIT cardinality(c.conkey)) = c.conkey)`)
  assert.equal(unindexed.rowCount,0,`Unindexed foreign keys: ${JSON.stringify(unindexed.rows)}`)
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'))
  const history = (await pool.query('SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows
  assert.equal(history.length,journal.entries.length)
  journal.entries.forEach((e,i) => assert.equal(history[i].hash,createHash('sha256').update(readFileSync(`drizzle/${e.tag}.sql`)).digest('hex')))
  const counts = {}
  for (const table of foundationTables) counts[table] = Number((await pool.query(`SELECT count(*) AS n FROM "${table}"`)).rows[0].n)
  const provider = (await pool.query("SELECT count(*) AS n FROM pg_tables WHERE schemaname='neon_auth'")).rows[0].n
  console.log({ result: 'PASS', publicTables: actual.length, columns, foreignKeys, unvalidatedConstraints: 0, unindexedForeignKeys: 0, migrations: history.length, providerTablesUntouched: provider, counts })
} catch (error) { safeFailure(error) } finally { await pool.end() }

