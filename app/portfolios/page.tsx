import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from '@/components/app-layout'
import { PortfoliosClient } from '@/components/portfolios-client'
import { getStudents } from '@/app/actions/portfolios'

export default async function PortfoliosPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  const initialStudents = await getStudents()

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Portfolios</h1>
          <p className="text-muted-foreground mt-2">Manage student portfolios and files</p>
        </div>
        <PortfoliosClient initialStudents={initialStudents} />
      </div>
    </AppLayout>
  )
}
