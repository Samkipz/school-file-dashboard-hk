'use client'

import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FileUp, FolderPlus, Bell, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import * as React from 'react'

interface Activity {
  id: string
  actionType: string
  description: string
  targetId: string | null
  targetType: string | null
  createdAt: Date | string
}

interface User {
  name?: string | null
  email?: string | null
}

const getActivityIcon = (actionType: string) => {
  switch (actionType) {
    case 'file_upload':
      return <FileUp className="w-4 h-4 text-blue-500" />
    case 'folder_create':
      return <FolderPlus className="w-4 h-4 text-emerald-500" />
    case 'announcement_post':
      return <Bell className="w-4 h-4 text-orange-500" />
    default:
      return <MessageSquare className="w-4 h-4 text-purple-500" />
  }
}

export function ActivityFeed({ activities, user }: { activities: Activity[]; user: User | null }) {
  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase()
    if (email) return email.substring(0, 2).toUpperCase()
    return 'U'
  }

  const firstName = user?.name ? user.name.split(' ')[0] : null

  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 4
  const totalPages = Math.max(1, Math.ceil((activities?.length || 0) / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedActivities = (activities || []).slice(startIndex, startIndex + itemsPerPage)

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1)
  }, [currentPage, totalPages])

  if (!activities || activities.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Latest Activity</h2>
        <div className="text-center text-muted-foreground py-8">No activities yet</div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-card border-border h-fit">
      <h2 className="text-lg font-semibold text-foreground mb-4">Latest Activity</h2>
      <div className="space-y-4">
        {paginatedActivities.map((activity) => (
          <div key={activity.id} className="flex gap-4 items-start pb-4 border-b border-border last:border-0 last:pb-0">
            <Avatar className="w-8 h-8 mt-1">
              <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                {getInitials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                {getActivityIcon(activity.actionType)}
                <p className="text-sm font-medium text-foreground truncate">
                  {firstName ? `${firstName} ${activity.description.charAt(0).toLowerCase()}${activity.description.slice(1)}` : activity.description}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  )
}
