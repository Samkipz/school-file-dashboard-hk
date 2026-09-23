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
  const items = [{ label: capabilities?.canManage ? 'Overview' : 'Home', href: academicHref('/', school) }]
  if (capabilities?.canTeach) items.push({ label: 'My Teaching', href: academicHref('/academics', school) })
  if (capabilities?.canManage) items.push(
    { label: 'School Administration', href: academicHref('/admin/academics', school) },
    { label: 'Assessment Setup', href: academicHref('/admin/assessments', school) },
  )
  if (capabilities?.canManage || capabilities?.canTeach) items.push({ label: 'Private Files', href: academicHref('/files', school) })
  return items
}

export function currentPeriodLabel(records: { code: string }[], kind: 'year' | 'term') {
  if (!records.length) return `No current ${kind}`
  if (records.length > 1) return `Multiple current ${kind}s: ${records.map(r => r.code).join(', ')}. Contact your administrator.`
  return records[0].code
}
