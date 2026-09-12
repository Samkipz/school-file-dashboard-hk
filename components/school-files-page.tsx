import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { PortfoliosClient } from '@/components/portfolios-client'
import { MediaFilesClient } from '@/components/media-files-client'
import { foundation,schoolFiles } from '@/lib/domain/server'
import { DomainError } from '@/lib/domain/foundation'
export async function SchoolFilesPage({searchParams,media=false}:{searchParams:Promise<{school?:string}>;media?:boolean}) {
  const data=await (async()=>{try{
    const schools=await foundation.listSchools(),params=await searchParams
    const school=schools.find(s=>s.id===params.school)??(!params.school?schools[0]:undefined)
    if(!school)return {schools,school:null}
    return {schools,school,portfolios:media?null:await schoolFiles.listLearners(school.id),folders:media?await schoolFiles.listFolders(school.id):null}
  }catch(error){if(error instanceof DomainError&&error.code==='UNAUTHORIZED')redirect('/sign-in');if(error instanceof DomainError)return null;throw error}})()
  return <AppLayout><div className="p-4 sm:p-6 lg:p-8 space-y-6"><div><h1 className="text-4xl font-bold">{media?'Media Files':'Portfolios'}</h1><p className="text-muted-foreground mt-2">{media?'Browse and manage private school photos and videos':'Learner portfolios and historical files'}</p></div>
    {!data?<p>This school context is unavailable for your role.</p>:<><nav className="flex gap-4">{data.schools.map(s=><Link className="underline" key={s.id} href={`${media?'/media-files':'/portfolios'}?school=${s.id}`}>{s.name}</Link>)}</nav>{!data.school?<p>No accessible school selected.</p>:<><h2 className="text-xl font-semibold">{data.school.name}</h2>{data.portfolios&&<PortfoliosClient key={data.school.id} school={data.school.id} initialStudents={data.portfolios.learners} canManage={data.portfolios.canManage}/>} {data.folders&&<MediaFilesClient key={data.school.id} school={data.school.id} initialFolders={data.folders}/>}</>}</>}
  </div></AppLayout>
}
