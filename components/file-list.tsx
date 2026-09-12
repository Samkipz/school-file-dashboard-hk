'use client'
import * as React from 'react'
import { FileText } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { updateFileMetadata, deleteMediaFile } from '@/app/actions/media-files'
import type { Asset } from '@/lib/domain/files'
export function FileList({ school, files, canManage, reload }: { school: string; files: Asset[]; canManage: boolean; reload: () => Promise<void> }) {
  const [editing,setEditing] = React.useState<string|null>(null), [busy,setBusy] = React.useState(false), [error,setError] = React.useState('')
  async function run(action: () => Promise<void>) {setBusy(true);setError('');try {await action();await reload();setEditing(null)}catch{setError('The file could not be updated. Check your access and try again.')}finally{setBusy(false)}}
  return <div className="space-y-3">{error && <p role="alert">{error}</p>}{!files.length && <p className="text-muted-foreground">No files yet.</p>}{files.map(f=><div key={f.id} className="rounded-lg border border-border bg-surface p-4 space-y-2">
    <div className="flex items-center gap-3"><FileText className="w-5 h-5 text-primary"/><h3 className="font-semibold break-all">{f.title}</h3></div>
    <p className="text-sm break-all">{f.original_name} · {f.mime_type} · {(f.size/1024).toFixed(1)} KB · {f.category}</p>
    <p className="text-sm text-muted-foreground">Uploaded by {f.uploader} · {new Date(f.uploaded_at).toLocaleString()}</p><p className="break-words">{f.description}</p>
    <div className="flex gap-4 items-center"><a className="underline" href={`/media-files/file/${f.id}?school=${school}`}>Download</a>{/^(image|video)\//.test(f.mime_type) && <a className="underline" target="_blank" rel="noopener noreferrer" href={`/media-files/file/${f.id}?school=${school}&view=1`}>View</a>}
      {canManage && <><Button variant="outline" disabled={busy} onClick={()=>setEditing(editing===f.id ? null : f.id)}>Edit details</Button><Button variant="ghost" disabled={busy} onClick={()=>{if(window.confirm('Archive this file? Its history and stored object will be retained.'))void run(()=>deleteMediaFile(school,f.id))}}>Archive</Button></>}
    </div>
    {editing===f.id && <form className="space-y-2" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void run(()=>updateFileMetadata(school,f.id,String(d.get('title')),String(d.get('description')),String(d.get('category'))))}}>
      <label className="block">Title<Input name="title" defaultValue={f.title} required maxLength={160}/></label><label className="block">Description<Input name="description" defaultValue={f.description??''} maxLength={1000}/></label>
      <label className="block">Category<select name="category" defaultValue={f.category} className="border rounded-md bg-background p-2">{['general','work','certificate','photo','video'].map(c=><option key={c}>{c}</option>)}</select></label><Button disabled={busy}>Save details</Button>
    </form>}
  </div>)}</div>
}
