'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { SidebarNav } from '@/components/sidebar-nav'
import { academicHref, type School } from '@/lib/academic-navigation'

export function AppShell({ children, schools, school, navigation }: {
  children: React.ReactNode; schools: School[]; school?: School; navigation: { label: string; href: string }[]
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => {
    // Restore focus after React removes inert from the page, not while it is still inert.
    if (wasOpen.current && !open) trigger.current?.focus()
    wasOpen.current = open
  }, [open])
  return <div className="min-h-dvh bg-background lg:flex">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-background focus:p-3">Skip to content</a>
    <SidebarNav isOpen={open} onClose={close} items={navigation} />
    <div className="min-w-0 flex-1" inert={open || undefined}>
      <header className="border-b border-border bg-card px-4 py-3 sm:px-8 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="school-navigation" className="min-h-11 min-w-11 rounded-lg border lg:hidden focus-visible:outline-2 focus-visible:outline-primary"><Menu className="mx-auto size-5" /></button>
          <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">SchoolHub · CBE Management</p><p className="font-semibold break-words">{school?.name ?? 'Choose your school'}</p></div>
          {schools.length > 1 && <details className="relative ml-auto shrink-0"><summary className="cursor-pointer rounded-lg border p-3 text-sm focus-visible:outline-2 focus-visible:outline-primary">Switch school</summary><nav aria-label="Select school" className="absolute right-0 z-20 mt-2 w-64 max-w-[80vw] rounded-xl border bg-card p-2 shadow-lg">{schools.map(s => <Link key={s.id} href={academicHref('/', s.id)} aria-current={school?.id === s.id ? 'page' : undefined} className="block rounded-lg p-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">{s.name}</Link>)}</nav></details>}
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 sm:px-8">{children}</main>
    </div>
  </div>
}
