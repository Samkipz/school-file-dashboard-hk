import { SchoolFilesPage } from '@/components/school-files-page'
export default function PortfoliosPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) { return <SchoolFilesPage searchParams={searchParams}/> }
