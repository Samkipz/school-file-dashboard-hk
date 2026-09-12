import { SchoolFilesPage } from '@/components/school-files-page'
export default function MediaFilesPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) { return <SchoolFilesPage searchParams={searchParams} media/> }
