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

  const today = new Date().toISOString().slice(0, 10)

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

  useEffect(() => {
    refreshQueue()

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
  }, [refreshQueue, refetch])

  async function flushQueue() {
    const punches = await getPendingPunches()
    for (const punch of punches) {
      try {
        if (punch.type === 'check-in') await attendanceApi.checkIn(punch.payload)
        else await attendanceApi.checkOut(punch.payload)
        const { deletePunch } = await import('@/lib/db/punchQueue')
        await deletePunch(punch.id)
      } catch (_) {}
    }
    await refreshQueue()
    refetch()
  }

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

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Today</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{timeStr}</p>
          <p className="text-sm text-slate-500">{dateStr}</p>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
          online ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        )}>
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {online ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Check-in/out times */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-400 mb-1">Check In</p>
          <p className="text-lg font-semibold text-slate-900">
            {todayAttendance?.check_in
              ? new Date(todayAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-400 mb-1">Check Out</p>
          <p className="text-lg font-semibold text-slate-900">
            {todayAttendance?.check_out
              ? new Date(todayAttendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => punch('check-in')}
          disabled={loading || hasCheckedIn}
          className={cn(
            'rounded-xl py-3 text-sm font-semibold transition-colors',
            hasCheckedIn
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700',
            loading && 'opacity-60'
          )}
        >
          {hasCheckedIn ? '✓ Checked In' : 'Check In'}
        </button>
        <button
          onClick={() => punch('check-out')}
          disabled={loading || !hasCheckedIn || hasCheckedOut}
          className={cn(
            'rounded-xl py-3 text-sm font-semibold transition-colors',
            !hasCheckedIn || hasCheckedOut
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-slate-800 text-white hover:bg-slate-900',
            loading && 'opacity-60'
          )}
        >
          {hasCheckedOut ? '✓ Checked Out' : 'Check Out'}
        </button>
      </div>

      {/* Offline queue badge */}
      {queueCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <Clock size={13} />
          {queueCount} punch{queueCount > 1 ? 'es' : ''} queued — will sync when online
        </div>
      )}

      {/* Status message */}
      {message && (
        <div className={cn(
          'mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
          message.type === 'success' && 'bg-green-50 border border-green-200 text-green-700',
          message.type === 'error' && 'bg-red-50 border border-red-200 text-red-600',
          message.type === 'queued' && 'bg-blue-50 border border-blue-200 text-blue-700',
        )}>
          {message.type === 'success' ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
          {message.text}
        </div>
      )}
    </div>
  )
}
