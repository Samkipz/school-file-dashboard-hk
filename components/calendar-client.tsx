'use client'

import * as React from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, addHours } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Plus, X, ChevronLeft, ChevronRight, MapPin, Clock } from 'lucide-react'
import { createEvent, updateEvent, deleteEvent, getEvents } from '@/app/actions/calendar'
import { Toaster, useToast } from '@/components/ui/toast'

type Event = {
  id: string
  title: string
  description: string | null
  eventDate: Date
  location: string | null
  createdAt: Date
  updatedAt: Date
}

const EVENT_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#6b7280', label: 'Gray' },
]

function toLocalDatetimeString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CalendarClient({ initialEvents }: { initialEvents: Event[] }) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [events, setEvents] = React.useState<Event[]>(initialEvents)
  const [selectedEvent, setSelectedEvent] = React.useState<(Event & { color?: string; endDate?: Date }) | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [editingEvent, setEditingEvent] = React.useState<(Event & { color?: string; endDate?: Date }) | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<(Event & { color?: string }) | null>(null)
  const [loading, setLoading] = React.useState(false)
  const { toasts, addToast } = useToast()

  const [form, setForm] = React.useState({
    title: '',
    description: '',
    eventDate: toLocalDatetimeString(new Date()),
    endDate: toLocalDatetimeString(addHours(new Date(), 1)),
    location: '',
    color: '#3b82f6',
  })

  const loadMonthEvents = React.useCallback(async (year: number, month: number) => {
    setLoading(true)
    try {
      const data = await getEvents(year, month)
      setEvents(data as Event[])
    } catch {
      addToast('Failed to load events', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  React.useEffect(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    loadMonthEvents(year, month)
  }, [currentMonth, loadMonthEvents])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1
  const totalCells = startPad + monthDays.length
  const endPad = (7 - (totalCells % 7)) % 7
  const calendarDays = [
    ...Array(startPad).fill(null),
    ...monthDays,
    ...Array(endPad).fill(null),
  ]

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, (Event & { color?: string })[]>()
    events.forEach((event) => {
      const day = format(parseISO(event.eventDate.toISOString()), 'yyyy-MM-dd')
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(event as Event & { color?: string })
    })
    return map
  }, [events])

  const openCreate = () => {
    setEditingEvent(null)
    setForm({
      title: '',
      description: '',
      eventDate: toLocalDatetimeString(new Date()),
      endDate: toLocalDatetimeString(addHours(new Date(), 1)),
      location: '',
      color: '#3b82f6',
    })
    setIsCreateOpen(true)
  }

  const openEdit = (event: Event & { color?: string; endDate?: Date }) => {
    setEditingEvent(event)
    setForm({
      title: event.title,
      description: event.description || '',
      eventDate: toLocalDatetimeString(event.eventDate),
      endDate: toLocalDatetimeString(event.endDate || addHours(event.eventDate, 1)),
      location: event.location || '',
      color: event.color || '#3b82f6',
    })
    setIsCreateOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingEvent) {
        const updated = await updateEvent(editingEvent.id, {
          title: form.title,
          description: form.description,
          eventDate: new Date(form.eventDate),
          location: form.location,
        })
        setEvents((prev) => prev.map((ev) => (ev.id === updated.id ? updated : ev)))
        addToast('Event updated', 'success')
      } else {
        const created = await createEvent({
          title: form.title,
          description: form.description,
          eventDate: new Date(form.eventDate),
          location: form.location,
        })
        setEvents((prev) => [...prev, created])
        addToast('Event created', 'success')
      }
      setIsCreateOpen(false)
    } catch {
      addToast('Failed to save event', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteEvent(deleteTarget.id)
      setEvents((prev) => prev.filter((ev) => ev.id !== deleteTarget.id))
      setIsDetailOpen(false)
      setSelectedEvent(null)
      setDeleteTarget(null)
      addToast('Event deleted', 'success')
    } catch {
      addToast('Failed to delete event', 'error')
    }
  }

  const handleDayClick = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const dayEvents = eventsByDate.get(dayStr) || []
    if (dayEvents.length === 1) {
      setSelectedEvent({ ...dayEvents[0], color: dayEvents[0].color || '#3b82f6', endDate: addHours(dayEvents[0].eventDate, 1) })
      setIsDetailOpen(true)
    } else if (dayEvents.length > 1) {
      setSelectedEvent(null)
      setIsDetailOpen(true)
    }
  }

  const handleEventClick = (e: React.MouseEvent, event: Event & { color?: string }) => {
    e.stopPropagation()
    setSelectedEvent({ ...event, endDate: addHours(event.eventDate, 1) })
    setIsDetailOpen(true)
  }

  const selectedDayEvents = React.useMemo(() => {
    if (!isDetailOpen || !selectedEvent) return []
    const dayStr = format(parseISO(selectedEvent.eventDate.toISOString()), 'yyyy-MM-dd')
    return eventsByDate.get(dayStr) || []
  }, [isDetailOpen, selectedEvent, eventsByDate])

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-semibold text-foreground min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          New Event
        </Button>
      </div>

      <Card className="p-4 sm:p-6 bg-card border-border">
        <div className="grid grid-cols-7 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
          {calendarDays.map((day, idx) => {
            const isPadding = day === null
            const dayStr = isPadding ? '' : format(day, 'yyyy-MM-dd')
            const dayEvents = isPadding ? [] : (eventsByDate.get(dayStr) || [])
            const today = !isPadding && isToday(day)
            const cellColor = dayEvents.length > 0 ? (dayEvents[0].color || '#3b82f6') : null

            return (
              <button
                key={idx}
                onClick={() => !isPadding && handleDayClick(day)}
                className={`
                  relative min-h-[80px] sm:min-h-[100px] p-1.5 sm:p-2 transition-colors flex flex-col items-start justify-start gap-1
                  ${isPadding ? 'bg-muted/30 cursor-default' : ''}
                  ${cellColor ? `text-white` : 'bg-background hover:bg-accent/50 text-foreground'}
                `}
                style={cellColor ? { backgroundColor: cellColor } : undefined}
              >
                <span
                  className={`
                    text-xs sm:text-sm font-medium inline-flex items-center justify-center size-6 sm:size-7 rounded-full
                    ${today ? 'ring-2 ring-white/50' : ''}
                    ${cellColor ? 'text-white/90' : 'text-foreground'}
                  `}
                >
                  {isPadding ? '' : format(day, 'd')}
                </span>
                <div className="flex flex-col gap-0.5 w-full mt-1">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      onClick={(e) => handleEventClick(e, ev)}
                      className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate cursor-pointer bg-white/15 hover:bg-white/25"
                    >
                      {format(parseISO(ev.eventDate.toISOString()), 'HH:mm')} {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-white/70 px-1">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10 max-h-[90vh] overflow-y-auto">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{editingEvent ? 'Edit Event' : 'New Event'}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingEvent ? 'Update event details' : 'Create a new calendar event'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsCreateOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Event title"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Start</Label>
                  <Input
                    id="eventDate"
                    type="datetime-local"
                    value={form.eventDate}
                    onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Optional location"
                />
              </div>
              <div className="space-y-2">
                <Label>Event Color</Label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                      className={`
                        size-8 rounded-full border-2 transition-all
                        ${form.color === c.value ? 'border-foreground scale-110' : 'border-transparent'}
                      `}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingEvent ? 'Save Changes' : 'Create Event'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Event Details</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setIsDetailOpen(false); setSelectedEvent(null) }}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {selectedEvent ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedEvent.color || '#3b82f6' }} />
                  <h3 className="text-lg font-semibold text-foreground">{selectedEvent.title}</h3>
                </div>

                {selectedEvent.description && (
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      {format(selectedEvent.eventDate, 'MMM d, yyyy HH:mm')} — {format(selectedEvent.endDate || addHours(selectedEvent.eventDate, 1), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <Button variant="outline" onClick={() => { setIsDetailOpen(false); setSelectedEvent(null); openEdit({ ...selectedEvent, endDate: selectedEvent.endDate || addHours(selectedEvent.eventDate, 1) }) }}>
                    Edit
                  </Button>
                  <Button variant="destructive" onClick={() => setDeleteTarget(selectedEvent)}>
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {selectedDayEvents.length === 0 ? 'No events on this day' : `${selectedDayEvents.length} event(s) on this day`}
                </p>
                {selectedDayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent({ ...ev, color: ev.color || '#3b82f6', endDate: addHours(ev.eventDate, 1) })}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color || '#3b82f6' }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(ev.eventDate.toISOString()), 'HH:mm')} — {format(addHours(ev.eventDate, 1), 'HH:mm')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-6 shadow-xl shadow-black/10">
            <h3 className="text-lg font-semibold text-foreground">Delete event?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This will permanently remove "{deleteTarget.title}". This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      <Toaster toasts={toasts} />
    </div>
  )
}
