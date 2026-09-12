import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { foundationService } from './foundation'
import { administrationService } from './administration'

export const foundation = foundationService(pool, async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user.id ?? null
})

export const administration = administrationService(pool, async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user.id ?? null
})

import { fileService } from './files'
import { uploadToR2, getR2ObjectBytes } from '@/lib/r2'
export const schoolFiles = fileService(pool, async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user.id ?? null
}, { upload: uploadToR2, read: getR2ObjectBytes })
