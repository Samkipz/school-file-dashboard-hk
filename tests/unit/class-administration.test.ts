import { describe, expect, it } from 'vitest'
import { classCoverage, currentClassRoster, groupClassesByGrade } from '../../lib/domain/class-administration'
import type { AdminData } from '../../lib/domain/administration'

const baseData = (overrides: Partial<AdminData> = {}) => ({
  today: '2026-06-15',
  learners: [],
  learner_admissions: [],
  learner_enrolments: [],
  class_placements: [],
  learner_subject_enrolments: [],
  academic_years: [],
  terms: [],
  class_groups: [],
  school_subjects: [],
  subject_offerings: [],
  staff_profiles: [],
  teacher_assignments: [],
  grades: [],
  subject_catalogue: [],
  subject_grades: [],
  lifecycle_history: [],
  ...overrides,
}) as AdminData

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

  it('includes only active learners with current enrolment and placement', () => {
    const roster = currentClassRoster(baseData({
      learners: [
        { id: 'learner-1', display_name: 'Current Learner', status: 'active' },
        { id: 'learner-2', display_name: 'Former Learner', status: 'left' },
        { id: 'learner-3', display_name: 'Future Learner', status: 'active' },
        { id: 'learner-4', display_name: 'Old Placement', status: 'active' },
      ] as never,
      learner_enrolments: [
        { id: 'enrolment-1', learner_id: 'learner-1', starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'active' },
        { id: 'enrolment-2', learner_id: 'learner-2', starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'active' },
        { id: 'enrolment-3', learner_id: 'learner-3', starts_on: '2026-07-01', ends_on: '2026-12-31', status: 'active' },
        { id: 'enrolment-4', learner_id: 'learner-4', starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'active' },
      ] as never,
      class_placements: [
        { id: 'placement-1', enrolment_id: 'enrolment-1', class_group_id: 'class-a', starts_on: '2026-01-01', ends_on: '2026-12-31' },
        { id: 'placement-2', enrolment_id: 'enrolment-2', class_group_id: 'class-a', starts_on: '2026-01-01', ends_on: '2026-12-31' },
        { id: 'placement-3', enrolment_id: 'enrolment-3', class_group_id: 'class-a', starts_on: '2026-07-01', ends_on: '2026-12-31' },
        { id: 'placement-4', enrolment_id: 'enrolment-4', class_group_id: 'class-a', starts_on: '2026-01-01', ends_on: '2026-06-14' },
      ] as never,
    }), 'class-a')

    expect(roster.map(learner => learner.display_name)).toEqual(['Current Learner'])
  })

  it('returns an empty roster for a class with no current learners', () => {
    expect(currentClassRoster(baseData(), 'empty-class')).toEqual([])
  })

  it('counts offerings and active assignments only for the selected class', () => {
    const coverage = classCoverage(baseData({
      subject_offerings: [
        { id: 'offering-a', class_group_id: 'class-a' },
        { id: 'offering-b', class_group_id: 'class-a' },
        { id: 'offering-other', class_group_id: 'class-b' },
      ] as never,
      teacher_assignments: [
        { id: 'assignment-a', offering_id: 'offering-a', status: 'active' },
        { id: 'assignment-ended', offering_id: 'offering-b', status: 'ended' },
        { id: 'assignment-other', offering_id: 'offering-other', status: 'active' },
      ] as never,
    }), 'class-a')

    expect(coverage).toEqual({ offerings: 2, activeAssignments: 1 })
  })
})