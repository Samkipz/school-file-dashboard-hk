import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { foundationService, DomainError, uuidInput, type Context } from './foundation.ts'
import { metadata, validateUpload } from './file-validation.ts'
export type FileTarget = { learnerId: string } | { folderId: string }
export type Asset = { id: string; learner_id: string | null; folder_id: string | null; original_name: string; title: string; description: string | null; category: string; mime_type: string; size: number; uploaded_at: Date; uploader: string }
export type PortfolioLearner = { id: string; display_name: string; status: string; academic_context: string | null }
export type MediaFolder = { id: string; name: string; description: string | null }
export type PrivateStorage = { upload(key: string, bytes: Buffer, mime: string): Promise<void>; read(key: string): Promise<{ bytes: Uint8Array; contentType: string }> }
const columns = `f.id,f.learner_id,f.folder_id,f.original_name,f.title,f.description,f.category,f.mime_type,f.size,f.uploaded_at,coalesce(u.name,a.actor_code) AS uploader`
// Same current offering, assignment and roster conditions as the academic foundation.
const teacherScope = `EXISTS (SELECT 1 FROM learner_subject_enrolments se
 JOIN learner_enrolments e ON e.school_id=se.school_id AND e.id=se.enrolment_id
 JOIN class_placements p ON p.school_id=se.school_id AND p.id=se.placement_id
 JOIN learner_admissions a ON a.school_id=e.school_id AND a.id=e.admission_id
 JOIN subject_offerings o ON o.school_id=se.school_id AND o.id=se.offering_id
 JOIN class_groups c ON c.school_id=o.school_id AND c.id=o.class_group_id
 JOIN school_subjects ss ON ss.school_id=o.school_id AND ss.id=o.school_subject_id
 JOIN academic_years y ON y.school_id=o.school_id AND y.id=o.academic_year_id
 JOIN teacher_assignments ta ON ta.school_id=o.school_id AND ta.offering_id=o.id
 JOIN staff_profiles sp ON sp.school_id=ta.school_id AND sp.id=ta.staff_id
 WHERE e.learner_id=l.id AND e.school_id=l.school_id AND sp.membership_id=$2
 AND ta.status='active' AND ta.archived_at IS NULL AND sp.status='active' AND sp.archived_at IS NULL
 AND o.status='active' AND o.archived_at IS NULL AND c.status='active' AND c.archived_at IS NULL
 AND ss.enabled AND ss.archived_at IS NULL AND y.status='active' AND y.archived_at IS NULL
 AND se.status='active' AND se.archived_at IS NULL AND e.status='active' AND e.archived_at IS NULL
 AND l.status='active' AND l.archived_at IS NULL AND p.archived_at IS NULL AND a.status='active' AND a.archived_at IS NULL
 AND (now() AT TIME ZONE $3)::date BETWEEN y.starts_on AND y.ends_on
 AND (now() AT TIME ZONE $3)::date BETWEEN ta.starts_on AND coalesce(ta.ends_on,y.ends_on)
 AND (now() AT TIME ZONE $3)::date BETWEEN se.starts_on AND coalesce(se.ends_on,y.ends_on)
 AND (now() AT TIME ZONE $3)::date BETWEEN p.starts_on AND coalesce(p.ends_on,y.ends_on)
 AND (now() AT TIME ZONE $3)::date BETWEEN e.starts_on AND coalesce(e.ends_on,y.ends_on)
 AND (now() AT TIME ZONE $3)::date BETWEEN a.admitted_on AND coalesce(a.left_on,y.ends_on))`
export function fileService(pool: Pool, identify: () => Promise<string | null>, storage: PrivateStorage) {
  const foundation = foundationService(pool, identify)
  const admin = (context: Context) => { if (!context.roles.includes('school_admin')) throw new DomainError('FORBIDDEN') }
  async function learners(client: PoolClient, context: Context, learnerId?: string) {
    if (!context.roles.includes('school_admin') && !context.roles.includes('teacher')) throw new DomainError('FORBIDDEN')
    return (await client.query<PortfolioLearner>(`SELECT l.id,l.display_name,l.status,
      (SELECT y.code || ' · ' || g.label FROM learner_enrolments e JOIN academic_years y ON y.school_id=e.school_id AND y.id=e.academic_year_id
       JOIN grades g ON g.id=e.grade_id WHERE e.school_id=l.school_id AND e.learner_id=l.id AND e.archived_at IS NULL ORDER BY y.starts_on DESC LIMIT 1) AS academic_context
      FROM learners l WHERE l.school_id=$1 AND ($4::uuid IS NULL OR l.id=$4)
      AND (${context.roles.includes('school_admin') ? '$2::uuid IS NOT NULL AND $3::text IS NOT NULL' : teacherScope}) ORDER BY l.display_name,l.id`, [context.school_id,context.membership_id,context.timezone,learnerId ?? null])).rows
  }
  async function target(client: PoolClient, context: Context, value: FileTarget) {
    if (!value || typeof value !== 'object' || Object.keys(value).length !== 1) throw new DomainError('INVALID_INPUT')
    if ('learnerId' in value) {
      uuidInput(value.learnerId)
      if (!(await learners(client, context, value.learnerId)).length) throw new DomainError('NOT_FOUND')
      return { learner: value.learnerId, folder: null, column: 'learner_id', id: value.learnerId }
    }
    if (!('folderId' in value)) throw new DomainError('INVALID_INPUT')
    admin(context); uuidInput(value.folderId)
    if (!(await client.query('SELECT id FROM media_folders WHERE school_id=$1 AND id=$2 AND archived_at IS NULL', [context.school_id,value.folderId])).rowCount) throw new DomainError('NOT_FOUND')
    return { learner: null, folder: value.folderId, column: 'folder_id', id: value.folderId }
  }
  async function asset(client: PoolClient, context: Context, id: string) {
    uuidInput(id)
    const row = (await client.query<Asset & { object_key: string }>(`SELECT ${columns}, f.object_key FROM media_assets f JOIN audit_actors a ON a.id=f.uploaded_by_actor_id LEFT JOIN "user" u ON u.id=a.user_id WHERE f.school_id=$1 AND f.id=$2 AND f.state='ready' AND f.archived_at IS NULL`, [context.school_id,id])).rows[0]
    if (!row) throw new DomainError('NOT_FOUND')
    await target(client, context, row.learner_id ? { learnerId: row.learner_id } : { folderId: row.folder_id! })
    return row
  }
  async function audit(client: PoolClient, context: Context, event: string, id: string) {
    await client.query(`INSERT INTO audit_events(school_id,actor_id,membership_id,event_type,resource_type,resource_id,command_id,sequence) VALUES($1,$2,$3,$4,'media_asset',$5,$6,1)`, [context.school_id,context.actor_id,context.membership_id,event,id,randomUUID()])
  }
  return {
    listLearners: (school: string) => foundation.inSchool(school, async (c,x) => ({ learners: await learners(c,x), canManage: x.roles.includes('school_admin') })),
    listFolders: (school: string) => foundation.inSchool(school, async (c,x) => { admin(x); return (await c.query<MediaFolder>('SELECT id,name,description FROM media_folders WHERE school_id=$1 AND archived_at IS NULL ORDER BY name', [school])).rows }),
    saveFolder: (school: string, name: string, description: string, id?: string) => foundation.inSchool(school, async (c,x) => {
      admin(x); const fields = metadata(name,description,'general'); if (id) uuidInput(id)
      const result = id ? await c.query<MediaFolder>('UPDATE media_folders SET name=$3,description=$4 WHERE school_id=$1 AND id=$2 AND archived_at IS NULL RETURNING id,name,description', [school,id,fields.title,fields.description]) :
        await c.query<MediaFolder>('INSERT INTO media_folders(school_id,name,description,created_by_actor_id) VALUES($1,$2,$3,$4) RETURNING id,name,description', [school,fields.title,fields.description,x.actor_id])
      if (!result.rowCount) throw new DomainError('NOT_FOUND'); await audit(c,x,'media.folder_saved',result.rows[0].id); return result.rows[0]
    }),
    archiveFolder: (school: string, id: string) => foundation.inSchool(school, async (c,x) => {
      admin(x); await target(c,x,{folderId:id})
      if ((await c.query('SELECT id FROM media_assets WHERE school_id=$1 AND folder_id=$2 AND archived_at IS NULL AND state IN (\'ready\',\'pending\')',[school,id])).rowCount) throw new DomainError('CONFLICT')
      await c.query('UPDATE media_folders SET archived_at=now() WHERE school_id=$1 AND id=$2',[school,id]); await audit(c,x,'media.folder_archived',id)
    }),
    list: (school: string, value: FileTarget) => foundation.inSchool(school, async (c,x) => {
      const t = await target(c,x,value)
      return (await c.query<Asset>(`SELECT ${columns} FROM media_assets f JOIN audit_actors a ON a.id=f.uploaded_by_actor_id LEFT JOIN "user" u ON u.id=a.user_id WHERE f.school_id=$1 AND f.${t.column}=$2 AND f.state='ready' AND f.archived_at IS NULL ORDER BY f.uploaded_at DESC`, [school,t.id])).rows
    }),
    async upload(school: string, value: FileTarget, form: FormData) {
      // Authorize before reading bytes, reserve metadata before touching object storage.
      await foundation.inSchool(school, async (c,x) => { admin(x); await target(c,x,value) })
      const data = await validateUpload(form, 'folderId' in value)
      const id = randomUUID(), key = `schools/${school}/assets/${id}.${data.ext}`
      const actor = await foundation.inSchool(school, async (c,x) => {
        admin(x); const t = await target(c,x,value)
        await c.query(`INSERT INTO media_assets(id,school_id,learner_id,folder_id,object_key,original_name,title,description,category,mime_type,size,uploaded_by_actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [id,school,t.learner,t.folder,key,data.originalName,data.title,data.description,data.category,data.mimeType,data.size,x.actor_id])
        await audit(c,x,'media.upload_reserved',id); return x.actor_id
      })
      try { await storage.upload(key,data.bytes,data.mimeType) }
      catch {
        // Failed/pending rows retain the generated key for reconciliation; never delete existing objects.
        try { await foundation.inSchool(school, async (c,x) => { admin(x); await c.query("UPDATE media_assets SET state='failed' WHERE school_id=$1 AND id=$2 AND state='pending'",[school,id]); await audit(c,x,'media.upload_failed',id) }) }
        catch { console.error('Media upload requires reconciliation', { assetId: id }) }
        throw new Error('Upload failed. Please try again.')
      }
      try {
        await foundation.inSchool(school, async (c,x) => {
          admin(x); await target(c,x,value)
          const result = await c.query("UPDATE media_assets SET state='ready' WHERE school_id=$1 AND id=$2 AND state='pending' AND uploaded_by_actor_id=$3",[school,id,actor])
          if (!result.rowCount) throw new DomainError('CONFLICT'); await audit(c,x,'media.upload_completed',id)
        })
      } catch { console.error('Media upload requires reconciliation', { assetId: id }); throw new Error('Upload could not be finalized. Contact your administrator.') }
      return { id }
    },
    update: (school: string, id: string, title: string, description: string, category: string) => foundation.inSchool(school, async (c,x) => {
      admin(x); await asset(c,x,id); const fields = metadata(title,description,category)
      await c.query('UPDATE media_assets SET title=$3,description=$4,category=$5 WHERE school_id=$1 AND id=$2',[school,id,fields.title,fields.description,fields.category]); await audit(c,x,'media.metadata_updated',id)
    }),
    archive: (school: string, id: string) => foundation.inSchool(school, async (c,x) => {
      admin(x); await asset(c,x,id); await c.query('UPDATE media_assets SET archived_at=now() WHERE school_id=$1 AND id=$2',[school,id]); await audit(c,x,'media.archived',id)
    }),
    download: (school: string, id: string) => foundation.inSchool(school, async (c,x) => {
      const row = await asset(c,x,id)
      const object = await storage.read(row.object_key)
      return { bytes: object.bytes, mimeType: row.mime_type, name: row.original_name }
    }),
  }
}

