'use client'
import * as React from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Input } from './ui/input'
import { FolderOpen, Upload } from 'lucide-react'
import { MediaFilesUpload } from './media-files-upload'
import { FileList } from './file-list'
import { getMediaFiles, getMediaFolders, createMediaFolder, updateMediaFolder, deleteMediaFolder } from '@/app/actions/media-files'
import type { Asset, MediaFolder } from '@/lib/domain/files'

export function MediaFilesClient({ school, initialFolders }: { school: string; initialFolders: MediaFolder[] }) {
  const [folders, setFolders] = React.useState(initialFolders)
  const [selected, setSelected] = React.useState<MediaFolder | null>(null)
  const [files, setFiles] = React.useState<Asset[]>([])
  const [upload, setUpload] = React.useState(false)
  const [editing, setEditing] = React.useState<MediaFolder | 'new' | null>(null)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function reload() {
    if (selected) setFiles(await getMediaFiles(school, selected.id))
  }

  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{selected?.name ?? 'School media folders'}</h2>
      <div className="flex gap-2">
        {selected ? <> <Button variant="outline" disabled={busy} onClick={() => { setSelected(null); setFiles([]) }}>Back</Button> <Button onClick={() => setUpload(true)} className="gap-2"><Upload className="w-4 h-4" />Upload media</Button> </> : <Button onClick={() => setEditing('new')}>New folder</Button>}
      </div>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {editing && <form className="space-y-4 rounded-xl border p-5" key={typeof editing === 'string' ? editing : editing.id} onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); setBusy(true); setError(''); try { if (editing === 'new') await createMediaFolder(school, String(d.get('name')), String(d.get('description'))); else await updateMediaFolder(school, editing.id, String(d.get('name')), String(d.get('description'))); setFolders(await getMediaFolders(school)); setEditing(null) } catch { setError('Could not save folder. Check its name and your access.') } finally { setBusy(false) } }}>
      <label className="block space-y-1.5"><span className="font-medium">Folder name</span><Input name="name" required maxLength={160} defaultValue={editing === 'new' ? '' : editing.name} /></label>
      <label className="block space-y-1.5"><span className="font-medium">Description</span><Input name="description" maxLength={1000} defaultValue={editing === 'new' ? '' : editing.description ?? ''} /></label>
      <div className="flex gap-2"><Button type="submit" disabled={busy}>Save folder</Button><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
    </form>}
    <Card className="p-6 sm:p-8 border">{selected ? <div className="space-y-6"><p className="text-muted-foreground">{selected.description}</p><FileList school={school} files={files} canManage reload={reload} /></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {!folders.length && <p className="text-muted-foreground col-span-full text-center py-8">No folders yet. Create a folder to upload school media.</p>}
      {folders.map(f => <div className="rounded-xl border p-5 space-y-4" key={f.id}><button disabled={busy} className="text-left space-y-3 w-full" onClick={async () => { setBusy(true); setError(''); try { setFiles(await getMediaFiles(school, f.id)); setSelected(f) } catch { setError('This folder is unavailable.') } finally { setBusy(false) } }}><FolderOpen className="text-primary" /><p className="font-medium">{f.name}</p><p className="text-sm text-muted-foreground">{f.description}</p></button><div className="flex gap-2 pt-2 border-t"><Button variant="outline" onClick={() => setEditing(f)}>Edit folder</Button><Button variant="ghost" disabled={busy} onClick={async () => { if (!window.confirm('Archive this empty folder?')) return; setBusy(true); setError(''); try { await deleteMediaFolder(school, f.id); setFolders(await getMediaFolders(school)) } catch { setError('Archive the files first. Folders with active or pending uploads cannot be archived.') } finally { setBusy(false) } }}>Archive</Button></div></div>)}
    </div>}</Card>
    {upload && selected && <MediaFilesUpload school={school} target={{ folderId: selected.id }} onClose={() => setUpload(false)} onUploaded={reload} />}
  </div>
}
