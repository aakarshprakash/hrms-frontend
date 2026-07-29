import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Sparkles, AlertTriangle, AlertCircle, Info, PartyPopper, RefreshCw, ArrowRight,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { aiApi } from '@/lib/api/users'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const SEVERITY = {
  critical: { icon: AlertCircle, chip: 'bg-red-50 border-red-200', iconColor: 'text-red-500', label: 'Critical' },
  warning: { icon: AlertTriangle, chip: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-500', label: 'Warning' },
  info: { icon: Info, chip: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-500', label: 'Info' },
  positive: { icon: PartyPopper, chip: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-500', label: 'Good news' },
}

const PIE_COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#dc2626', '#475569']

export default function AiInsightsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['ai-insights', activeBranchId],
    queryFn: () => aiApi.insights({ branch_id: activeBranchId || undefined }).then((r) => r.data?.data),
    staleTime: 1000 * 60 * 5,
  })

  const insights = data?.insights ?? []
  const analytics = data?.analytics ?? {}

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 p-1.5 text-white">
              <Sparkles size={16} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">AI Insights</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Automatic analysis of your workforce data — refreshed on demand.
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />
          {dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
        </button>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Could not load insights. You may not have permission to view this page.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Insight feed */}
          <div className="grid gap-3 lg:grid-cols-2">
            {insights.length === 0 && (
              <div className="lg:col-span-2 rounded-xl border border-dashed p-8 text-center text-sm text-slate-400">
                All clear — no findings right now. Insights appear as attendance, leave and profile data accumulate.
              </div>
            )}
            {insights.map((ins, i) => {
              const meta = SEVERITY[ins.severity] ?? SEVERITY.info
              const Icon = meta.icon
              return (
                <div key={i} className={cn('flex gap-3 rounded-xl border p-4', meta.chip)}>
                  <Icon size={18} className={cn('mt-0.5 shrink-0', meta.iconColor)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{ins.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{ins.detail}</p>
                  </div>
                  {ins.link && (
                    <Link to={ins.link} className="self-center rounded-md p-1.5 text-slate-400 hover:bg-white/70 hover:text-blue-600">
                      <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

          {/* Analytics */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Headcount by Branch" subtitle="Active employees per branch">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.headcount_by_branch ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="value" name="Employees" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Headcount by Department" subtitle="Where your people are">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.headcount_by_department ?? []} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="value" name="Employees" fill="#0d9488" radius={[0, 6, 6, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Attendance Trend" subtitle="Last 14 days">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analytics.attendance_trend ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
                    tickFormatter={(d) => d?.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="present" name="Present" stroke="#16a34a" fill="url(#gPresent)" strokeWidth={2} />
                  <Area type="monotone" dataKey="late" name="Late" stroke="#d97706" fill="none" strokeWidth={2} />
                  <Area type="monotone" dataKey="absent" name="Absent" stroke="#dc2626" fill="none" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Employment Type Mix" subtitle="Full-time vs contract vs interns">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={(analytics.headcount_by_type ?? []).map((d) => ({ ...d, label: d.label?.replace(/_/g, ' ') }))}
                    dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {(analytics.headcount_by_type ?? []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12, textTransform: 'capitalize' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
