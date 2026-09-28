import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Users, UserCheck, Palmtree, Inbox, IndianRupee, ArrowRight, CalendarDays, Clock, Timer, Cake, PartyPopper,
  Sparkles, BarChart3, UserPlus, CheckCircle2, Building2,
} from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from 'recharts'
import api from '@/lib/api/axios'
import { aiApi } from '@/lib/api/users'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { moneyShort, money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SERIES, foldOther } from '@/lib/chart'
import { Card, CardHeader, StatCard, Button, Avatar, EmptyState, ChartTooltip } from '@/components/ui/kit'

const TODAY_SEGMENTS = [
  { key: 'on_time', label: 'On time', color: '#10b981' },
  { key: 'late', label: 'Late', color: '#f59e0b' },
  { key: 'not_in', label: 'Not in yet', color: '#94a3b8' },
  { key: 'on_leave', label: 'On leave', color: '#8b5cf6' },
  { key: 'off', label: 'Weekly off / holiday', color: '#e2e8f0' },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const shortDay = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const weekday = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })

/** The organisation dashboard: today, the trend, people, approvals, pay. */
export default function OrgDashboard() {
  const user = useAuthStore((s) => s.user)
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const branches = useAuthStore((s) => s.branches)
  const { can, hasFeature } = useRole()
  const branch = branches.find((b) => b.id === activeBranchId)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview', activeBranchId],
    queryFn: () => api.get('/dashboard/overview', { params: activeBranchId ? { branch_id: activeBranchId } : {} }).then((r) => r.data.data),
    refetchInterval: 120_000,
  })
  const canInsights = can('insights.view') && hasFeature('insights')
  const { data: insights } = useQuery({
    queryKey: ['ai-insights', activeBranchId],
    queryFn: () => aiApi.insights({ branch_id: activeBranchId || undefined }).then((r) => r.data?.data?.insights ?? []),
    enabled: canInsights,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-slate-500">{today}{branch ? ` · ${branch.name}` : ''}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{greeting()}, {user?.name?.split(' ')[0] ?? 'there'}</h1>
        </div>
        <div className="flex gap-2">
          {can('attendance.view') && <Link to="/attendance/reports"><Button variant="secondary" icon={BarChart3}>Reports</Button></Link>}
          {can('employees.manage') && <Link to="/employees/new"><Button icon={UserPlus}>Add employee</Button></Link>}
        </div>
      </div>

      {isLoading || !data ? <DashboardSkeleton /> : (
        <>
          <Kpis data={data} can={can} />

          {canInsights && insights?.length > 0 && <InsightStrip insights={insights.slice(0, 3)} />}

          <div className="grid gap-6 lg:grid-cols-3">
            <TodayCard today={data.today} />
            <TrendCard trend={data.trend} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <OutTodayCard people={data.out_today} total={data.today.on_leave} />
            {data.approvals ? <ApprovalsCard approvals={data.approvals} /> : <JoinersCard joiners={data.recent_joiners} />}
            <ComingUpCard holidays={data.holidays} celebrations={data.celebrations} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <DepartmentsCard departments={data.by_department} total={data.headcount.active} />
            {data.payroll?.months?.length > 0
              ? <PayrollCard payroll={data.payroll} />
              : <BranchesCard branches={data.by_branch} total={data.headcount.active} />}
            {data.approvals ? <JoinersCard joiners={data.recent_joiners} /> : <BranchesCard branches={data.by_branch} total={data.headcount.active} />}
          </div>
        </>
      )}
    </div>
  )
}

function Kpis({ data, can }) {
  const { headcount, today, approvals, payroll } = data
  const checkedIn = today.on_time + today.late
  const latest = payroll?.latest
  const previous = payroll?.previous
  const costDelta = latest && previous && previous.cost > 0 ? ((latest.cost - previous.cost) / previous.cost) * 100 : null

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Active employees" value={headcount.active} icon={Users} tone="blue" to={can('employees.view') ? '/employees' : undefined}
        trend={headcount.joiners > 0 ? { value: `+${headcount.joiners}`, positive: true, label: 'joined this month' } : undefined}
        hint={headcount.joiners > 0 ? undefined : headcount.exits > 0 ? `${headcount.exits} leaving this month` : 'No change this month'} />
      <StatCard label="Present today" value={today.rate === null ? '—' : `${Math.round(today.rate)}%`} icon={UserCheck} tone="green"
        to={can('attendance.view') ? '/attendance/manage' : undefined} hint={`${checkedIn} of ${today.scheduled} scheduled · ${today.late} late`}>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${today.rate ?? 0}%` }} />
        </div>
      </StatCard>
      <StatCard label="On leave today" value={today.on_leave} icon={Palmtree} tone="purple" to="/leaves" hint={`${today.off} on weekly off / holiday`} />
      {approvals ? (
        <StatCard label="Waiting for you" value={approvals.total} icon={Inbox} tone={approvals.total > 0 ? 'amber' : 'slate'} to="/approvals"
          hint={`${approvals.all_pending} pending across your teams`} />
      ) : (
        <StatCard label="Joined this month" value={headcount.joiners} icon={UserPlus} tone="teal" hint="New employees" />
      )}
      {latest ? (
        <StatCard label={`Payroll cost · ${latest.label}`} value={moneyShort(latest.cost)} icon={IndianRupee} tone="teal" to="/payroll"
          trend={costDelta !== null ? { value: `${Math.abs(costDelta).toFixed(1)}%`, up: costDelta > 0, label: `vs ${previous.label}` } : undefined}
          hint={costDelta === null ? `${latest.employees} employees` : undefined} />
      ) : (
        <StatCard label="Late arrivals today" value={today.late} icon={Clock} tone="amber" hint="After the grace period" />
      )}
    </div>
  )
}

function InsightStrip({ insights }) {
  const tone = { critical: 'text-rose-600 bg-rose-50', warning: 'text-amber-700 bg-amber-50', info: 'text-blue-700 bg-blue-50', positive: 'text-emerald-700 bg-emerald-50' }
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center gap-2.5 md:w-44">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white"><Sparkles size={15} /></div>
          <div>
            <p className="text-[13px] font-semibold text-slate-900">AI insights</p>
            <Link to="/insights" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
        </div>
        <div className="grid flex-1 gap-2 md:grid-cols-3">
          {insights.map((ins, i) => (
            <Link key={i} to={ins.link ?? '/insights'} className="rounded-lg border border-slate-200 px-3 py-2 hover:border-slate-300 hover:bg-slate-50">
              <span className={cn('rounded px-1.5 py-px text-[10px] font-semibold uppercase', tone[ins.severity] ?? tone.info)}>{ins.severity}</span>
              <p className="mt-1 line-clamp-1 text-[13px] font-medium text-slate-800">{ins.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  )
}

function TodayCard({ today }) {
  const segments = TODAY_SEGMENTS.map((s) => ({ ...s, value: today[s.key] })).filter((s) => s.value > 0)
  const total = TODAY_SEGMENTS.reduce((n, s) => n + today[s.key], 0)

  return (
    <Card padded={false}>
      <CardHeader title="Today's attendance" subtitle="By each person's own shift" icon={UserCheck}
        actions={<Link to="/attendance/manage" className="text-xs font-medium text-blue-600 hover:underline">Details</Link>} />
      <div className="flex items-center gap-5 p-5">
        <div className="relative h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={segments.length ? segments : [{ value: 1, color: '#f1f5f9' }]} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={segments.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                {(segments.length ? segments : [{ color: '#f1f5f9' }]).map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{today.rate === null ? '—' : `${Math.round(today.rate)}%`}</p>
            <p className="text-[11px] text-slate-500">present</p>
          </div>
        </div>
        <ul className="flex-1 space-y-2">
          {TODAY_SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-slate-600">{s.label}</span>
              <span className="font-semibold tabular-nums text-slate-900">{today[s.key]}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 border-t border-slate-100 pt-2 text-[13px]">
            <span className="flex-1 text-slate-500">Total</span>
            <span className="font-semibold tabular-nums text-slate-900">{total}</span>
          </li>
        </ul>
      </div>
    </Card>
  )
}

function TrendCard({ trend }) {
  const rows = trend.map((t) => ({ ...t, label: shortDay(t.date) }))
  const avg = (() => {
    const rates = trend.map((t) => t.rate).filter((r) => r !== null)
    return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
  })()

  return (
    <Card padded={false} className="lg:col-span-2">
      <CardHeader title="Attendance, last 14 days" icon={BarChart3}
        subtitle={avg !== null ? `Average ${avg.toFixed(1)}% of scheduled staff present` : 'No attendance recorded yet'}
        actions={<div className="hidden items-center gap-4 text-xs text-slate-500 sm:flex">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />Present</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Late</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />Absent</span>
        </div>} />
      <div className="h-[208px] px-2 pb-3 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 16, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={36} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: 4 }} />
            <Area type="monotone" dataKey="present" name="Present" stroke="#3b82f6" strokeWidth={2} fill="url(#gPresent)" isAnimationActive={false} />
            <Area type="monotone" dataKey="late" name="Late" stroke="#f59e0b" strokeWidth={1.5} fill="transparent" isAnimationActive={false} />
            <Area type="monotone" dataKey="absent" name="Absent" stroke="#fb7185" strokeWidth={1.5} fill="transparent" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function OutTodayCard({ people, total }) {
  return (
    <Card padded={false}>
      <CardHeader title="Who's out today" subtitle={total ? `${total} on leave` : 'Everyone scheduled is expected in'} icon={Palmtree}
        actions={<Link to="/leaves" className="text-xs font-medium text-blue-600 hover:underline">Calendar</Link>} />
      {people.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No one on leave" description="Approved leave for today shows up here." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
              <Avatar name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-800">{p.name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color || '#8b5cf6' }} />
                  {p.type}{p.half_day_session ? ' · half day' : ''}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">Back {weekday(p.back_on)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ApprovalsCard({ approvals }) {
  const rows = [
    { key: 'leave', label: 'Leave requests', icon: CalendarDays, color: 'text-violet-600 bg-violet-50' },
    { key: 'regularization', label: 'Attendance corrections', icon: Clock, color: 'text-blue-600 bg-blue-50' },
    { key: 'overtime', label: 'Overtime claims', icon: Timer, color: 'text-amber-600 bg-amber-50' },
  ]
  return (
    <Card padded={false}>
      <CardHeader title="Waiting for your approval" icon={Inbox}
        subtitle={approvals.total ? `${approvals.total} request${approvals.total === 1 ? '' : 's'} need your decision` : 'You’re all caught up'}
        actions={<Link to="/approvals" className="text-xs font-medium text-blue-600 hover:underline">Open inbox</Link>} />
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => {
          const Icon = r.icon
          return (
            <li key={r.key}>
              <Link to="/approvals" className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', r.color)}><Icon size={15} /></span>
                <span className="flex-1 text-[13px] font-medium text-slate-700">{r.label}</span>
                <span className={cn('min-w-[28px] rounded-full px-2 py-0.5 text-center text-xs font-semibold', approvals[r.key] ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500')}>
                  {approvals[r.key]}
                </span>
                <ArrowRight size={14} className="text-slate-300" />
              </Link>
            </li>
          )
        })}
      </ul>
      {approvals.all_pending > approvals.total && (
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
          {approvals.all_pending - approvals.total} more waiting on other approvers in your teams.
        </p>
      )}
    </Card>
  )
}

function ComingUpCard({ holidays, celebrations }) {
  const items = [
    ...holidays.map((h) => ({ kind: 'holiday', date: h.date, title: h.name, sub: 'Holiday' })),
    ...celebrations.map((c) => ({
      kind: c.kind, date: c.date, title: c.name,
      sub: c.kind === 'birthday' ? 'Birthday' : `${c.years} year${c.years === 1 ? '' : 's'} at work`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)

  const iconFor = { holiday: [CalendarDays, 'bg-teal-50 text-teal-600'], birthday: [Cake, 'bg-pink-50 text-pink-600'], anniversary: [PartyPopper, 'bg-violet-50 text-violet-600'] }

  return (
    <Card padded={false}>
      <CardHeader title="Coming up" subtitle="Holidays, birthdays and work anniversaries" icon={CalendarDays} />
      {items.length === 0 ? <EmptyState title="Nothing in the next two weeks" /> : (
        <ul className="divide-y divide-slate-100">
          {items.map((it, i) => {
            const [Icon, cls] = iconFor[it.kind]
            const d = new Date(it.date + 'T00:00:00')
            return (
              <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', cls)}><Icon size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{it.title}</p>
                  <p className="text-xs text-slate-500">{it.sub}</p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-semibold text-slate-800">{d.getDate()} {d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                  <span className="block text-[11px] text-slate-400">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

const BAR_COLORS = SERIES

function DepartmentsCard({ departments, total }) {
  return (
    <Card padded={false}>
      <CardHeader title="Headcount by department" subtitle={`${total} active employees`} icon={Users}
        actions={<Link to="/employees" className="text-xs font-medium text-blue-600 hover:underline">Directory</Link>} />
      <ul className="space-y-3 p-5">
        {foldOther(departments).map((d, i) => (
          <li key={d.name}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="font-medium text-slate-700">{d.name}</span>
              <span className="tabular-nums text-slate-500">{d.value} <span className="text-slate-400">· {total ? Math.round(d.value / total * 100) : 0}%</span></span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${total ? (d.value / total) * 100 : 0}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function BranchesCard({ branches, total }) {
  return (
    <Card padded={false}>
      <CardHeader title="Headcount by branch" icon={Building2} subtitle={`${branches.length} location${branches.length === 1 ? '' : 's'}`} />
      <ul className="divide-y divide-slate-100">
        {branches.map((b) => (
          <li key={b.name} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
            <span className="flex-1 truncate font-medium text-slate-700">{b.name}</span>
            <span className="w-24 overflow-hidden rounded-full bg-slate-100"><span className="block h-1.5 rounded-full bg-blue-500" style={{ width: `${total ? (b.value / total) * 100 : 0}%` }} /></span>
            <span className="w-8 text-right tabular-nums font-semibold text-slate-900">{b.value}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function PayrollCard({ payroll }) {
  const { months, latest } = payroll
  return (
    <Card padded={false}>
      <CardHeader title="Payroll cost" icon={IndianRupee} subtitle={`${latest.label} ${latest.year} · ${moneyShort(latest.cost)} to company`}
        actions={<Link to="/payroll" className="text-xs font-medium text-blue-600 hover:underline">Summary</Link>} />
      <div className="h-[210px] px-2 pb-3 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 4, right: 12, left: -6, bottom: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => moneyShort(v).replace('₹', '')} width={44} />
            <Tooltip content={<ChartTooltip format={(v) => money(v)} />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="net" name="Net pay" fill="#93c5fd" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="cost" name="Cost to company" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function JoinersCard({ joiners }) {
  return (
    <Card padded={false}>
      <CardHeader title="Recent joiners" icon={UserPlus} />
      {joiners.length === 0 ? <EmptyState title="No one yet" /> : (
        <ul className="divide-y divide-slate-100">
          {joiners.map((j) => (
            <li key={j.id}>
              <Link to={`/employees/${j.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                <Avatar name={j.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{j.name}</p>
                  <p className="truncate text-xs text-slate-500">{[j.designation, j.department].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">{j.date_of_joining ? shortDay(j.date_of_joining) : ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[118px] animate-pulse rounded-xl bg-white ring-1 ring-slate-200/70" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl bg-white ring-1 ring-slate-200/70" />
        <div className="h-64 animate-pulse rounded-xl bg-white ring-1 ring-slate-200/70 lg:col-span-2" />
      </div>
    </div>
  )
}
