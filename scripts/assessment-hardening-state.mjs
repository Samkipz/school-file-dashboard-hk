import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { developmentPool, safeFailure } from './db-common.mjs'

// Read-only fingerprints avoid copying learner/auth/media content into evidence.
const pool = developmentPool(), client = await pool.connect()
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'))
  const ledger = (await client.query('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows
  ledger.forEach((row,i) => {
    assert.equal(row.hash,createHash('sha256').update(readFileSync(`drizzle/${journal.entries[i].tag}.sql`)).digest('hex'))
    assert.equal(String(row.created_at),String(journal.entries[i].when))
  })
  const tables = (await client.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','neon_auth') ORDER BY schemaname,tablename")).rows
  const state = {}
  for (const {schemaname,tablename} of tables) {
    const quote = s => '"'+s.replaceAll('"','""')+'"'
    state[`${schemaname}.${tablename}`] = (await client.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM ${quote(schemaname)}.${quote(tablename)} t`)).rows[0]
  }
  const invalid = {}
  for (const [table,field] of [['assessments','title'],['assessment_tasks','title'],['assessment_types','name']]) {
    // The application contract itself is the preflight oracle.
    invalid[table] = (await client.query(`SELECT ${field} AS value FROM ${table}`)).rows.filter(r => !r.value.trim()).length
    assert.equal(invalid[table],0,`Existing whitespace-only ${table} rows require owner review; do not rewrite data`)
  }
  const tasks = (await client.query('SELECT id,school_id,assessment_id,ordinal,created_at,created_by_actor_id,row_version FROM assessment_tasks ORDER BY assessment_id,ordinal')).rows
  const compareIndex = process.argv.indexOf('--compare')
  if (compareIndex !== -1) {
    const bytes=readFileSync(process.argv[compareIndex+1])
    const before=JSON.parse(bytes.toString(bytes[0]===0xff && bytes[1]===0xfe ? 'utf16le' : 'utf8').replace(/^\uFEFF/,''))
    assert.deepEqual(state,before.state,'All public/provider row counts and fingerprints must survive the migration')
    assert.deepEqual(JSON.parse(JSON.stringify(tasks)),before.tasks,'Existing task IDs and provenance must survive the migration')
    assert.deepEqual(ledger.slice(0,before.ledger.length),before.ledger,'Applied migration history must be preserved')
  }
  console.log(JSON.stringify({date:new Date().toISOString(),ledger,state,invalid,tasks},null,2))
  await client.query('ROLLBACK')
} catch(error) { await client.query('ROLLBACK'); safeFailure(error) }
finally { client.release(); await pool.end() }
