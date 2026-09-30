import { describe, expect, it } from 'vitest'
import { groupClassesByGrade } from '../../lib/domain/class-administration'

describe('class administration view model', () => {
  it('groups classes by their persisted grade', () => {
    const groups = groupClassesByGrade([
      { id: 'east', grade_id: 'grade-10' },
      { id: 'west', grade_id: 'grade-10' },
      { id: 'senior', grade_id: 'grade-11' },
    ] as never)

    expect([...groups.entries()]).toEqual([
      ['grade-10', [{ id: 'east', grade_id: 'grade-10' }, { id: 'west', grade_id: 'grade-10' }]],
      ['grade-11', [{ id: 'senior', grade_id: 'grade-11' }]],
    ])
  })

})