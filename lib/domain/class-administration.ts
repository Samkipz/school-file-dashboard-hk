import type { AdminRow } from './administration.ts'

export const CLASS_ROSTER_PAGE_SIZE = 25
export type ClassRosterMode = 'current' | 'history'
export type ClassRosterLearner = {
  learner_id: string
  display_name: string
  admission_number: string
  learner_status: string
  enrolment_status: string
  placement_starts_on: string
  placement_ends_on: string | null
}
export type ClassRosterPage = {
  mode: ClassRosterMode
  page: number
  pageSize: number
  total: number
  search: string
  learners: ClassRosterLearner[]
}
export type ClassSummary = {
  class_group_id: string
  roster_mode: ClassRosterMode
  learners: number
  offerings: number
  activeAssignments: number
}

export function groupClassesByGrade(classes: AdminRow[]) {
  return classes.reduce<Map<string, AdminRow[]>>((groups, classGroup) => {
    const gradeId = String(classGroup.grade_id)
    const group = groups.get(gradeId) ?? []
    group.push(classGroup)
    groups.set(gradeId, group)
    return groups
  }, new Map())
}