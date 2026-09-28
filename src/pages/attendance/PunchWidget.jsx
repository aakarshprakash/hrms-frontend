import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Wifi, WifiOff, CheckCircle, AlertCircle } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { enqueuePunch, getPendingPunches, requestBackgroundSync } from '@/lib/db/punchQueue'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({}); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({}),
      { timeout: 5000 }
    )
  })
}

export default function PunchWidget() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [online, setOnline] = useState(navigator.onLine)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // {type: 'success'|'error'|'queued', text}
  const [queueCount, setQueueCount] = useState(0)

  // The local calendar day (toISOString would give the UTC date: yesterday before 05:30 IST).
  const today = new Date().toLocaleDateString('en-CA')

  const { data: todayAttendance, refetch } = useQuery({
    queryKey: ['attendance-today', user?.employee_id],
    queryFn: () =>
      attendanceApi
        .list({ employee_id: user?.employee_id, date: today })
        .then((r) => r.data?.data?.[0] ?? null),
    enabled: !!user?.employee_id,
    refetchInterval: online ? 30000 : false,
  })

  const refreshQueue = useCallback(async () => {
    const punches = await getPendingPunches()
    setQueueCount(punches.length)
  }, [])

  // Sends queued offline punches when Background Sync isn't available.
  const flushQueue = useCallback(async () => {
    const punches = await getPendingPunches()
    for (const punch of punches) {
      try {
        if (punch.type === 'check-in') await attendanceApi.checkIn(punch.payload)
        else await attendanceApi.checkOut(punch.payload)
        const { deletePunch } = await import('@/lib/db/punchQueue')
        await deletePunch(punch.id)
      } catch { /* stays queued for the next attempt */ }
    }
    await refreshQueue()
    refetch()
  }, [refreshQueue, refetch])

  useEffect(() => {
    getPendingPunches().then((p) => setQueueCount(p.length))

    const handleOnline = async () => {
      setOnline(true)
      await requestBackgroundSync()
      // Fallback: if Background Sync isn't supported, retry immediately
      if (!('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype)) {
        await flushQueue()
      }
    }
    const handleOffline = () => setOnline(false)
    const handleSwMessage = (e) => {
      if (e.data?.type === 'PUNCH_SYNCED') {
        refetch()
        refreshQueue()
        setMessage({ type: 'success', text: 'Offline punch synced successfully.' })
        setTimeout(() => setMessage(null), 4000)
      }
      if (e.data?.type === 'GET_AUTH_TOKEN') {
        // SW is asking for the token
        const stored = localStorage.getItem('hrms-auth')
        const token = stored ? JSON.parse(stored)?.state?.token : null
        e.ports?.[0]?.postMessage({ token })
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
    }
  }, [refreshQueue, refetch, flushQueue])

  async function punch(type) {
    setLoading(true)
    setMessage(null)
    try {
      const geo = await getLocation()
      const payload = { ...geo, source: 'web' }

      if (!online) {
        await enqueuePunch(type, payload)
        await requestBackgroundSync()
        await refreshQueue()
        setMessage({ type: 'queued', text: `Punch ${type === 'check-in' ? 'in' : 'out'} saved offline — will sync when connected.` })
      } else {
        try {
          if (type === 'check-in') await attendanceApi.checkIn(payload)
          else await attendanceApi.checkOut(payload)
          refetch()
          qc.invalidateQueries({ queryKey: ['attendance'] })
          setMessage({ type: 'success', text: `Punch ${type === 'check-in' ? 'in' : 'out'} recorded.` })
        } catch (err) {
          const msg = err.response?.data?.message ?? 'Failed to record punch.'
          // If it's a connectivity error, queue it
          if (!err.response) {
            await enqueuePunch(type, payload)
            await requestBackgroundSync()
            await refreshQueue()
            setMessage({ type: 'queued', text: 'Connection lost — punch queued for sync.' })
          } else {
            setMessage({ type: 'error', text: msg })
          }
        }
      }
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const hasCheckedIn = !!todayAttendance?.check_in
  const hasCheckedOut = !!todayAttendance?.check_out
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })

  const inTime = todayAttendance?.check_in ? new Date(todayAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
  const outTime = todayAttendance?.check_out ? new Date(todayAttendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <div className="flex items-start justify-between bg-gradient-to-br from-slate-900 to-blue-900 px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">Today</p>
          <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums">{timeStr}</p>
          <p className="mt-1.5 text-[13px] text-blue-100">{dateStr}</p>
        </div>
        <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
          online ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200')}>
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}{online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
        {[['Check in', inTime], ['Check out', outTime]].map(([label, value]) => (
          <div key={label} className="px-5 py-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={cn('mt-0.5 text-lg font-semibold tabular-nums', value ? 'text-slate-900' : 'text-slate-300')}>{value ?? '--:--'}</p>
          </div>
        ))}
      </div>

      <div className="p-4">
        {hasCheckedOut ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 py-2.5 text-[13px] font-medium text-emerald-700">
            <CheckCircle size={16} /> Done for today
          </div>
        ) : (
          <button onClick={() => punch(hasCheckedIn ? 'check-out' : 'check-in')} disabled={loading}
            className={cn('flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-semibold text-white shadow-xs transition-colors disabled:opacity-60',
              hasCheckedIn ? 'bg-slate-800 hover:bg-slate-900' : 'bg-blue-600 hover:bg-blue-700')}>
            <Clock size={16} />{loading ? 'Recording…' : hasCheckedIn ? 'Check out' : 'Check in'}
          </button>
        )}

        {queueCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <Clock size={13} />
            {queueCount} punch{queueCount > 1 ? 'es' : ''} queued — will sync when online
          </div>
        )}

        {message && (
          <div className={cn('mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
            message.type === 'success' && 'border border-emerald-200 bg-emerald-50 text-emerald-700',
            message.type === 'error' && 'border border-rose-200 bg-rose-50 text-rose-700',
            message.type === 'queued' && 'border border-blue-200 bg-blue-50 text-blue-700')}>
            {message.type === 'success' ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
            {message.text}
          </div>
        )}
      </div>
    </div>
  )
}
