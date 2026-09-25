import { describe, expect, it } from 'vitest'
import { academicHref, academicNavigation, currentPeriodLabel, selectSchool, termPresentationState } from '../../lib/academic-navigation'

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
  it('uses the School Admin dashboard and academic shell for school administrators', () => {
    expect(academicNavigation({ canTeach: false, canManage: true }, 'school-a').map(i => i.label)).toEqual([
      'Dashboard', 'Academics', 'Staff', 'Learners', 'Files', 'Settings',
    ])
    expect(academicNavigation({ canTeach: false, canManage: true }, 'school-a').map(i => i.href)).toEqual([
      '/admin?school=school-a', '/admin/academics?school=school-a', '/admin/staff?school=school-a', '/admin/learners?school=school-a', '/files?school=school-a', '/admin/settings?school=school-a',
    ])
  })
  it('preserves teacher access without adding teaching workspaces to the admin shell', () => {
    expect(academicNavigation({ canTeach: true, canManage: true }).map(i => i.label)).toEqual(['Dashboard', 'Academics', 'Staff', 'Learners', 'Files', 'Settings'])
  })
  it('does not offer protected workspaces without capabilities', () => {
    for (const capabilities of [null, { canTeach: false, canManage: false }]) expect(academicNavigation(capabilities)).toEqual([{ label: 'Home', href: '/' }])
  })
  it('derives the current term from the date range instead of raw term count', () => {
    const terms = [
      { code: 'Term 1', starts_on: '2026-01-01', ends_on: '2026-04-30' },
      { code: 'Term 2', starts_on: '2026-05-01', ends_on: '2026-08-31' },
      { code: 'Term 3', starts_on: '2026-09-01', ends_on: '2026-12-31' },
    ]
    expect(currentPeriodLabel(terms, 'term', '2026-09-25')).toBe('Term 3')
    expect(currentPeriodLabel(terms, 'term', '2026-05-15')).toBe('Term 2')
  })
  it('does not warn merely because multiple valid terms exist in the same year', () => {
    const terms = [
      { code: 'Term 1', starts_on: '2026-01-01', ends_on: '2026-04-30' },
      { code: 'Term 2', starts_on: '2026-05-01', ends_on: '2026-08-31' },
      { code: 'Term 3', starts_on: '2026-09-01', ends_on: '2026-12-31' },
    ]
    expect(currentPeriodLabel(terms, 'term', '2026-09-25')).not.toContain('More than one')
  })
  it('derives date-based presentation state without persisting a current flag', () => {
    const today = '2026-09-25'
    expect(currentPeriodLabel([{ code: 'Term 1', starts_on: '2026-01-01', ends_on: '2026-04-30' }], 'term', today)).toBe('No current term')
    expect(currentPeriodLabel([{ code: 'Term 3', starts_on: '2026-09-01', ends_on: '2026-12-31' }], 'term', today)).toBe('Term 3')
    expect(currentPeriodLabel([{ code: 'Term 4', starts_on: '2026-12-01', ends_on: '2026-12-31' }], 'term', today)).toBe('No current term')
  })
  it('classifies term state strictly from dates, including gaps between terms', () => {
    expect(termPresentationState({ starts_on: '2026-01-01', ends_on: '2026-04-30' }, '2026-02-15')).toBe('current')
    expect(termPresentationState({ starts_on: '2026-05-01', ends_on: '2026-08-31' }, '2026-09-25')).toBe('past')
    expect(termPresentationState({ starts_on: '2026-09-01', ends_on: '2026-12-31' }, '2026-09-25')).toBe('current')
    expect(termPresentationState({ starts_on: '2026-12-01', ends_on: '2026-12-31' }, '2026-09-25')).toBe('upcoming')
  })
})
