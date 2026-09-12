import { config } from 'dotenv'
import pg from 'pg'
import { createHash } from 'node:crypto'
config({ path: '.env.local', quiet: true })
export function targetFingerprint(connectionString) {
  const url = new URL(connectionString)
  return createHash('sha256').update(`${url.hostname}:${url.port || '5432'}${url.pathname}`).digest('hex')
}
export function developmentPool() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development database tools are disabled in production')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  if (process.env.DEV_DATABASE_FINGERPRINT !== targetFingerprint(process.env.DATABASE_URL)) {
    throw new Error('Development target is not pinned or changed. Verify the branch, then run node scripts/db-pin.mjs schoolhub-fresh-dev')
  }
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 })
}
export const foundationTables = ['schools','audit_actors','school_memberships','roles','membership_roles','staff_profiles','learners','learner_admissions','academic_years','terms','grades','class_groups','learner_enrolments','class_placements','subject_catalogue','subject_grades','school_subjects','subject_offerings','learner_subject_enrolments','teacher_assignments','audit_events']
export const mediaTables = ['media_assets','media_folders']
export const authTables = ['user','session','account','verification']
export const legacyTables = ['folders','files','announcements','events','activity_logs','students','portfolioFiles']
export function safeFailure(error) {
  console.error({ error: error.name, code: error.code, message: error.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') })
  process.exitCode = 1
}

