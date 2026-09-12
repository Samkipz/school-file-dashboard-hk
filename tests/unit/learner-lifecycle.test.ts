import { describe, expect, it } from 'vitest'
import { rolloverSelections, validProgression } from '../../lib/domain/learner-lifecycle'

const id = '12345678-1234-4123-8123-123456789012'
describe('rollover selection validation', () => {
  it.each(['null', '{}', '[]', 'invalid', JSON.stringify([{ enrolment_id: id, outcome: 'automatic' }]), JSON.stringify([{ enrolment_id: id, outcome: 'promote', class_group_id: 'foreign' }]), JSON.stringify([{ enrolment_id: id, outcome: 'complete', effective_on: '2026-02-30', reason: 'Finished' }])])('rejects invalid selection %s', raw => expect(() => rolloverSelections(raw)).toThrow('INVALID_INPUT'))
  it('requires explicit distinct selections and caps batch size', () => {
    const selection = { enrolment_id: id, outcome: 'repeat', class_group_id: id }
    expect(rolloverSelections(JSON.stringify([selection]))).toEqual([selection])
    expect(() => rolloverSelections(JSON.stringify([selection, selection]))).toThrow('INVALID_INPUT')
    expect(() => rolloverSelections(JSON.stringify(Array(101).fill(selection)))).toThrow('INVALID_INPUT')
  })
  it('requires a reason for terminal outcomes and canonicalizes submitted fields', () => {
    expect(() => rolloverSelections(JSON.stringify([{ enrolment_id: id, outcome: 'withdraw', effective_on: '2026-06-01', reason: ' ' }]))).toThrow('INVALID_INPUT')
    expect(rolloverSelections(JSON.stringify([{ enrolment_id: id, outcome: 'complete', effective_on: '2026-06-01', reason: ' Finished ', school_id: id }]))[0]).toEqual({ enrolment_id: id, outcome: 'complete', effective_on: '2026-06-01', reason: 'Finished' })
  })
})
describe('grade progression', () => {
  const source = { id: 'g10', curriculum_code: 'DEMO', ordinal: 10 }
  it('allows only the next ordinal in the same curriculum for promotion', () => {
    expect(validProgression(source, { ...source, id: 'g11', ordinal: 11 }, 'promote')).toBe(true)
    expect(validProgression(source, { ...source, id: 'g12', ordinal: 12 }, 'promote')).toBe(false)
    expect(validProgression(source, { ...source, id: 'g11', ordinal: 11, curriculum_code: 'OTHER' }, 'promote')).toBe(false)
    expect(validProgression(source, source, 'promote')).toBe(false)
  })
  it('allows repetition only in the identical grade', () => {
    expect(validProgression(source, source, 'repeat')).toBe(true)
    expect(validProgression(source, { ...source, id: 'other' }, 'repeat')).toBe(false)
  })
})
