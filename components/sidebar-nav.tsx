'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, Bell, Layers, Calendar, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Staff Resources',
    href: '/staff-resources',
    icon: Users,
  },
  {
    label: 'Portfolios',
    href: '/portfolios',
    icon: Layers,
  },
  {
    label: 'Calendar',
    href: '/calendar',
    icon: Calendar,
  },
]

export function SidebarNav() {
  const pathname = usePathname()

  const handleLogout = async () => {
    await authClient.signOut()
    window.location.href = '/sign-in'
  }

  return (
    <aside className="w-64 bg-background border-r border-border h-screen flex flex-col sticky top-0">
      {/* Logo/Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold text-primary">SchoolHub</h1>
        <p className="text-sm text-muted-foreground mt-1">File Repository</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3 px-4',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full justify-start gap-3"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </Button>
      </div>
    </aside>
  )
}
