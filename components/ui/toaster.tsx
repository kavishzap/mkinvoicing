'use client'

import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isDestructive = variant === 'destructive'
        return (
          <Toast key={id} variant={variant} {...props}>
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                isDestructive
                  ? 'bg-white/15 text-white'
                  : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
              )}
              aria-hidden
            >
              {isDestructive ? (
                <AlertCircle className="h-5 w-5" strokeWidth={2} />
              ) : (
                <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
