import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { foundationService } from './foundation'
import { administrationService } from './administration'
import { assessmentService } from './assessments'
import { learnerAssessmentService } from './learner-assessments'
import { fileService } from './files'
import { uploadToR2, getR2ObjectBytes } from '@/lib/r2'

async function identify() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user.id ?? null
}

const privateStorage = { upload: uploadToR2, read: getR2ObjectBytes }

export const learnerAssessments = learnerAssessmentService(pool, identify, privateStorage)
export const assessments = assessmentService(pool, identify)
export const foundation = foundationService(pool, identify)
export const administration = administrationService(pool, identify)
export const schoolFiles = fileService(pool, identify, privateStorage)
