'use client'
import * as React from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Input } from './ui/input'
import { FolderOpen, Upload } from 'lucide-react'
import { MediaFilesUpload } from './media-files-upload'
import { FileList } from './file-list'
import { getMediaFiles,getMediaFolders,createMediaFolder,updateMediaFolder,deleteMediaFolder } from '@/app/actions/media-files'
import type { Asset,MediaFolder } from '@/lib/domain/files'
export function MediaFilesClient({school,initialFolders}:{school:string;initialFolders:MediaFolder[]}) {
  const [folders,setFolders]=React.useState(initialFolders),[selected,setSelected]=React.useState<MediaFolder|null>(null),[files,setFiles]=React.useState<Asset[]>([]),[upload,setUpload]=React.useState(false),[editing,setEditing]=React.useState<MediaFolder|'new'|null>(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false)
  async function reload(){if(selected)setFiles(await getMediaFiles(school,selected.id))}
  return <div className="space-y-6"><div className="flex justify-between gap-3"><h2 className="text-lg font-semibold">{selected?.name??'School media folders'}</h2><div className="flex gap-2">{selected?<><Button variant="outline" disabled={busy} onClick={()=>{setSelected(null);setFiles([])}}>Back</Button><Button onClick={()=>setUpload(true)} className="gap-2"><Upload className="w-4 h-4"/>Upload media</Button></>:<Button onClick={()=>setEditing('new')}>New folder</Button>}</div></div>
    {error&&<p role="alert">{error}</p>}
    {editing&&<form className="space-y-3 rounded-lg border p-4" key={typeof editing==='string'?editing:editing.id} onSubmit={async e=>{e.preventDefault();const d=new FormData(e.currentTarget);setBusy(true);setError('');try{if(editing==='new')await createMediaFolder(school,String(d.get('name')),String(d.get('description')));else await updateMediaFolder(school,editing.id,String(d.get('name')),String(d.get('description')));setFolders(await getMediaFolders(school));setEditing(null)}catch{setError('Could not save folder. Check its name and your access.')}finally{setBusy(false)}}}>
      <label className="block">Folder name<Input name="name" required maxLength={160} defaultValue={editing==='new'?'':editing.name}/></label><label className="block">Description<Input name="description" maxLength={1000} defaultValue={editing==='new'?'':editing.description??''}/></label><Button disabled={busy}>Save folder</Button><Button type="button" variant="ghost" onClick={()=>setEditing(null)}>Cancel</Button>
    </form>}
    <Card className="p-6 sm:p-8 bg-card border-border">{selected?<div className="space-y-4"><p>{selected.description}</p><FileList school={school} files={files} canManage reload={reload}/></div>:<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {!folders.length&&<p>No folders yet. Create a folder to upload school media.</p>}{folders.map(f=><div className="border rounded-lg p-4 space-y-3" key={f.id}><button disabled={busy} className="text-left space-y-2 w-full" onClick={async()=>{setBusy(true);setError('');try{setFiles(await getMediaFiles(school,f.id));setSelected(f)}catch{setError('This folder is unavailable.')}finally{setBusy(false)}}}><FolderOpen className="text-primary"/><p className="font-medium">{f.name}</p><p className="text-sm text-muted-foreground">{f.description}</p></button><div className="flex gap-2"><Button variant="outline" onClick={()=>setEditing(f)}>Edit folder</Button><Button variant="ghost" disabled={busy} onClick={async()=>{if(!window.confirm('Archive this empty folder?'))return;setBusy(true);setError('');try{await deleteMediaFolder(school,f.id);setFolders(await getMediaFolders(school))}catch{setError('Archive the files first. Folders with active or pending uploads cannot be archived.')}finally{setBusy(false)}}}>Archive</Button></div></div>)}
    </div>}</Card>{upload&&selected&&<MediaFilesUpload school={school} target={{folderId:selected.id}} onClose={()=>setUpload(false)} onUploaded={reload}/>}
  </div>
}
