'use client'
import * as React from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Upload } from 'lucide-react'
import { PortfoliosUpload } from './portfolios-upload'
import { FileList } from './file-list'
import { getPortfolioFiles } from '@/app/actions/portfolios'
import type { Asset, PortfolioLearner } from '@/lib/domain/files'
export function PortfoliosClient({school,initialStudents,canManage}:{school:string;initialStudents:PortfolioLearner[];canManage:boolean}) {
  const [selected,setSelected]=React.useState<PortfolioLearner|null>(null),[files,setFiles]=React.useState<Asset[]>([]),[search,setSearch]=React.useState(''),[upload,setUpload]=React.useState(false),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false)
  async function reload(){if(selected)setFiles(await getPortfolioFiles(school,selected.id))}
  return <div className="space-y-6">
    <div className="flex justify-between gap-3"><h2 className="text-lg font-semibold">{selected ? `${selected.display_name}'s Portfolio` : 'Learner Portfolios'}</h2>{selected && <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={()=>{setSelected(null);setFiles([]);setError('')}}>Back</Button>{canManage&&<Button className="gap-2" onClick={()=>setUpload(true)}><Upload className="w-4 h-4"/>Upload File</Button>}</div>}</div>
    {!canManage&&<p className="text-sm text-muted-foreground">Showing learners in your current teaching rosters. File access is read-only.</p>}
    {error&&<p role="alert">{error}</p>}
    <Card className="p-6 sm:p-8 bg-card border-border">
      {selected ? <div className="space-y-4"><div className="flex gap-3 items-center"><Badge>{selected.status==='left'?'Withdrawn':selected.status}</Badge><span>{selected.academic_context ?? 'No academic enrolment'}</span></div><p className="text-sm text-muted-foreground">Portfolio history follows this learner across academic years and re-admission.</p><FileList school={school} files={files} canManage={canManage} reload={reload}/></div> : <div className="space-y-6">
        <Input aria-label="Search learners" placeholder="Search learners…" value={search} onChange={e=>setSearch(e.target.value)}/>
        {!initialStudents.length&&<p>No accessible learners. School administrators manage learner admissions in School Administration.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">{initialStudents.filter(l=>`${l.display_name} ${l.academic_context??''} ${l.status}`.toLowerCase().includes(search.toLowerCase())).map(l=><button key={l.id} disabled={busy} className="rounded-lg border border-border p-4 text-left hover:bg-accent space-y-2" onClick={async()=>{setBusy(true);setError('');try{const result=await getPortfolioFiles(school,l.id);setFiles(result);setSelected(l)}catch{setError('This learner portfolio is unavailable.')}finally{setBusy(false)}}}>
          <Avatar><AvatarFallback>{l.display_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</AvatarFallback></Avatar><p className="font-medium">{l.display_name}</p><p className="text-sm text-muted-foreground">{l.academic_context??'No academic enrolment'}</p><Badge>{l.status==='left'?'Withdrawn':l.status}</Badge>
        </button>)}</div>
      </div>}
    </Card>
    {upload&&selected&&<PortfoliosUpload school={school} target={{learnerId:selected.id}} onClose={()=>setUpload(false)} onUploaded={reload}/>}
  </div>
}
