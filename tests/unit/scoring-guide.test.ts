import { describe, expect, it } from 'vitest'
import { criteriaInput, derivedMaximum, interpretScore, scaleInput, scoreText, scoreUnits, validateOpening, validateScale } from '../../lib/domain/scoring-guide'

const criteria = criteriaInput([{ title: 'Composition', indicators: [{ descriptor: 'Clear', score: '3.25' }, { descriptor: 'Partial', score: '1.10' }, { descriptor: 'Not demonstrated', score: '0' }] }])
const levels = scaleInput([{ code: 'A', descriptor: 'Developing', lower: '0', upper: '1.10' }, { code: 'B', descriptor: 'Secure', lower: '1.11', upper: '3.25' }])
describe('exact scoring guide', () => {
  it('derives criterion, task and assessment maxima using exact hundredths', () => {
    expect(derivedMaximum([{ criteria }, { criteria }])).toEqual({ criteria: [[325], [325]], tasks: [325, 325], total: 650 })
    expect(scoreText(scoreUnits('0.10') + scoreUnits('0.20'))).toBe('0.30')
  })
  it.each(['-1','1.001','NaN','Infinity','1e2',' 1','01','1000000',1,null])('rejects invalid score %s', value => expect(() => scoreUnits(value)).toThrow())
  it('rejects ambiguous equivalent values', () => expect(() => criteriaInput([{ title: 'A', indicators: [{ descriptor: 'A', score: '1' }, { descriptor: 'B', score: '1.00' }] }])).toThrow())
  it('preserves configured ordering', () => expect(criteria[0].indicators.map(i => i.score)).toEqual(['3.25','1.10','0']))
  it('accepts a complete scale and interprets inclusive boundaries', () => {
    expect(() => validateScale(levels, 325)).not.toThrow()
    for (const score of ['0','1.10']) expect(interpretScore(score, levels)?.code).toBe('A')
    for (const score of ['1.11','3.25']) expect(interpretScore(score, levels)?.code).toBe('B')
    expect(interpretScore('3.26', levels)).toBeNull()
  })
  it.each(['1.10','1.12'])('rejects overlaps and gaps at %s', lower => expect(() => validateScale([levels[0], { ...levels[1], lower }], 325)).toThrow())
  it('rejects reversed boundaries and incompatible maximum', () => {
    expect(() => scaleInput([{ descriptor: 'A', lower: '2', upper: '1' }])).toThrow()
    expect(() => validateScale(levels, 400)).toThrow()
  })
  it('allows an optional scale and requires complete positive structure for opening', () => {
    expect(validateOpening([{ criteria }], []).total).toBe(325)
    for (const tasks of [[], [{ criteria: [] }], [{ criteria: [{ title: 'A', description: null, indicators: [] }] }]]) expect(() => validateOpening(tasks, [])).toThrow()
  })
})
