import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sparkles, AlertTriangle, AlertCircle, Info, PartyPopper, RefreshCw, ArrowRight, Building2, Network, TrendingUp, Briefcase } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Legend } from 'recharts'
import { aiApi } from '@/lib/api/users'
import { useAuthStore } from '@/store/authStore'
import { SERIES, GRID, TICK, foldOther } from '@/lib/chart'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { PageHeader, Card, CardHeader, Button, EmptyState, ErrorBanner, ChartTooltip } from '@/components/ui/kit'

const SEVERITY = {
  critical: { icon: AlertCircle, tile: 'bg-rose-50 text-rose-600 ring-rose-200', label: 'Critical' },
  warning: { icon: AlertTriangle, tile: 'bg-amber-50 text-amber-600 ring-amber-200', label: 'Needs attention' },
  info: { icon: Info, tile: 'bg-blue-50 text-blue-600 ring-blue-200', label: 'For your information' },
  positive: { icon: PartyPopper, tile: 'bg-emerald-50 text-emerald-600 ring-emerald-200', label: 'Good news' },
}
const ORDER = ['critical', 'warning', 'info', 'positive']
const shortDay = (d) => new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const legendInk = (v) => <span className="text-slate-600">{v}</span>

/** Labelled share bars — for categories, easier to read than a pie. */
function ShareList({ items }) {
  const rows = foldOther(items.map((i) => ({ ...i, label: String(i.label ?? '').replace(/_/g, ' ') })))
  const total = rows.reduce((n, r) => n + r.value, 0)
  if (!rows.length) return <EmptyState title="No data yet" />
  return (
    <ul className="space-y-3 p-5">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="font-medium capitalize text-slate-700">{r.label}</span>
            <span className="tabular-nums text-slate-900">{r.value} <span className="text-slate-400">· {total ? Math.round((r.value / total) * 100) : 0}%</span></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${total ? (r.value / total) * 100 : 0}%`, backgroundColor: SERIES[i] }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Findings from the workforce data, most urgent first, plus the charts behind them. */
export default function AiInsightsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['ai-insights', activeBranchId],
    queryFn: () => aiApi.insights({ branch_id: activeBranchId || undefined }).then((r) => r.data?.data),
    staleTime: 1000 * 60 * 5,
  })

  const insights = [...(data?.insights ?? [])].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
  const a = data?.analytics ?? {}
  const counts = ORDER.map((k) => [k, insights.filter((i) => i.severity === k).length]).filter(([, n]) => n > 0)

  return (
    <div>
      <PageHeader icon={Sparkles} title="AI insights" subtitle="Patterns spotted in attendance, leave and people data — most urgent first."
        actions={<Button variant="secondary" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
          {dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
        </Button>} />

      <ErrorBanner error={error} className="mb-4" message={error ? 'Couldn’t load insights — you may not have access to this page.' : undefined} />
      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> : !error && (
        <div className="space-y-6">
          <Card padded={false}>
            <CardHeader title="Findings" icon={Sparkles}
              subtitle={insights.length ? counts.map(([k, n]) => `${n} ${SEVERITY[k].label.toLowerCase()}`).join(' · ') : 'Nothing needs attention'} />
            {insights.length === 0 ? (
              <EmptyState icon={PartyPopper} title="All clear" description="Insights appear as attendance, leave and profile data build up." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {insights.map((ins, i) => {
                  const meta = SEVERITY[ins.severity] ?? SEVERITY.info
                  const Icon = meta.icon
                  return (
                    <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', meta.tile)}><Icon size={16} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-900">{ins.title}</p>
                        <p className="mt-0.5 text-[13px] text-slate-600">{ins.detail}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">{meta.label}</p>
                      </div>
                      {ins.link && (
                        <Link to={ins.link} className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
                          View <ArrowRight size={13} />
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Card padded={false}>
              <CardHeader title="Attendance trend" icon={TrendingUp} subtitle="Last 14 days" />
              <div className="h-[260px] px-2 pb-3 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={a.attendance_trend ?? []} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
                    <defs>
                      <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false} tickFormatter={shortDay} minTickGap={16} />
                    <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip labelFormat={shortDay} />} cursor={{ stroke: '#cbd5e1', strokeDasharray: 4 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={legendInk} />
                    <Area type="monotone" dataKey="present" name="Present" stroke="#10b981" fill="url(#gPresent)" strokeWidth={2} isAnimationActive={false} />
                    <Area type="monotone" dataKey="late" name="Late" stroke="#f59e0b" fill="none" strokeWidth={2} isAnimationActive={false} />
                    <Area type="monotone" dataKey="absent" name="Absent" stroke="#e11d48" fill="none" strokeWidth={2} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card padded={false}>
              <CardHeader title="Headcount by branch" icon={Building2} subtitle="Active employees" />
              <div className="h-[260px] px-2 pb-3 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.headcount_by_branch ?? []} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} interval={0} tickFormatter={(l) => (l?.length > 16 ? `${l.slice(0, 15)}…` : l)} />
                    <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="value" name="Employees" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card padded={false}>
              <CardHeader title="Headcount by department" icon={Network} subtitle="Where your people are" />
              <ShareList items={a.headcount_by_department ?? []} />
            </Card>

            <Card padded={false}>
              <CardHeader title="Employment type" icon={Briefcase} subtitle="Full-time, contract and interns" />
              <ShareList items={a.headcount_by_type ?? []} />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
