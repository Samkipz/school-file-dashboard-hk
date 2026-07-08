import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { FileUp, FolderPlus, Bell, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-4 items-start pb-4 border-b border-border last:border-0 last:pb-0">
            <Avatar className="w-8 h-8 mt-1">
              <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                {getInitials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getActivityIcon(activity.actionType)}
                <p className="text-sm font-medium text-foreground truncate">{activity.description}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
