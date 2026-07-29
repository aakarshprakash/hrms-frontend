import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { IndianRupee, TrendingUp, Users, Wallet } from 'lucide-react'
import { payrollApi } from '@/lib/api/payroll'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtMoney(v) {
  const n = Number(v ?? 0)
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

function fmtFull(v) {
  return `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={cn('rounded-xl p-2.5', color)}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-white shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-900 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="text-xs">
          {p.name}: {fmtFull(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function PayrollDashboardPage() {
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())

  const { data: summary, isLoading } = useQuery({
    queryKey: ['payroll-summary', activeBranch?.id, year],
    queryFn: () => payrollApi.summary({
      year,
      ...(activeBranch ? { branch_id: activeBranch.id } : {}),
    }).then((r) => r.data?.data ?? r.data).catch(() => null),
    retry: false,
  })

  const chartData = summary?.monthly ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Payroll Cost Summary</h1>
        <div className="flex items-center gap-3">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Spinner className="h-10 w-10" /></div>
      ) : !summary ? (
        <div className="rounded-2xl border border-dashed py-16 text-center text-sm text-slate-400">
          No payroll data available. Run payroll first.
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Payroll Cost" value={fmtMoney(summary.total_gross)} icon={Wallet} color="bg-blue-500" sub={`Gross pay ${year}`} />
            <StatCard label="Total Net Paid" value={fmtMoney(summary.total_net)} icon={IndianRupee} color="bg-emerald-500" sub="After deductions" />
            <StatCard label="Total Deductions" value={fmtMoney(summary.total_deductions)} icon={TrendingUp} color="bg-amber-500" sub="Tax + statutory" />
            <StatCard label="Employees Paid" value={summary.employees_paid ?? '—'} icon={Users} color="bg-purple-500" sub="Unique employees" />
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border bg-white shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-6">Monthly Payroll Cost</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(m) => MONTHS[m - 1]}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtMoney}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="gross_pay" name="Gross Pay" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net_pay" name="Net Pay" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_deductions" name="Deductions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Department breakdown if available */}
          {summary.by_department?.length > 0 && (
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-900">Cost by Department</h2>
              </div>
              <div className="divide-y">
                {summary.by_department.map((dept) => (
                  <div key={dept.name} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm font-medium text-slate-900">{dept.name}</p>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-slate-500">{dept.employee_count} emp.</span>
                      <span className="font-semibold text-slate-900">{fmtFull(dept.total_gross)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
