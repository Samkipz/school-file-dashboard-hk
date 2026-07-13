'use client'

import * as React from 'react'

type Toast = {
  id: string
  message: string
  variant?: 'default' | 'success' | 'error'
}

const TOAST_LIMIT = 3

export function useToast() {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((message: string, variant: Toast['variant'] = 'default') => {
    const id = crypto.randomUUID()
    setToasts((prev) => {
      const next = [{ id, message, variant }, ...prev]
      return next.slice(0, TOAST_LIMIT)
    })
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return { toasts, addToast }
}

export function Toaster({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            rounded-lg border px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2
            ${
              toast.variant === 'error'
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : toast.variant === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                  : 'border-border bg-background text-foreground'
            }
          `}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
