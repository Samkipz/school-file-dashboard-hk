import { AssessmentRoster, LearnerAssessment } from '@/components/learner-assessment'
import Link from 'next/link'
import { AppLayout } from '@/components/app-layout'
import { AcademicPeriod, SchoolContextState, TeachingCards, workspaceLink } from '@/components/academic-workspace'
import { loadSchoolContext } from '@/lib/academic-context'
import { academicHref, currentPeriodLabel } from '@/lib/academic-navigation'
import { TeacherAssessments } from '@/components/teacher-assessment-preparation'
import { foundation, assessments, learnerAssessments } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'

type Params = { school?: string; offering?: string; view?: string; draft?: string; assessment?: string; learner?: string; prepare?: string }
export default async function AcademicsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const loaded = await loadSchoolContext(params.school)
  const { school, context } = loaded
  if (!school || !context) return <AppLayout school={params.school}><div className="py-4 sm:py-6"><SchoolContextState loaded={loaded} /></div></AppLayout>
  if (!params.offering && params.offering !== '') return <AppLayout school={school.id}><div className="space-y-6 py-4 sm:py-6">
    <header className="space-y-2"><h1 className="text-3xl font-bold">My Teaching</h1><p className="text-muted-foreground">Open a subject to see your class and learners.</p></header>
    <AcademicPeriod context={context} />
    {context.canTeach ? <TeachingCards school={school.id} terms={context.terms} /> : <div className="rounded-xl border bg-card p-6"><p className="text-muted-foreground">You do not have a teacher role in this school. {context.canManage && <Link href={academicHref('/admin/academics', school.id)} className="underline font-medium">Open School Administration</Link>}</p></div>}
  </div></AppLayout>
  const workspace = await (async () => {
    try {
      if (params.view !== undefined && !['overview', 'learners', 'assessments'].includes(params.view)) throw new DomainError('INVALID_INPUT')
      const data = await foundation.getFoundation(school.id, 'assigned')
      const offering = data.offerings.find(o => o.id === params.offering)
      if (!offering) throw new DomainError('NOT_FOUND')
      const roster = params.assessment ? [] : await foundation.getOfferingRoster(school.id, offering.id)
      const assessmentData = params.view === 'assessments' && !params.assessment ? await assessments.readOffering(school.id, offering.id) : null
      const selected = params.draft ? assessmentData?.drafts.find(d => d.id === params.draft) : undefined
      if (params.draft && !selected) throw new DomainError('NOT_FOUND')
      if (params.learner && !params.assessment) throw new DomainError('INVALID_INPUT')
      const resultRoster = params.assessment && !params.learner ? await learnerAssessments.roster(school.id, params.assessment) : null
      const learnerData = params.assessment && params.learner ? await learnerAssessments.get(school.id, params.assessment, params.learner) : null
      const resultAssessment = resultRoster?.assessment ?? learnerData?.assessment
      if (resultAssessment && (resultAssessment.offering_id !== offering.id || params.view !== 'assessments')) throw new DomainError('NOT_FOUND')
      return { offering, roster, assessmentData, selected, resultRoster, learnerData }
    } catch (error) {
      if (error instanceof DomainError) return null
      throw error
    }
  })()
  if (!workspace) return <AppLayout school={school.id}><div className="space-y-6 py-4 sm:py-6"><h1 className="text-2xl font-semibold">Teaching workspace unavailable</h1><p role="alert">This offering is unavailable or is not currently assigned to you. Check the school and your current assignments.</p><Link className={`${workspaceLink} border`} href={academicHref('/academics', school.id)}>Back to My Teaching</Link></div></AppLayout>
  const { offering, roster } = workspace
  const view = params.view ?? 'overview'
  const preparing = view === 'assessments' && !!workspace.assessmentData && (!!workspace.selected || params.prepare === 'new')
  const resultAssessment = workspace.resultRoster?.assessment ?? workspace.learnerData?.assessment
  const term = resultAssessment ? resultAssessment.term_code ?? 'No assessment term configured' : currentPeriodLabel(context.terms.filter(t => t.academic_year_id === offering.academic_year_id), 'term')
  return <AppLayout school={school.id}><div className={preparing ? "max-w-4xl space-y-2 py-4 sm:py-6" : "space-y-6 py-4 sm:py-6"}>
    <header className="space-y-1">
      <h1 className="break-words text-sm font-normal leading-6 text-muted-foreground">{offering.subject} · {offering.class_name} · {offering.year} · {term}</h1>
      {!preparing && <nav aria-label="Breadcrumb"><Link href={academicHref('/academics', school.id)} className={`${workspaceLink} -ml-4 text-primary`}>← My Teaching</Link></nav>}
    </header>
    {!preparing && <nav aria-label="Subject workspace" className="flex flex-wrap gap-2 border-b pb-3">{['overview', 'learners', 'assessments'].map(tab => <Link key={tab} href={academicHref('/academics', school.id, offering.id, tab)} aria-current={view === tab ? 'page' : undefined} className={`${workspaceLink} ${view === tab ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{tab === 'overview' ? 'Overview' : tab === 'learners' ? 'Learners' : 'Assessments'}</Link>)}</nav>}
    {workspace.learnerData ? <LearnerAssessment key={workspace.learnerData.learner.id + ':' + (workspace.learnerData.participation?.row_version ?? 0)} school={school.id} data={workspace.learnerData} /> : workspace.resultRoster ? <AssessmentRoster school={school.id} data={workspace.resultRoster} /> : view === 'assessments' && workspace.assessmentData ? <TeacherAssessments key={`${school.id}:${offering.id}`} creating={params.prepare === 'new'} school={school.id} offeringId={offering.id} data={workspace.assessmentData} selected={workspace.selected} /> : view === 'overview' ? <section className="space-y-8">
      <h2 className="text-xl font-semibold">Subject overview</h2>
      <div className="rounded-xl border bg-card p-6"><h3 className="text-lg font-semibold">{roster.length} current {roster.length === 1 ? 'learner' : 'learners'}</h3><p className="mt-2 text-sm text-muted-foreground">Learners currently enrolled in this subject and class.</p><Link className={`${workspaceLink} mt-4 border`} href={academicHref('/academics', school.id, offering.id, 'learners')}>View learners</Link></div>
    </section> : <section aria-labelledby="roster-title" className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="roster-title" className="text-xl font-semibold">Learners</h2><p className="text-sm text-muted-foreground">{roster.length} current {roster.length === 1 ? 'learner' : 'learners'}</p></div>
      {roster.length ? <ul className="divide-y rounded-xl border bg-card">{roster.map(learner => <li key={learner.id} className="break-words px-5 py-4 font-medium">{learner.display_name}</li>)}</ul> : <p className="rounded-xl border border-dashed bg-card p-6">No current learners are enrolled in this offering. Contact your administrator if this is unexpected.</p>}
    </section>}
  </div></AppLayout>
}
