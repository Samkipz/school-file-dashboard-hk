import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface Announcement {
  id: string
  title: string
  content: string
  category: string
  createdAt: Date | string
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  general: { bg: 'bg-blue-100', text: 'text-blue-700' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
  event: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  holiday: { bg: 'bg-purple-100', text: 'text-purple-700' },
  maintenance: { bg: 'bg-orange-100', text: 'text-orange-700' },
}

export function AnnouncementsSection({ announcements }: { announcements: Announcement[] }) {
  if (!announcements || announcements.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Latest Announcements</h2>
        <div className="text-center text-muted-foreground py-8">No announcements yet</div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-card border-border h-fit">
      <h2 className="text-lg font-semibold text-foreground mb-4">Latest Announcements</h2>
      <div className="space-y-4">
        {announcements.map((announcement) => {
          const colors = categoryColors[announcement.category] || categoryColors.general
          return (
            <div
              key={announcement.id}
              className="p-4 bg-accent/50 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                <h3 className="font-medium text-foreground line-clamp-2 text-sm">{announcement.title}</h3>
                <Badge className={`${colors.bg} ${colors.text} flex-shrink-0 text-xs`}>
                  {announcement.category}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{announcement.content}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
