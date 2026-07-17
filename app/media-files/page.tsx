import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { AppLayout } from '@/components/app-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

export default async function MediaFilesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Media Files</h1>
          <p className="text-muted-foreground mt-2">Browse and manage school media and images</p>
        </div>

        <Button className="gap-2 mb-6">
          <Upload className="w-4 h-4" />
          Upload Media
        </Button>

        <Card className="p-12 text-center bg-card border-border">
          <div className="text-muted-foreground">
            <p className="text-lg font-medium mb-2">No media files yet</p>
            <p className="text-sm">Upload media to get started</p>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
