import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { foundationService, loadOfferingRoster, DomainError, uuidInput, type Context } from './foundation.ts'
import { DefinitionError } from './scoring-guide.ts'
import { loadLevels } from './scoring-persistence.ts'
import type { AssessmentDraft } from './assessments.ts'
import { calculateResult, requireComplete, requireTransition, resultInput, nextLearner, type Observation, type EvidenceInput, type ResultStatus } from './learner-result.ts'

type Participation = { id: string; learner_id: string; row_version: string; status: ResultStatus; feedback: string | null; completed_at: string | null; completed_by_actor_id: string | null; absent_at: string | null }
type Evidence = EvidenceInput & { id: string; title: string; available: boolean }
export function learnerAssessmentService(pool: Pool, identify: () => Promise<string | null>) {
  const access = foundationService(pool, identify)
  async function definition(db: PoolClient, ctx: Context, assessment: string) {
    const a = (await db.query<AssessmentDraft & { term_code: string | null }>('SELECT a.*,t.code AS term_code FROM assessments a LEFT JOIN terms t ON t.school_id=a.school_id AND t.id=a.term_id WHERE a.school_id=$1 AND a.id=$2 AND a.archived_at IS NULL', [ctx.school_id, uuidInput(assessment)])).rows[0]
    if (!a) throw new DomainError('NOT_FOUND')
    await access.authorizeOffering(db, ctx, a.offering_id, 'assigned')
    if (a.status !== 'open') throw new DomainError('CONFLICT')
    a.tasks = (await db.query(`SELECT t.id,t.ordinal,t.title,t.instructions,t.starts_on,t.due_on,coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'indicators',
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'descriptor',i.descriptor,'score',(i.score_units/100)::text || '.' || lpad((i.score_units%100)::text,2,'0')) ORDER BY i.ordinal) FROM assessment_indicators i WHERE i.school_id=c.school_id AND i.criterion_id=c.id),'[]'::jsonb)) ORDER BY c.ordinal)
      FROM assessment_criteria c WHERE c.school_id=t.school_id AND c.task_id=t.id),'[]'::jsonb) AS criteria
      FROM assessment_tasks t WHERE t.school_id=$1 AND t.assessment_id=$2 ORDER BY t.ordinal`, [ctx.school_id, assessment])).rows
    a.levels = await loadLevels(db, ctx.school_id, assessment)
    return a
  }
  async function participants(db: PoolClient, school: string, assessment: string) {
    return (await db.query<Participation>(`SELECT id,learner_id,row_version::text,status,feedback,completed_at::text,completed_by_actor_id,absent_at::text FROM learner_assessments WHERE school_id=$1 AND assessment_id=$2`, [school, assessment])).rows
  }
  async function observations(db: PoolClient, school: string, assessment: string) {
    return (await db.query<Observation & { learner_assessment_id: string }>(`SELECT o.learner_assessment_id,o.criterion_id,o.indicator_id FROM criterion_observations o JOIN learner_assessments a ON a.school_id=o.school_id AND a.id=o.learner_assessment_id WHERE a.school_id=$1 AND a.assessment_id=$2 ORDER BY o.criterion_id`, [school, assessment])).rows
  }
  async function evidence(db: PoolClient, school: string, parent: string) {
    return (await db.query<Evidence>(`SELECT e.id,e.asset_id,e.task_id,e.criterion_id,f.title,(f.state='ready' AND f.archived_at IS NULL) AS available FROM assessment_evidence e JOIN media_assets f ON f.school_id=e.school_id AND f.id=e.asset_id WHERE e.school_id=$1 AND e.learner_assessment_id=$2 ORDER BY e.created_at,e.id`, [school, parent])).rows
  }
  async function eligible(db: PoolClient, ctx: Context, a: AssessmentDraft, learner: string) {
    uuidInput(learner)
    const roster = await loadOfferingRoster(db, ctx, a.offering_id)
    if (!roster.some(l => l.id === learner)) throw new DomainError('NOT_FOUND')
    return roster
  }
  return {
    roster(school: string, assessment: string) {
      return access.inSchool(school, async (db, ctx) => {
        const a = await definition(db, ctx, assessment), roster = await loadOfferingRoster(db, ctx, a.offering_id)
        const rows = await participants(db, school, assessment), all = await observations(db, school, assessment)
        const byLearner = new Map(rows.map(r => [r.learner_id, r])), byParent = new Map<string, Observation[]>()
        for (const o of all) { const list = byParent.get(o.learner_assessment_id) ?? []; list.push(o); byParent.set(o.learner_assessment_id, list) }
        return { assessment: a, learners: roster.map(l => {
          const row = byLearner.get(l.id), status: ResultStatus | 'not_started' = row?.status ?? 'not_started'
          return { ...l, status, result: calculateResult(a.tasks, a.levels, row ? byParent.get(row.id) ?? [] : [], status) }
        }) }
      })
    },
    get(school: string, assessment: string, learner: string) {
      return access.inSchool(school, async (db, ctx) => {
        const a = await definition(db, ctx, assessment), roster = await eligible(db, ctx, a, learner)
        const row = (await participants(db, school, assessment)).find(r => r.learner_id === learner) ?? null
        const selected = row ? (await observations(db, school, assessment)).filter(o => o.learner_assessment_id === row.id).map(({ criterion_id, indicator_id }) => ({ criterion_id, indicator_id })) : []
        const links = row ? await evidence(db, school, row.id) : []
        // Current assigned offering + eligible learner implies the existing teacher file read scope.
        const assets = (await db.query<{ id: string; title: string }>("SELECT id,title FROM media_assets WHERE school_id=$1 AND learner_id=$2 AND state='ready' AND archived_at IS NULL ORDER BY uploaded_at DESC,id", [school, learner])).rows
        return { assessment: a, roster, learner: roster.find(l => l.id === learner)!, participation: row, observations: selected, evidence: links, assets,
          result: calculateResult(a.tasks, a.levels, selected, row?.status ?? 'not_started') }
      })
    },
    mutate(school: string, assessment: string, learner: string, command: 'save' | 'complete' | 'absent' | 'begin', expectedVersion: number, value?: unknown) {
      return access.inSchool(school, async (db, ctx) => {
        if (!['save','complete','absent','begin'].includes(command) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new DomainError('INVALID_INPUT')
        const a = await definition(db, ctx, assessment), roster = await eligible(db, ctx, a, learner)
        let row = (await db.query<Participation>('SELECT id,learner_id,status,feedback,row_version::text FROM learner_assessments WHERE school_id=$1 AND assessment_id=$2 AND learner_id=$3 FOR UPDATE', [school, assessment, learner])).rows[0]
        if ((row?.row_version ?? '0') !== String(expectedVersion)) throw new DomainError('CONFLICT')
        const previous = row?.status ?? 'not_started'
        requireTransition(previous, command)
        const input = command === 'save' || command === 'complete' ? resultInput(value) : null
        const calculated = input ? calculateResult(a.tasks, a.levels, input.observations, 'in_progress') : null
        if (command === 'complete') requireComplete(calculated!)
        // Do not discard already recorded academic work when marking absence.
        if (command === 'absent' && row && (row.feedback || (await observations(db, school, assessment)).some(o => o.learner_assessment_id === row.id) || (await evidence(db, school, row.id)).length)) throw new DefinitionError(['This learner has saved work. Review and clear observations, feedback and evidence before marking absent.'])
        if (input) for (const e of input.evidence) {
          const task = e.task_id ? a.tasks.find(t => t.id === e.task_id) : undefined
          const criterionTask = e.criterion_id ? a.tasks.find(t => t.criteria.some(c => c.id === e.criterion_id)) : undefined
          if ((e.task_id && !task) || (e.criterion_id && !criterionTask) || (task && criterionTask && task.id !== criterionTask.id)) throw new DomainError('INVALID_INPUT')
          if (!(await db.query("SELECT id FROM media_assets WHERE school_id=$1 AND id=$2 AND learner_id=$3 AND state='ready' AND archived_at IS NULL FOR SHARE", [school, e.asset_id, learner])).rowCount) throw new DomainError('NOT_FOUND')
        }
        if (!row) row = (await db.query<Participation>(`INSERT INTO learner_assessments(school_id,assessment_id,learner_id,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,$4,$4) RETURNING id,learner_id,status,feedback,row_version::text`, [school, assessment, learner, ctx.actor_id])).rows[0]
        else if (command === 'begin') await db.query("UPDATE learner_assessments SET status='in_progress',absent_at=NULL,absent_by_actor_id=NULL,updated_by_actor_id=$3 WHERE school_id=$1 AND id=$2", [school, row.id, ctx.actor_id])
        else await db.query('UPDATE learner_assessments SET updated_by_actor_id=$3 WHERE school_id=$1 AND id=$2', [school, row.id, ctx.actor_id])
        const priorEvidence = await evidence(db, school, row.id)
        if (input) {
          await db.query('DELETE FROM criterion_observations WHERE school_id=$1 AND learner_assessment_id=$2 AND NOT (criterion_id=ANY($3::uuid[]))', [school,row.id,input.observations.map(o => o.criterion_id)])
          for (const o of input.observations) await db.query(`INSERT INTO criterion_observations(school_id,learner_assessment_id,criterion_id,indicator_id,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,$4,$5,$5)
            ON CONFLICT (school_id,learner_assessment_id,criterion_id) DO UPDATE SET indicator_id=excluded.indicator_id,updated_by_actor_id=excluded.updated_by_actor_id WHERE criterion_observations.indicator_id<>excluded.indicator_id`, [school,row.id,o.criterion_id,o.indicator_id,ctx.actor_id])
          await db.query('DELETE FROM assessment_evidence WHERE school_id=$1 AND learner_assessment_id=$2 AND NOT (asset_id=ANY($3::uuid[]))', [school,row.id,input.evidence.map(e => e.asset_id)])
          for (const e of input.evidence) await db.query(`INSERT INTO assessment_evidence(school_id,learner_assessment_id,asset_id,task_id,criterion_id,created_by_actor_id,updated_by_actor_id) VALUES($1,$2,$3,$4,$5,$6,$6)
            ON CONFLICT (school_id,learner_assessment_id,asset_id) DO UPDATE SET task_id=excluded.task_id,criterion_id=excluded.criterion_id,updated_by_actor_id=excluded.updated_by_actor_id
            WHERE (assessment_evidence.task_id,assessment_evidence.criterion_id) IS DISTINCT FROM (excluded.task_id,excluded.criterion_id)`, [school,row.id,e.asset_id,e.task_id,e.criterion_id,ctx.actor_id])
          await db.query('UPDATE learner_assessments SET feedback=$3,updated_by_actor_id=$4 WHERE school_id=$1 AND id=$2', [school,row.id,input.feedback,ctx.actor_id])
        }
        if (command === 'complete') await db.query("UPDATE learner_assessments SET status='completed',completed_at=now(),completed_by_actor_id=$3,updated_by_actor_id=$3 WHERE school_id=$1 AND id=$2", [school,row.id,ctx.actor_id])
        if (command === 'absent') await db.query("UPDATE learner_assessments SET status='absent',absent_at=now(),absent_by_actor_id=$3,updated_by_actor_id=$3 WHERE school_id=$1 AND id=$2", [school,row.id,ctx.actor_id])
        const saved = (await participants(db, school, assessment)).find(r => r.id === row.id)!
        await db.query(`INSERT INTO audit_events(school_id,actor_id,membership_id,event_type,resource_type,resource_id,command_id,sequence,safe_changes) VALUES($1,$2,$3,$4,'learner_assessments',$5,$6,1,$7::jsonb)`,
          [school,ctx.actor_id,ctx.membership_id,`learner_assessment.${command === 'complete' ? 'completed' : command === 'absent' ? 'absent' : command === 'begin' ? 'begun' : 'saved'}`,row.id,randomUUID(),JSON.stringify({ assessment_id: assessment,learner_id: learner,from_status: previous,to_status: saved.status,row_version: saved.row_version,observed_count: input?.observations.length ?? 0,feedback_present: Boolean(saved.feedback),evidence_added: input?.evidence.filter(e => !priorEvidence.some(p => p.asset_id === e.asset_id)).map(e => e.asset_id) ?? [],evidence_removed: input ? priorEvidence.filter(p => !input.evidence.some(e => e.asset_id === p.asset_id)).map(e => e.asset_id) : [] })])
        return { participation: saved, result: calculated, next: command === 'complete' ? nextLearner(roster, learner) : null }
      })
    },
  }
}
export type LearnerAssessmentData = Awaited<ReturnType<ReturnType<typeof learnerAssessmentService>['get']>>
export type AssessmentRosterData = Awaited<ReturnType<ReturnType<typeof learnerAssessmentService>['roster']>>
