import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { developmentPool,safeFailure } from './db-common.mjs'
const json=path=>{const b=readFileSync(path);return JSON.parse(b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,''))}
const pool=developmentPool();let c
try{
  c=await pool.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  const journal=json('drizzle/meta/_journal.json'),ledger=(await c.query('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows
  assert.equal(ledger.length,journal.entries.length)
  for(const [i,e] of journal.entries.entries()){assert.equal(ledger[i].hash,createHash('sha256').update(readFileSync(`drizzle/${e.tag}.sql`)).digest('hex'));assert.equal(String(ledger[i].created_at),String(e.when))}
  for(const entry of json('.github/verification/learner-assessments/historical-hashes.json'))assert.equal(createHash('sha256').update(readFileSync('drizzle/'+entry.file)).digest('hex').toUpperCase(),entry.Hash)
  const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows,state={}
  for(const {tablename} of tables)state[`public.${tablename}`]=(await c.query(`SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM "${tablename}" t`)).rows[0]
  const before=json('.github/verification/learner-assessments/db-before.json')
  const preserved=process.argv.includes('--after-migration')?Object.keys(before.state).filter(t=>t.startsWith('public.')):['public.learners','public.media_assets','public.media_folders']
  for(const t of preserved)assert.deepEqual(state[t],before.state[t],`${t} original rows preserved`)
  const counts=(await c.query("SELECT (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public') columns,(SELECT count(*)::int FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace) foreign_keys,(SELECT count(*)::int FROM pg_constraint WHERE NOT convalidated AND connamespace='public'::regnamespace) unvalidated")).rows[0]
  const unindexed=(await c.query(`SELECT c.conname FROM pg_constraint c WHERE c.contype='f' AND c.connamespace='public'::regnamespace AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indpred IS NULL AND i.indisvalid AND ARRAY(SELECT unnest(i.indkey) LIMIT cardinality(c.conkey))=c.conkey)`)).rows
  assert.equal(unindexed.length,0);assert.equal(counts.unvalidated,0)
  const results=(await c.query(`SELECT a.id,a.title,l.status,count(*)::int count FROM learner_assessments l JOIN assessments a ON a.school_id=l.school_id AND a.id=l.assessment_id GROUP BY a.id,a.title,l.status ORDER BY a.id,l.status`)).rows
  console.log(JSON.stringify({date:new Date().toISOString(),public_tables:tables.length,...counts,unindexed_foreign_keys:unindexed.length,migration_count:ledger.length,ledger,historical_files_unchanged:true,preserved,state,results,storage:'No object-storage API invoked by this report; database evidence only.'},null,2))
  await c.query('ROLLBACK')
}catch(e){if(c)await c.query('ROLLBACK');safeFailure(e)}finally{c?.release();await pool.end()}
