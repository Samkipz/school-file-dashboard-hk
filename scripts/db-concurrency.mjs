import assert from 'node:assert/strict'
import { developmentPool, safeFailure } from './db-common.mjs'
import { fixtureId as id, devSchoolId as school } from './dev-fixtures.mjs'
const pool = developmentPool()
const year = id('concurrency-year')
const actor = id('bootstrap')
const a = await pool.connect(), b = await pool.connect()
try {
  await a.query(`INSERT INTO academic_years (id,school_id,code,starts_on,ends_on,created_by_actor_id,updated_by_actor_id)
    VALUES ($1,$2,'CONCURRENCY-TEST','2027-01-01','2027-12-31',$3,$3)`,[year,school,actor])
  await a.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
  await b.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
  await b.query("SET LOCAL statement_timeout = '15s'")
  const sql = `INSERT INTO terms (id,school_id,academic_year_id,code,ordinal,starts_on,ends_on,created_by_actor_id,updated_by_actor_id)
    VALUES ($1,$2,$3,$4,$5,'2027-01-01','2027-04-30',$6,$6)`
  await a.query(sql,[id('concurrent-term-a'),school,year,'A',1,actor])
  const pending = b.query(sql,[id('concurrent-term-b'),school,year,'B',2,actor]).then(async()=> {
    await b.query('COMMIT')
    return null
  }).catch(error=>error.code)
  await a.query('COMMIT')
  const error = await pending
  assert.ok(['40001','23514'].includes(error),`Expected serialization/integrity rejection, received ${error}`)
  await b.query('ROLLBACK')
  const count = await a.query('SELECT count(*) AS n FROM terms WHERE academic_year_id=$1',[year])
  assert.equal(count.rows[0].n,'1')
  console.log('Concurrency PASS: overlapping term transactions cannot both commit')
} catch (error) { await a.query('ROLLBACK'); await b.query('ROLLBACK'); safeFailure(error) }
finally {
  await a.query('DELETE FROM terms WHERE academic_year_id=$1',[year])
  await a.query('DELETE FROM academic_years WHERE id=$1',[year])
  a.release(); b.release(); await pool.end()
}
