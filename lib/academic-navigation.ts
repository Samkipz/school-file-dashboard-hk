export type School = { id: string; name: string }
export type Capabilities = { canManage: boolean; canTeach: boolean }

// Explicit context never falls back to a different school.
export function selectSchool(schools: School[], requested?: string) {
  return requested !== undefined ? schools.find(s => s.id === requested) : schools.length === 1 ? schools[0] : undefined
}

export function academicHref(path: string, school?: string, offering?: string, view?: string) {
  const params = new URLSearchParams()
  if (school) params.set('school', school)
  if (offering) params.set('offering', offering)
  if (view) params.set('view', view)
  return `${path}${params.size ? `?${params}` : ''}`
}

export function academicNavigation(capabilities: Capabilities | null, school?: string) {
  if (capabilities?.canManage) {
    return [
      { label: 'Dashboard', href: academicHref('/admin', school) },
      { label: 'Academics', href: academicHref('/admin/academics', school) },
      { label: 'Staff', href: academicHref('/admin/staff', school) },
      { label: 'Learners', href: academicHref('/admin/learners', school) },
      { label: 'Files', href: academicHref('/files', school) },
      { label: 'Settings', href: academicHref('/admin/settings', school) },
    ]
  }

  const items = [{ label: 'Home', href: academicHref('/', school) }]
  if (capabilities?.canTeach) items.push({ label: 'My Teaching', href: academicHref('/academics', school) })
  if (capabilities?.canManage || capabilities?.canTeach) items.push({ label: 'Private Files', href: academicHref('/files', school) })
  return items
}

export type PeriodRecord = {
  code?: string | number | boolean | null
  status?: string | number | boolean | null
  starts_on?: string | number | boolean | null
  ends_on?: string | number | boolean | null
}

function normalizeDate(value: PeriodRecord['starts_on'] | PeriodRecord['ends_on']) {
  if (value === null || value === undefined || typeof value === 'boolean') return null
  const raw = String(value).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

export function isDateWithinRange(day: string, start: string | null | undefined, end: string | null | undefined) {
  if (!day || (!start && !end)) return false
  const target = new Date(`${day}T00:00:00Z`).getTime()
  const startDate = start ? new Date(`${start}T00:00:00Z`).getTime() : Number.NEGATIVE_INFINITY
  const endDate = end ? new Date(`${end}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY
  return target >= startDate && target <= endDate
}

export function currentPeriodLabel(records: PeriodRecord[], kind: 'year' | 'term', today = new Date().toISOString().slice(0, 10)) {
  const codes = records
    .map(record => {
      const code = typeof record.code === 'string' ? record.code.trim() : record.code == null ? null : String(record.code).trim()
      if (kind === 'year' && record.status && String(record.status).toLowerCase() !== 'active') return null
      const start = normalizeDate(record.starts_on)
      const end = normalizeDate(record.ends_on)
      if (start || end) {
        return isDateWithinRange(today, start, end) ? code : null
      }
      return code
    })
    .filter((code): code is string => typeof code === 'string' && code.length > 0)

  if (!codes.length) return `No current ${kind}`
  if (codes.length > 1) return `More than one ${kind} is marked as current.`
  return codes[0]
}

export function termPresentationState(record: PeriodRecord, today = new Date().toISOString().slice(0, 10)) {
  const start = normalizeDate(record.starts_on)
  const end = normalizeDate(record.ends_on)
  if (!start && !end) return 'upcoming'
  const startStamp = start ? new Date(`${start}T00:00:00Z`).getTime() : Number.NEGATIVE_INFINITY
  const endStamp = end ? new Date(`${end}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY
  const target = new Date(`${today}T00:00:00Z`).getTime()
  if (target < startStamp) return 'upcoming'
  if (target > endStamp) return 'past'
  return 'current'
}
