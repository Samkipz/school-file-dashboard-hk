import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { SidebarNav } from '@/components/sidebar-nav'
import { PortfoliosClient } from '@/components/portfolios-client'
import { getStudents } from '@/app/actions/portfolios'

export default async function PortfoliosPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  const initialStudents = await getStudents()

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground">Portfolios</h1>
            <p className="text-muted-foreground mt-2">Manage student portfolios and files</p>
          </div>
          <PortfoliosClient initialStudents={initialStudents} />
        </div>
      </main>
    </div>
  )
}
