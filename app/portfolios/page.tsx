import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { SidebarNav } from '@/components/sidebar-nav'
import { Card } from '@/components/ui/card'

export default async function PortfoliosPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground">Portfolios</h1>
            <p className="text-muted-foreground mt-2">Manage student and school portfolios</p>
          </div>

          <Card className="p-12 text-center bg-card border-border">
            <p className="text-muted-foreground">No portfolios available yet</p>
          </Card>
        </div>
      </main>
    </div>
  )
}
