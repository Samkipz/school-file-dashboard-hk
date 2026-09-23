import { cache } from 'react'
import { redirect } from 'next/navigation'
import { foundation } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
import { selectSchool } from '@/lib/academic-navigation'

export const loadSchoolContext = cache(async (requested?: string) => {
  try {
    const schools = await foundation.listSchools()
    const school = selectSchool(schools, requested)
    if (!school) return { schools, school: undefined, context: null, denied: requested !== undefined }
    try {
      return { schools, school, context: await foundation.getSchoolContext(school.id), denied: false }
    } catch (error) {
      if (error instanceof DomainError && error.code !== 'UNAUTHORIZED') return { schools, school, context: null, denied: true }
      throw error
    }
  } catch (error) {
    if (error instanceof DomainError && error.code === 'UNAUTHORIZED') redirect('/sign-in')
    throw error
  }
})

export const loadTeaching = cache(async (school: string) => {
  const data = await foundation.getFoundation(school, 'assigned')
  // Reuse the authoritative roster policy for counts; never count wider enrolments.
  return Promise.all(data.offerings.map(async offering => ({
    ...offering, learnerCount: (await foundation.getOfferingRoster(school, offering.id)).length,
  })))
})
