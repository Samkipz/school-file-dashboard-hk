'use client'

import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type ResponsiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  presentation?: 'dialog' | 'drawer'
}

export function ResponsiveDialog({ open, onOpenChange, title, description, children, presentation = 'dialog' }: ResponsiveDialogProps) {
  const drawer = presentation === 'drawer'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className={`fixed inset-0 z-50 flex justify-center ${drawer ? 'items-end sm:items-stretch sm:justify-end' : 'items-end sm:items-center sm:p-4'}`}>
          <Dialog.Popup className={`relative w-full overflow-y-auto border border-border bg-background text-foreground shadow-xl outline-none transition duration-200 data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0 ${drawer ? 'max-h-[90dvh] rounded-t-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:h-full sm:max-h-none sm:max-w-2xl sm:rounded-none sm:rounded-l-xl sm:p-7' : 'max-h-[90dvh] rounded-t-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-xl sm:p-6'}`}>
            <header className="mb-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                {description && <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description>}
              </div>
              <Dialog.Close aria-label="Close dialog" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" />
              </Dialog.Close>
            </header>
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}