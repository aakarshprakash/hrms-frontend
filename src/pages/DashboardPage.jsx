import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Users, Clock, CalendarDays, FileText,
  UserCheck, AlertCircle, CalendarRange, ArrowRight, Award, Sparkles, PartyPopper, Cake,
} from 'lucide-react'
import { aiApi } from '@/lib/api/users'
import { calendarApi } from '@/lib/api/calendar'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import api from '@/lib/api/axios'
import { cn } from '@/lib/utils'
import PunchWidget from '@/pages/attendance/PunchWidget'
import HrCalendar from '@/components/dashboard/HrCalendar'
import { CelebrationsWidget, UpcomingHolidaysWidget, OnLeaveTodayWidget } from '@/components/dashboard/DashboardWidgets'

function StatCard({ label, value, icon: Icon, color, sub, to }) {
  const inner = (
    <div className={cn(
      'group relative rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all overflow-hidden',
      to && 'cursor-pointer hover:-translate-y-0.5'
    )}>
      {/* Decorative blob */}
      <div className={cn('absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10', color)} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {value === undefined ? <span className="inline-block h-8 w-16 rounded animate-pulse bg-slate-100" /> : value}
          </p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={cn('rounded-xl p-2.5', color)}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      {to && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
          View all <ArrowRight size={12} />
        </div>
      )}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function QuickAction({ to, icon: Icon, label, desc, color }) {
  return (
    <Link to={to}
      className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
      <div className={cn('rounded-xl p-2.5 shrink-0', color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-400 truncate">{desc}</p>
      </div>
      <ArrowRight size={14} className="ml-auto text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
    </Link>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const branches = useAuthStore((s) => s.branches)
  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? null
  const { canManageEmployees, isSuperAdmin, hasRole } = useRole()
  const canSeeInsights = isSuperAdmin || hasRole('branch_admin', 'hr', 'manager')

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', activeBranch?.id],
    queryFn: () => api.get('/dashboard/stats', {
      params: activeBranch ? { branch_id: activeBranch.id } : {},
    }).then((r) => r.data?.data ?? r.data).catch(() => null),
    retry: false,
  })

  const { data: aiData } = useQuery({
    queryKey: ['ai-insights', activeBranch?.id],
    queryFn: () => aiApi.insights({ branch_id: activeBranch?.id || undefined }).then((r) => r.data?.data),
    enabled: canSeeInsights,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
  const topInsights = (aiData?.insights ?? []).slice(0, 3)

  const { data: calendarWidgets } = useQuery({
    queryKey: ['calendar-widgets', activeBranch?.id],
    queryFn: () => calendarApi.events({ branch_id: activeBranch?.id || undefined }).then((r) => r.data?.data),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

  const todaysBirthdays = (calendarWidgets?.upcoming_birthdays ?? []).filter((b) => b.days_away === 0)
  const todaysAnniversaries = (calendarWidgets?.upcoming_anniversaries ?? []).filter((a) => a.days_away === 0)
  const todaysCelebrations = [...todaysBirthdays.map((b) => ({ ...b, kind: 'birthday' })), ...todaysAnniversaries.map((a) => ({ ...a, kind: 'anniversary' }))]

  const today = new Date().toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            {user?.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">{today}</p>
        </div>
        {activeBranch && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {activeBranch.name}
          </span>
        )}
      </div>

      {/* Today's celebrations banner */}
      {todaysCelebrations.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30">
            <PartyPopper size={18} />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {todaysCelebrations.map((c) => (
              <span key={`${c.kind}-${c.employee_id}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm">
                {c.kind === 'birthday' ? <Cake size={13} className="text-pink-500" /> : <Award size={13} className="text-purple-500" />}
                {c.name}
                <span className="font-normal text-slate-400">
                  {c.kind === 'birthday' ? "'s birthday today!" : `'s ${c.years}${c.years === 1 ? 'st' : c.years === 2 ? 'nd' : c.years === 3 ? 'rd' : 'th'} work anniversary!`}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Employees"
          value={stats?.employees_count ?? '—'}
          icon={Users}
          color="bg-blue-500"
          sub="Active headcount"
          to={canManageEmployees ? '/employees' : undefined}
        />
        <StatCard
          label="Present Today"
          value={stats?.present_today ?? '—'}
          icon={UserCheck}
          color="bg-emerald-500"
          sub="Checked in"
          to="/attendance"
        />
        <StatCard
          label="Pending Leaves"
          value={stats?.pending_leaves ?? '—'}
          icon={CalendarDays}
          color="bg-amber-500"
          sub="Awaiting approval"
          to="/leaves"
        />
        <StatCard
          label="On Leave Today"
          value={stats?.on_leave_today ?? '—'}
          icon={AlertCircle}
          color="bg-rose-500"
          sub="Approved absences"
        />
      </div>

      {/* AI insights strip */}
      {canSeeInsights && topInsights.length > 0 && (
        <div className="rounded-2xl border bg-gradient-to-r from-violet-50 to-blue-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 p-1.5 text-white">
                <Sparkles size={14} />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">AI Insights</h2>
            </div>
            <Link to="/insights" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {topInsights.map((ins, i) => (
              <Link key={i} to={ins.link ?? '/insights'}
                className="rounded-xl border bg-white/80 p-3 hover:shadow-sm transition-shadow">
                <p className={cn('text-[10px] font-bold uppercase tracking-wide', {
                  'text-red-500': ins.severity === 'critical',
                  'text-amber-600': ins.severity === 'warning',
                  'text-blue-500': ins.severity === 'info',
                  'text-emerald-600': ins.severity === 'positive',
                })}>{ins.severity}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-800 line-clamp-2">{ins.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Calendar + right-hand widget stack */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Calendar</h2>
          <HrCalendar branchId={activeBranch?.id} />
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Today's Attendance</h2>
            <PunchWidget />
          </div>
          <OnLeaveTodayWidget employees={calendarWidgets?.on_leave_today} />
          <UpcomingHolidaysWidget holidays={calendarWidgets?.upcoming_holidays} />
        </div>
      </div>

      {/* Celebrations + Quick actions */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-1">
          <CelebrationsWidget
            birthdays={calendarWidgets?.upcoming_birthdays}
            anniversaries={calendarWidgets?.upcoming_anniversaries}
          />
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickAction
              to="/leaves/apply"
              icon={CalendarDays}
              label="Apply Leave"
              desc="Submit a new leave request"
              color="bg-blue-500"
            />
            <QuickAction
              to="/attendance/regularizations"
              icon={Clock}
              label="Regularize Attendance"
              desc="Fix missed punch records"
              color="bg-amber-500"
            />
            <QuickAction
              to="/payroll/payslips"
              icon={FileText}
              label="View Payslip"
              desc="Download your salary slip"
              color="bg-emerald-500"
            />
            <QuickAction
              to="/shifts/holidays"
              icon={CalendarRange}
              label="Holiday Calendar"
              desc="Upcoming public holidays"
              color="bg-rose-500"
            />
            <QuickAction
              to="/certificates"
              icon={Award}
              label="Certificates"
              desc="Experience & employment letters"
              color="bg-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
