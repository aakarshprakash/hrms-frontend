import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, CalendarDays, Clock, Timer, IndianRupee, Inbox } from 'lucide-react'
import { notificationApi } from '@/lib/api/notifications'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'

const ICONS = { leave: CalendarDays, regularization: Clock, overtime: Timer, payslip: IndianRupee }

function ago(iso) {
  const mins = Math.round((new Date() - new Date(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** The bell: unread count, the latest notifications, one click to where they point. */
export default function NotificationBell() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: count } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationApi.unreadCount().then((r) => r.data.data.unread),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: () => notificationApi.list({ per_page: 12 }).then((r) => r.data),
    enabled: open,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notifications-count'] })
  }
  const readAll = useMutation({ mutationFn: notificationApi.markAllRead, onSuccess: refresh })
  const openItem = async (n) => {
    setOpen(false)
    if (!n.read_at) {
      try { await notificationApi.markRead(n.id) } catch { /* not critical */ }
      refresh()
    }
    if (n.link) navigate(n.link)
  }

  const items = data?.data ?? []

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800">
        <Bell size={17} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-900">Notifications</p>
              {count > 0 && (
                <button onClick={() => readAll.mutate()} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {isLoading ? <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
                : items.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <Inbox size={22} className="text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">You’re all caught up</p>
                  </div>
                ) : items.map((n) => {
                  const Icon = ICONS[n.event?.split('.')[0]] ?? Bell
                  return (
                    <button key={n.id} onClick={() => openItem(n)}
                      className={cn('flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50', !n.read_at && 'bg-blue-50/40')}>
                      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.read_at ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600')}>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={cn('text-sm', n.read_at ? 'text-slate-700' : 'font-semibold text-slate-900')}>{n.title}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">{ago(n.created_at)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.body}</span>
                      </span>
                      {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                    </button>
                  )
                })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
