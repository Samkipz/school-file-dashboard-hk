import { describe, expect, it } from 'vitest'
import { learnerName, uuidInput } from '../../lib/domain/foundation'

describe('foundation input boundary', () => {
  it('rejects malformed object identifiers', () => {
    for (const value of ['', '../other-school', "' OR TRUE --", '123']) expect(() => uuidInput(value)).toThrow('INVALID_INPUT')
    expect(uuidInput('12345678-1234-4123-8123-123456789012')).toBe('12345678-1234-4123-8123-123456789012')
  })
  it('normalizes names and rejects blank/oversized input', () => {
    expect(learnerName('  Sample Learner  ')).toBe('Sample Learner')
    expect(() => learnerName('   ')).toThrow('INVALID_INPUT')
    expect(() => learnerName('x'.repeat(161))).toThrow('INVALID_INPUT')
  })
})
