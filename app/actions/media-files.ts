'use server'
import { fileAction } from '@/lib/domain/file-action'
import { schoolFiles } from '@/lib/domain/server'
export async function getMediaFolders(school: string) { return fileAction(() => schoolFiles.listFolders(school)) }
export async function createMediaFolder(school: string, name: string, description: string) { return fileAction(() => schoolFiles.saveFolder(school,name,description)) }
export async function updateMediaFolder(school: string, id: string, name: string, description: string) { return fileAction(() => schoolFiles.saveFolder(school,name,description,id)) }
export async function deleteMediaFolder(school: string, id: string) { return fileAction(() => schoolFiles.archiveFolder(school,id)) }
export async function getMediaFiles(school: string, folderId: string) { return fileAction(() => schoolFiles.list(school,{folderId})) }
export async function uploadMediaFile(school: string, folderId: string, form: FormData) { return fileAction(() => schoolFiles.upload(school,{folderId},form)) }
export async function deleteMediaFile(school: string, id: string) { return fileAction(() => schoolFiles.archive(school,id)) }
export async function updateFileMetadata(school: string, id: string, title: string, description: string, category: string) { return fileAction(() => schoolFiles.update(school,id,title,description,category)) }

