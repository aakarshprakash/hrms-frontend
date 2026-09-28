import { Link } from 'react-router-dom'
import { Sparkles, AlertTriangle, Lock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'

/**
 * For whoever manages billing: trial ending soon, trial ended, or an
 * overdue invoice -- one line, with the way to fix it.
 */
export default function SubscriptionBanner() {
  const subscription = useAuthStore((s) => s.subscription)
  const { can, isPlatformAdmin } = useRole()

  if (!subscription || isPlatformAdmin || !can('billing.manage')) return null

  const { status, trial_days_left: daysLeft, plan_confirmed: confirmed, plan_name: plan } = subscription
  let tone = null
  let icon = Sparkles
  let text = null

  if (status === 'trialing' && !confirmed && daysLeft !== null && daysLeft <= 7) {
    tone = 'bg-blue-600 text-white'
    text = daysLeft === 0 ? `Your ${plan} trial ends today.` : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your ${plan} trial.`
  } else if (status === 'expired') {
    tone = 'bg-slate-800 text-white'
    icon = Lock
    text = 'Your trial has ended — payroll and other modules are paused. Attendance, leave and self-service keep working.'
  } else if (status === 'past_due') {
    tone = 'bg-amber-500 text-amber-950'
    icon = AlertTriangle
    text = 'A subscription invoice is overdue.'
  }

  if (!text) return null
  const Icon = icon

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[13px] font-medium ${tone}`}>
      <Icon size={15} className="shrink-0" />
      <span>{text}</span>
      <Link to="/settings/billing" className="rounded-lg bg-white/20 px-2.5 py-0.5 font-semibold hover:bg-white/30">
        {status === 'past_due' ? 'Pay now' : 'Choose a plan'}
      </Link>
    </div>
  )
}
