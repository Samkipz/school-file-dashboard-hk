import { Card } from '@/components/ui/card'
import { Calendar, MapPin } from 'lucide-react'
import { format } from 'date-fns'

interface Event {
  id: string
  title: string
  description?: string | null
  eventDate: Date | string
  endDate?: Date | string
  location?: string | null
  color?: string
  createdAt: Date | string
}

export function EventsSection({ events }: { events: Event[] }) {
  if (!events || events.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming Events</h2>
        <div className="text-center text-muted-foreground py-8">No upcoming events</div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-card border-border h-fit">
      <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming Events</h2>
      <div className="space-y-3">
        {events.map((event) => {
          const eventDate = new Date(event.eventDate)
          const isToday = format(eventDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
          const isSoon = eventDate.getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000

          return (
            <div
              key={event.id}
              className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                isToday
                  ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                  : isSoon
                    ? 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
                    : 'bg-accent/30 border-border hover:bg-accent/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: event.color || '#3b82f6' }} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground text-sm line-clamp-1">{event.title}</h3>
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{format(eventDate, 'MMM d, yyyy HH:mm')}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {event.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{event.description}</p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
