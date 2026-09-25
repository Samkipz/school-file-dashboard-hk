import type { AdminData, AdminRow } from './administration.ts'

export function isCurrentRecord(row: AdminRow, today: string) {
  return String(row.starts_on) <= today && (!row.ends_on || String(row.ends_on) >= today) && (!row.status || row.status === 'active')
}

export function currentClassRoster(data: AdminData, classId: string) {
  const currentEnrolments = new Set(data.learner_enrolments
    .filter(enrolment => isCurrentRecord(enrolment, data.today))
    .map(enrolment => enrolment.id))
  const activeLearners = new Map(data.learners
    .filter(learner => learner.status === 'active')
    .map(learner => [learner.id, learner]))
  const learnerIds = new Set(data.class_placements
    .filter(placement => placement.class_group_id === classId && isCurrentRecord(placement, data.today) && currentEnrolments.has(String(placement.enrolment_id)))
    .map(placement => data.learner_enrolments.find(enrolment => enrolment.id === placement.enrolment_id)?.learner_id)
    .filter((learnerId): learnerId is string => Boolean(learnerId)))

  return [...learnerIds]
    .map(learnerId => activeLearners.get(learnerId))
    .filter((learner): learner is AdminRow => Boolean(learner))
    .sort((a, b) => `${a.display_name}`.localeCompare(`${b.display_name}`) || a.id.localeCompare(b.id))
}

export function classCoverage(data: AdminData, classId: string) {
  const offerings = data.subject_offerings.filter(offering => offering.class_group_id === classId)
  const offeringIds = new Set(offerings.map(offering => offering.id))
  return {
    offerings: offerings.length,
    activeAssignments: data.teacher_assignments.filter(assignment => offeringIds.has(String(assignment.offering_id)) && assignment.status === 'active').length,
  }
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