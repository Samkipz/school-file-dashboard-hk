'use server'
import { fileAction } from '@/lib/domain/file-action'
import { schoolFiles } from '@/lib/domain/server'
export async function getStudents(school: string) { return fileAction(() => schoolFiles.listLearners(school)) }
export async function getPortfolioFiles(school: string, learnerId: string) { return fileAction(() => schoolFiles.list(school, { learnerId })) }
export async function uploadPortfolioFile(school: string, learnerId: string, form: FormData) { return fileAction(() => schoolFiles.upload(school, { learnerId }, form)) }
export async function deletePortfolioFile(school: string, id: string) { return fileAction(() => schoolFiles.archive(school,id)) }

