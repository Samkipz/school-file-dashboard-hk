import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { foundationService, DomainError, uuidInput, type Context } from './foundation.ts'
import { draftInput, typeInput, versionInput, initialAssessmentTypes, record, type PlanningFields } from './assessment-validation.ts'
import { criteriaInput, scaleInput, validateOpening, validateScale, derivedMaximum, scoreText, DefinitionError, type Criterion, type PerformanceLevel } from './scoring-guide.ts'
import { loadCriteria, loadLevels, saveCriteria, saveLevels, deleteCriteria } from './scoring-persistence.ts'

export type AssessmentType = { id: string; code: string; name: string; enabled: boolean; row_version: string }
export type AssessmentDraft = PlanningFields & { id: string; offering_id: string; academic_year_id: string; term_id: string | null; assessment_type_id: string; status: 'draft' | 'open'; row_version: string; maximum_score: string; origin: 'internal' | 'external'; authority: string | null; external_reference: string | null; levels: PerformanceLevel[]; tasks: (PlanningFields & { id: string; ordinal: number; criteria: Criterion[] })[] }
export type AssessmentData = { types: AssessmentType[]; drafts: AssessmentDraft[]; offerings: { id: string; academic_year_id: string; label: string }[]; terms: { id: string; academic_year_id: string; code: string }[] }

export function assessmentService(pool: Pool, identify: () => Promise<string | null>) {
  const access = foundationService(pool, identify)
  const admin = <T>(school: string, run: (db: PoolClient, ctx: Context) => Promise<T>) => access.inSchool(school, async (db, ctx) => {
    if (!ctx.roles.includes('school_admin')) throw new DomainError('FORBIDDEN')
    return run(db, ctx)
  })
  async function audit(db: PoolClient, ctx: Context, event: string, resource: string, id: string, changes: Record<string, unknown>) {
    await db.query(`INSERT INTO audit_events (school_id,actor_id,membership_id,event_type,resource_type,resource_id,command_id,sequence,safe_changes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8::jsonb)`, [ctx.school_id, ctx.actor_id, ctx.membership_id, event, resource, id, randomUUID(), JSON.stringify(changes)])
  }
  async function load(db: PoolClient, school: string, id?: string, offering?: string) {
    const rows = await db.query<{ row: AssessmentDraft }>(`SELECT to_jsonb(a) || jsonb_build_object('row_version',a.row_version::text,'tasks',
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'ordinal',t.ordinal,'title',t.title,'instructions',t.instructions,'starts_on',t.starts_on,'due_on',t.due_on) ORDER BY t.ordinal)
      FROM assessment_tasks t WHERE t.school_id=a.school_id AND t.assessment_id=a.id),'[]'::jsonb)) AS row
      FROM assessments a WHERE a.school_id=$1 AND a.archived_at IS NULL AND ($2::uuid IS NULL OR a.id=$2) AND ($3::uuid IS NULL OR a.offering_id=$3) ORDER BY a.created_at DESC,a.id`, [school, id ?? null, offering ?? null])
    const definitions = rows.rows.map(r => r.row)
    for (const definition of definitions) {
      definition.levels = await loadLevels(db, school, definition.id)
      for (const task of definition.tasks) task.criteria = await loadCriteria(db, school, task.id)
      definition.maximum_score = scoreText(derivedMaximum(definition.tasks).total)
    }
    return definitions
  }
  return {
    readOffering(school: string, offering: string): Promise<AssessmentData> {
      return access.inSchool(school, async (db, ctx) => {
        await access.authorizeOffering(db, ctx, offering)
        const drafts = await load(db, school, undefined, offering)
        return { drafts, types: (await db.query<AssessmentType>('SELECT id,code,name,enabled,row_version::text FROM assessment_types WHERE school_id=$1 AND archived_at IS NULL ORDER BY name', [school])).rows,
          offerings: (await db.query('SELECT id,academic_year_id FROM subject_offerings WHERE school_id=$1 AND id=$2', [school, offering])).rows.map(o => ({ ...o, label: '' })),
          terms: (await db.query('SELECT id,academic_year_id,code FROM terms WHERE school_id=$1 AND academic_year_id=(SELECT academic_year_id FROM subject_offerings WHERE school_id=$1 AND id=$2) AND archived_at IS NULL ORDER BY ordinal', [school, offering])).rows }
      })
    },
    open(school: string, id: string, expectedVersion: number) {
      return access.inSchool(school, async (db, ctx) => {
        const definition = (await load(db, school, uuidInput(id)))[0]
        if (!definition) throw new DomainError('NOT_FOUND')
        await access.authorizeOffering(db, ctx, definition.offering_id)
        if (definition.status !== 'draft' || definition.row_version !== String(versionInput(expectedVersion))) throw new DomainError('CONFLICT')
        const context = await db.query(`SELECT 1 FROM subject_offerings o JOIN academic_years y ON y.school_id=o.school_id AND y.id=o.academic_year_id
          JOIN class_groups c ON c.school_id=o.school_id AND c.id=o.class_group_id JOIN school_subjects s ON s.school_id=o.school_id AND s.id=o.school_subject_id
          JOIN assessment_types t ON t.school_id=o.school_id AND t.id=$3
          WHERE o.school_id=$1 AND o.id=$2 AND o.status='active' AND o.archived_at IS NULL AND y.status IN ('draft','active') AND y.archived_at IS NULL
          AND c.status='active' AND c.archived_at IS NULL AND s.enabled AND s.archived_at IS NULL AND t.enabled AND t.archived_at IS NULL`, [school, definition.offering_id, definition.assessment_type_id])
        if (!context.rowCount) throw new DefinitionError(['The offering, academic year or assessment type is no longer available. Contact your school administrator.'])
        const parsed = draftInput(definition)
        const tasks = definition.tasks.map((task, i) => {
          if (task.ordinal !== i + 1) throw new DefinitionError(['Task ordering is invalid. Save and review the draft.'])
          return { ...parsed.tasks[i], criteria: criteriaInput(task.criteria) }
        })
        const maximum = validateOpening(tasks, scaleInput(definition.levels))
        const changed = await db.query(`UPDATE assessments SET status='open',opened_at=now(),opened_by_actor_id=$4,updated_by_actor_id=$4 WHERE school_id=$1 AND id=$2 AND row_version=$3 AND status='draft' RETURNING row_version::text`, [school, id, expectedVersion, ctx.actor_id])
        if (!changed.rowCount) throw new DomainError('CONFLICT')
        await audit(db, ctx, 'assessment.opened', 'assessments', id, { maximum_units: maximum.total, row_version: changed.rows[0].row_version })
        return (await load(db, school, id))[0]
      })
    },
    read(school: string): Promise<AssessmentData> {
      return admin(school, async db => ({
        drafts: await load(db, school),
        types: (await db.query<AssessmentType>('SELECT id,code,name,enabled,row_version::text FROM assessment_types WHERE school_id=$1 AND archived_at IS NULL ORDER BY name', [school])).rows,
        offerings: (await db.query(`SELECT o.id,o.academic_year_id,concat(y.code,' · ',g.label,' · ',c.label,' · ',s.display_name) AS label
          FROM subject_offerings o JOIN academic_years y ON y.school_id=o.school_id AND y.id=o.academic_year_id
          JOIN class_groups c ON c.school_id=o.school_id AND c.id=o.class_group_id JOIN grades g ON g.id=o.grade_id
          JOIN school_subjects s ON s.school_id=o.school_id AND s.id=o.school_subject_id
          WHERE o.school_id=$1 AND o.status='active' AND o.archived_at IS NULL AND y.status IN ('draft','active') AND y.archived_at IS NULL
          AND c.status='active' AND c.archived_at IS NULL AND s.enabled AND s.archived_at IS NULL ORDER BY y.code,c.label,s.display_name`, [school])).rows,
        terms: (await db.query('SELECT id,academic_year_id,code FROM terms WHERE school_id=$1 AND archived_at IS NULL ORDER BY academic_year_id,ordinal', [school])).rows,
      }))
    },
    get(school: string, id: string) {
      return admin(school, async db => { const row = (await load(db, school, uuidInput(id)))[0]; if (!row) throw new DomainError('NOT_FOUND'); return row })
    },
    initializeTypes(school: string) {
      return admin(school, async (db, ctx) => {
        for (const [code, name] of initialAssessmentTypes) {
          const result = await db.query(`INSERT INTO assessment_types (school_id,code,name,created_by_actor_id,updated_by_actor_id) VALUES ($1,$2,$3,$4,$4)
            ON CONFLICT (school_id,code) DO NOTHING RETURNING id`, [school, code, name, ctx.actor_id])
          if (result.rowCount) await audit(db, ctx, 'assessment_type.created', 'assessment_types', result.rows[0].id, { fields: ['code','name','enabled'] })
        }
      })
    },
    saveType(school: string, value: unknown, id?: string, expectedVersion?: number) {
      return admin(school, async (db, ctx) => {
        const input = typeInput(value)
        const result = id
          ? await db.query(`UPDATE assessment_types SET code=$3,name=$4,enabled=$5,updated_by_actor_id=$6 WHERE school_id=$1 AND id=$2 AND row_version=$7 AND archived_at IS NULL RETURNING id,row_version::text`, [school,uuidInput(id),input.code,input.name,input.enabled,ctx.actor_id,versionInput(expectedVersion)])
          : await db.query(`INSERT INTO assessment_types (school_id,code,name,enabled,created_by_actor_id,updated_by_actor_id) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id,row_version::text`, [school,input.code,input.name,input.enabled,ctx.actor_id])
        if (!result.rowCount) throw new DomainError('CONFLICT')
        await audit(db, ctx, id ? 'assessment_type.updated' : 'assessment_type.created', 'assessment_types', result.rows[0].id, { fields: ['code','name','enabled'], row_version: result.rows[0].row_version })
        return result.rows[0].id as string
      })
    },
    save(school: string, value: unknown, id?: string, expectedVersion?: number) {
      return access.inSchool(school, async (db, ctx) => {
        if (!ctx.roles.some(role => ['school_admin','teacher'].includes(role))) throw new DomainError('FORBIDDEN')
        const input = draftInput(value), raw = record(value)
        await access.authorizeOffering(db, ctx, input.offering_id)
        let previous: AssessmentDraft | undefined
        if (id) {
          uuidInput(id); versionInput(expectedVersion)
          previous = (await load(db, school, id))[0]
          if (!previous) throw new DomainError('NOT_FOUND')
          await access.authorizeOffering(db, ctx, previous.offering_id)
          if (previous.offering_id !== input.offering_id && !ctx.roles.includes('school_admin')) throw new DomainError('FORBIDDEN')
          if (previous.status !== 'draft' || previous.row_version !== String(expectedVersion)) throw new DomainError('CONFLICT')
        }
        const previousTasks = new Map(previous?.tasks.map(task => [task.id, task]) ?? [])
        const rawTasks = raw.tasks as Record<string, unknown>[]
        const guides = input.tasks.map((task, i) => criteriaInput(rawTasks[i].criteria ?? previousTasks.get(task.id ?? '')?.criteria ?? []))
        const levels = scaleInput(raw.levels ?? previous?.levels ?? [])
        validateScale(levels, derivedMaximum(guides.map(criteria => ({ criteria }))).total)
        const origin = raw.origin ?? previous?.origin ?? 'internal'
        const optionalText = (value: unknown) => {
          if (value == null || value === '') return null
          if (typeof value !== 'string' || !value.trim() || value.length > 160 || value.includes('\u0000')) throw new DomainError('INVALID_INPUT')
          return value.trim()
        }
        const authority = optionalText(raw.authority === undefined ? previous?.authority : raw.authority)
        const externalReference = optionalText(raw.external_reference === undefined ? previous?.external_reference : raw.external_reference)
        if (!['internal','external'].includes(String(origin)) || (origin === 'external' ? !authority : authority || externalReference)) throw new DefinitionError(['External assessments need an authority name. Internal assessments cannot have an external authority or reference.'])
        // An ID is a claim to an existing child, never permission to create or move it.
        for (const task of input.tasks) if (task.id && !previousTasks.has(task.id)) throw new DomainError('INVALID_INPUT')
        const offering = (await db.query(`SELECT o.academic_year_id,y.starts_on::text,y.ends_on::text FROM subject_offerings o
          JOIN academic_years y ON y.school_id=o.school_id AND y.id=o.academic_year_id JOIN class_groups c ON c.school_id=o.school_id AND c.id=o.class_group_id
          JOIN school_subjects s ON s.school_id=o.school_id AND s.id=o.school_subject_id
          WHERE o.school_id=$1 AND o.id=$2 AND o.status='active' AND o.archived_at IS NULL AND y.status IN ('draft','active') AND y.archived_at IS NULL
          AND c.status='active' AND c.archived_at IS NULL AND s.enabled AND s.archived_at IS NULL`, [school,input.offering_id])).rows[0]
        if (!offering) throw new DomainError('INVALID_INPUT')
        if (!(await db.query('SELECT 1 FROM assessment_types WHERE school_id=$1 AND id=$2 AND enabled AND archived_at IS NULL', [school,input.assessment_type_id])).rowCount) throw new DomainError('INVALID_INPUT')
        if (input.term_id && !(await db.query('SELECT 1 FROM terms WHERE school_id=$1 AND id=$2 AND academic_year_id=$3 AND archived_at IS NULL', [school,input.term_id,offering.academic_year_id])).rowCount) throw new DomainError('INVALID_INPUT')
        for (const fields of [input,...input.tasks]) for (const date of [fields.starts_on,fields.due_on]) {
          if (date && (date < offering.starts_on || date > offering.ends_on)) throw new DomainError('INVALID_INPUT')
        }
        const values = [school,input.offering_id,offering.academic_year_id,input.term_id,input.assessment_type_id,input.title,input.instructions,input.starts_on,input.due_on,ctx.actor_id]
        const result = id
          ? await db.query(`UPDATE assessments SET offering_id=$2,academic_year_id=$3,term_id=$4,assessment_type_id=$5,title=$6,instructions=$7,starts_on=$8,due_on=$9,updated_by_actor_id=$10
            WHERE school_id=$1 AND id=$11 AND row_version=$12 AND status='draft' AND archived_at IS NULL RETURNING id`, [...values,id,expectedVersion])
          : await db.query(`INSERT INTO assessments (school_id,offering_id,academic_year_id,term_id,assessment_type_id,title,instructions,starts_on,due_on,created_by_actor_id,updated_by_actor_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id`, values)
        if (!result.rowCount) throw new DomainError('CONFLICT')
        const savedId = result.rows[0].id as string
        const retained = new Set(input.tasks.flatMap(task => task.id ? [task.id] : []))
        const deleted = [...previousTasks.keys()].filter(taskId => !retained.has(taskId))
        const created: string[] = [], updated: string[] = []
        const ordering: { id: string; from: number | null; to: number }[] = []
        // Safe only in today's draft-only model. Dependent records require an approved deletion/correction lifecycle.
        for (const taskId of deleted) await deleteCriteria(db, school, taskId)
        if (deleted.length) await db.query('DELETE FROM assessment_tasks WHERE school_id=$1 AND assessment_id=$2 AND id=ANY($3::uuid[])', [school,savedId,deleted])
        await db.query('SET CONSTRAINTS assessment_tasks_school_id_assessment_id_ordinal_unique DEFERRED')
        for (const [i, task] of input.tasks.entries()) {
          const ordinal = i + 1, old = task.id ? previousTasks.get(task.id) : undefined
          if (old) {
            await saveCriteria(db, ctx, old.id, guides[i])
            if (old.ordinal !== ordinal) ordering.push({ id: old.id, from: old.ordinal, to: ordinal })
            if (old.ordinal !== ordinal || old.title !== task.title || old.instructions !== task.instructions || old.starts_on !== task.starts_on || old.due_on !== task.due_on) {
              await db.query(`UPDATE assessment_tasks SET ordinal=$4,title=$5,instructions=$6,starts_on=$7,due_on=$8,updated_by_actor_id=$9
                WHERE school_id=$1 AND assessment_id=$2 AND id=$3`, [school,savedId,old.id,ordinal,task.title,task.instructions,task.starts_on,task.due_on,ctx.actor_id])
              updated.push(old.id)
            }
          } else {
            const taskId = randomUUID()
            await db.query(`INSERT INTO assessment_tasks (id,school_id,assessment_id,ordinal,title,instructions,starts_on,due_on,created_by_actor_id,updated_by_actor_id)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`, [taskId,school,savedId,ordinal,task.title,task.instructions,task.starts_on,task.due_on,ctx.actor_id])
            created.push(taskId); ordering.push({ id: taskId, from: null, to: ordinal })
            await saveCriteria(db, ctx, taskId, guides[i])
          }
        }
        await saveLevels(db, ctx, savedId, levels)
        await db.query('UPDATE assessments SET origin=$3,authority=$4,external_reference=$5,updated_by_actor_id=$6 WHERE school_id=$1 AND id=$2', [school, savedId, origin, authority, externalReference, ctx.actor_id])
        const saved = (await load(db, school, savedId))[0]
        await audit(db, ctx, id ? 'assessment.updated' : 'assessment.created', 'assessments', savedId, {
          fields: ['offering_id','term_id','assessment_type_id','title','instructions','starts_on','due_on','tasks'],
          offering_id: input.offering_id, term_id: input.term_id, task_count: input.tasks.length, row_version: saved.row_version,
          tasks: { created, updated, deleted, ordering },
          scoring_structure: saved.tasks.map(t => ({ task_id: t.id, criteria: t.criteria.map(c => ({ id: c.id, indicators: c.indicators.map(i => i.id) })) })),
          level_ids: saved.levels.map(l => l.id),
        })
        return saved
      })
    },
  }
}
