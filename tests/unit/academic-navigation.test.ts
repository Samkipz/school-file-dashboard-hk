import { describe, expect, it } from 'vitest'
import { academicHref, academicNavigation, currentPeriodLabel, selectSchool } from '../../lib/academic-navigation'

const schools = [{ id: 'school-a', name: 'A' }, { id: 'school-b', name: 'B' }]
describe('academic navigation and context', () => {
  it('selects only an unambiguous membership by default', () => {
    expect(selectSchool([])).toBeUndefined()
    expect(selectSchool(schools)).toBeUndefined()
    expect(selectSchool([schools[0]])).toEqual(schools[0])
  })
  it('honours explicit selection and never substitutes stale or forged context', () => {
    expect(selectSchool(schools, 'school-b')).toEqual(schools[1])
    for (const requested of ['foreign-school', '', 'malformed']) expect(selectSchool([schools[0]], requested)).toBeUndefined()
  })
  it('preserves school and offering across overview, learners and refresh URLs', () => {
    for (const view of ['overview', 'learners']) {
      const url = new URL(academicHref('/academics', 'school-b', 'offering-a', view), 'https://example.test')
      expect(Object.fromEntries(url.searchParams)).toEqual({ school: 'school-b', offering: 'offering-a', view })
      expect(new URL(url.href).search).toBe(url.search)
    }
    expect(academicHref('/academics', 'school-b')).toBe('/academics?school=school-b')
  })
  it('encodes context without introducing another query parameter', () => {
    const url = new URL(academicHref('/academics', 'a&school=b'), 'https://example.test')
    expect(url.searchParams.getAll('school')).toEqual(['a&school=b'])
  })
  it('keeps teacher navigation small and excludes unavailable capabilities', () => {
    expect(academicNavigation({ canTeach: true, canManage: false }, 'school-a')).toEqual([
      { label: 'Home', href: '/?school=school-a' },
      { label: 'My Teaching', href: '/academics?school=school-a' },
      { label: 'Private Files', href: '/files?school=school-a' },
    ])
  })
  it('preserves admin workflows without claiming the admin teaches every class', () => {
    expect(academicNavigation({ canTeach: false, canManage: true }, 'school-a').map(i => i.href)).toEqual([
      '/?school=school-a', '/admin/academics?school=school-a', '/admin/assessments?school=school-a', '/files?school=school-a',
    ])
  })
  it('supports staff with both capabilities', () => {
    expect(academicNavigation({ canTeach: true, canManage: true }).map(i => i.label)).toEqual(['Overview', 'My Teaching', 'School Administration', 'Assessment Setup', 'Private Files'])
  })
  it('does not offer protected workspaces without capabilities', () => {
    for (const capabilities of [null, { canTeach: false, canManage: false }]) expect(academicNavigation(capabilities)).toEqual([{ label: 'Home', href: '/' }])
  })
  it('distinguishes missing, current and ambiguous periods without choosing one', () => {
    expect(currentPeriodLabel([], 'term')).toBe('No current term')
    expect(currentPeriodLabel([{ code: 'Term 3' }], 'term')).toBe('Term 3')
    expect(currentPeriodLabel([{ code: 'Year A' }, { code: 'Year B' }], 'year')).toContain('Multiple current years: Year A, Year B')
  })
})
