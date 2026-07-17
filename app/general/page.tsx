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
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">General</h1>
          <p className="text-muted-foreground mt-2">Community messages and discussions</p>
        </div>

        <Button className="gap-2 mb-6">
          <MessageSquare className="w-4 h-4" />
          New Message
        </Button>

        <Card className="p-12 text-center bg-card border-border">
          <div className="text-muted-foreground">
            <p className="text-lg font-medium mb-2">No messages yet</p>
            <p className="text-sm">Start a conversation with your team</p>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
