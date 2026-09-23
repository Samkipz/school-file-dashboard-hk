import type { PoolClient } from 'pg'
import { randomUUID } from 'node:crypto'
import { DomainError, type Context } from './foundation.ts'
import { scoreText, scoreUnits, type Criterion, type PerformanceLevel } from './scoring-guide.ts'

export async function loadCriteria(db: PoolClient, school: string, task: string): Promise<Criterion[]> {
  const criteria = (await db.query('SELECT id,title,description FROM assessment_criteria WHERE school_id=$1 AND task_id=$2 ORDER BY ordinal', [school, task])).rows
  for (const criterion of criteria) criterion.indicators = (await db.query('SELECT id,descriptor,score_units FROM assessment_indicators WHERE school_id=$1 AND criterion_id=$2 ORDER BY ordinal', [school, criterion.id])).rows.map(i => ({ id: i.id, descriptor: i.descriptor, score: scoreText(i.score_units) }))
  return criteria
}
export async function loadLevels(db: PoolClient, school: string, assessment: string): Promise<PerformanceLevel[]> {
  return (await db.query('SELECT id,code,descriptor,lower_units,upper_units FROM assessment_levels WHERE school_id=$1 AND assessment_id=$2 ORDER BY ordinal', [school, assessment])).rows.map(l => ({ id: l.id, code: l.code, descriptor: l.descriptor, lower: scoreText(l.lower_units), upper: scoreText(l.upper_units) }))
}
// Table/column identifiers below are private constants, never caller input.
async function reconcile(db: PoolClient, ctx: Context, table: string, parentColumn: string, parent: string, rows: { id?: string }[], columns: string[], values: (row: { id?: string }, index: number) => unknown[], remove?: (id: string) => Promise<void>) {
  const old = (await db.query(`SELECT id FROM ${table} WHERE school_id=$1 AND ${parentColumn}=$2`, [ctx.school_id, parent])).rows.map(r => r.id as string)
  for (const row of rows) if (row.id && !old.includes(row.id)) throw new DomainError('INVALID_INPUT')
  for (const id of old.filter(id => !rows.some(row => row.id === id))) {
    if (remove) await remove(id)
    await db.query(`DELETE FROM ${table} WHERE school_id=$1 AND id=$2`, [ctx.school_id, id])
  }
  const ids: string[] = []
  for (const [index, row] of rows.entries()) {
    const id = row.id ?? randomUUID(), fields = values(row, index)
    if (row.id) await db.query(`UPDATE ${table} SET ${columns.map((column, i) => `${column}=$${i + 4}`).join(',')},updated_by_actor_id=$3 WHERE school_id=$1 AND id=$2`, [ctx.school_id, id, ctx.actor_id, ...fields])
    else await db.query(`INSERT INTO ${table} (school_id,id,created_by_actor_id,updated_by_actor_id,${parentColumn},${columns.join(',')}) VALUES ($1,$2,$3,$3,$4,${columns.map((_, i) => `$${i + 5}`).join(',')})`, [ctx.school_id, id, ctx.actor_id, parent, ...fields])
    ids.push(id)
  }
  return ids
}
export async function deleteCriteria(db: PoolClient, school: string, task: string) {
  await db.query('DELETE FROM assessment_indicators WHERE school_id=$1 AND criterion_id IN (SELECT id FROM assessment_criteria WHERE school_id=$1 AND task_id=$2)', [school, task])
  await db.query('DELETE FROM assessment_criteria WHERE school_id=$1 AND task_id=$2', [school, task])
}
export async function saveCriteria(db: PoolClient, ctx: Context, task: string, criteria: Criterion[]) {
  const ids = await reconcile(db, ctx, 'assessment_criteria', 'task_id', task, criteria, ['ordinal','title','description'], (_, i) => [i + 1, criteria[i].title, criteria[i].description], async id => {
    await db.query('DELETE FROM assessment_indicators WHERE school_id=$1 AND criterion_id=$2', [ctx.school_id, id])
  })
  for (const [index, criterion] of criteria.entries()) await reconcile(db, ctx, 'assessment_indicators', 'criterion_id', ids[index], criterion.indicators, ['ordinal','descriptor','score_units'], (_, i) => [i + 1, criterion.indicators[i].descriptor, scoreUnits(criterion.indicators[i].score)])
}
export async function saveLevels(db: PoolClient, ctx: Context, assessment: string, levels: PerformanceLevel[]) {
  await reconcile(db, ctx, 'assessment_levels', 'assessment_id', assessment, levels, ['ordinal','code','descriptor','lower_units','upper_units'], (_, i) => [i + 1, levels[i].code, levels[i].descriptor, scoreUnits(levels[i].lower), scoreUnits(levels[i].upper)])
}
