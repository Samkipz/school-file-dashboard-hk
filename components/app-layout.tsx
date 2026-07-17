'use client'

import { useState } from 'react'
import { SidebarNav } from '@/components/sidebar-nav'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center p-4 border-b border-border bg-background sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <span className="text-lg font-semibold text-foreground ml-3">SchoolHub</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
