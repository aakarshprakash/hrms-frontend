import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  isPending = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              danger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600')}>
              <AlertTriangle size={16} />
            </div>
            <h2 className="pt-1.5 font-semibold text-slate-900">{title}</h2>
          </div>
          <button onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-slate-600">{message}</p>
        </div>

        <div className="flex justify-end gap-3 border-t px-5 py-4">
          <button type="button" onClick={onCancel}
            className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending}
            className={cn('flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-60',
              danger ? 'bg-rose-600 shadow-rose-600/25 hover:bg-rose-700' : 'bg-blue-600 shadow-blue-600/25 hover:bg-blue-700')}>
            {isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
