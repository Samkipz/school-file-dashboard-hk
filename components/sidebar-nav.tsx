'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Home, FolderLock, Users, Layers, LogOut, X } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

export function SidebarNav({ isOpen, onClose, items }: { isOpen: boolean; onClose: () => void; items: { label: string; href: string }[] }) {
  const pathname = usePathname()
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const controls = panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')
        if (!controls?.length) return
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    const desktop = window.matchMedia('(min-width: 1024px)')
    const resized = () => { if (desktop.matches) onClose() }
    desktop.addEventListener('change', resized)
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', handleKey); desktop.removeEventListener('change', resized) }
  }, [isOpen, onClose])
  return <>
    {isOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />}
    <aside id="school-navigation" ref={panel} aria-label="School navigation" className={cn('fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] flex-col border-r bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0', isOpen ? 'flex' : 'hidden')}>
      <div className="flex items-center justify-between border-b p-6"><div><p className="text-2xl font-bold text-primary">SchoolHub</p><p className="mt-1 text-sm text-muted-foreground">Teaching & learning</p></div><button type="button" onClick={onClose} aria-label="Close navigation" className="min-h-11 min-w-11 rounded-lg lg:hidden focus-visible:outline-2 focus-visible:outline-primary"><X className="mx-auto size-5" /></button></div>
      <nav aria-label="Main navigation" className="flex-1 space-y-2 overflow-y-auto p-4">{items.map(item => {
        const path = item.href.split('?')[0]
        const active = pathname === path || (path === '/files' && ['/portfolios', '/media-files'].includes(pathname))
        const Icon = path === '/' ? Home : path === '/academics' ? BookOpen : path === '/files' ? FolderLock : path === '/admin/academics' ? Users : Layers
        return <Link key={path} href={item.href} onClick={() => { if (isOpen) onClose() }} aria-current={active ? 'page' : undefined} className={cn('flex min-h-12 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}><Icon className="size-4 shrink-0" />{item.label}</Link>
      })}</nav>
      <div className="border-t p-4"><button type="button" className="flex min-h-11 w-full items-center gap-3 rounded-lg border px-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary" onClick={async () => { await authClient.signOut(); window.location.href = '/sign-in' }}><LogOut className="size-4" />Log out</button></div>
    </aside>
  </>
}
