import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from '@/components/app-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'

export default async function GeneralPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  return (
    <AppLayout>
      <div className="space-y-6 py-4 sm:py-6">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">General</h1>
          <p className="text-muted-foreground">Community messages and discussions</p>
        </header>
        <Button className="gap-2">
          <MessageSquare className="w-4 h-4" />
          New Message
        </Button>
        <Card className="p-12 text-center border">
          <div className="text-muted-foreground">
            <p className="text-lg font-medium mb-2">No messages yet</p>
            <p className="text-sm">Start a conversation with your team</p>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
