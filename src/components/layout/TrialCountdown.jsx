import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { cn } from '@/lib/utils'

/** The running trial for whoever manages billing, or null. Ticks every minute. */
function useTrial() {
  const subscription = useAuthStore((s) => s.subscription)
  const { can, isPlatformAdmin } = useRole()
  const [now, setNow] = useState(() => Date.now())

  const active = subscription?.status === 'trialing' && subscription.trial_ends_at && !isPlatformAdmin && can('billing.manage')
  useEffect(() => {
    if (!active) return undefined
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [active])

  if (!active) return null
  const end = new Date(subscription.trial_ends_at).getTime()
  const start = subscription.trial_started_at ? new Date(subscription.trial_started_at).getTime() : end - 14 * 86400000
  const left = Math.max(0, end - now)
  return {
    end,
    left,
    days: Math.floor(left / 86400000),
    hours: Math.floor((left % 86400000) / 3600000),
    minutes: Math.floor((left % 3600000) / 60000),
    progress: Math.min(100, Math.max(0, (left / Math.max(1, end - start)) * 100)),
    confirmed: subscription.plan_confirmed,
    plan: subscription.plan_name,
    urgent: left < 3 * 86400000,
  }
}

/** Top bar chip: "Trial · 6d 23h 59m". */
export function TrialChip() {
  const trial = useTrial()
  if (!trial) return null
  return (
    <Link to="/settings/billing" title="Trial time left — open Plan & Billing"
      className={cn('hidden h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-wide ring-1 sm:flex',
        trial.urgent ? 'bg-amber-50 text-amber-700 ring-amber-600/25' : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20')}>
      <Clock size={12} />
      Trial · {trial.days}d {trial.hours}h {trial.minutes}m
    </Link>
  )
}

/** Sidebar card: when the trial ends, time left and a progress bar. */
export function TrialCard() {
  const trial = useTrial()
  if (!trial) return null
  const endLabel = new Date(trial.end).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  return (
    <Link to="/settings/billing"
      className={cn('mx-3 mt-2 block rounded-lg border px-3 py-2.5 transition-colors',
        trial.urgent ? 'border-amber-200 bg-amber-50/70 hover:bg-amber-50' : 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50')}>
      <p className={cn('flex items-center gap-1.5 text-[12px] font-semibold', trial.urgent ? 'text-amber-800' : 'text-emerald-800')}>
        <Clock size={13} className="shrink-0" /> <span className="truncate">Trial ends {endLabel}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-slate-600">
        {trial.days} day{trial.days === 1 ? '' : 's'}, {trial.hours} hour{trial.hours === 1 ? '' : 's'} left
        {trial.confirmed ? ` · ${trial.plan} after trial` : ' · choose a plan'}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
        <div className={cn('h-full rounded-full', trial.urgent ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${trial.progress}%` }} />
      </div>
    </Link>
  )
}
