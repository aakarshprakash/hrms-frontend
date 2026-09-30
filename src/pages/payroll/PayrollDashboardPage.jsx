import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { IndianRupee, Wallet, Users, Receipt, Landmark, PlayCircle, Building2, BarChart3 } from 'lucide-react'
import { payrollApi } from '@/lib/api/payroll'
import { useAuthStore } from '@/store/authStore'
import { money, moneyShort, MONTHS_SHORT } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { SERIES } from '@/lib/chart'
import { PageHeader, Card, CardHeader, StatCard, Button, Select, EmptyState, Table, ChartTooltip } from '@/components/ui/kit'

const STATUTORY = [
  { key: 'pf', label: 'Provident fund', hint: 'Employee + employer + EPS', color: SERIES[0] },
  { key: 'esi', label: 'ESI', hint: 'Employee + employer', color: SERIES[1] },
  { key: 'tds', label: 'TDS', hint: 'Income tax withheld', color: SERIES[2] },
  { key: 'pt', label: 'Professional tax', hint: 'State levy', color: SERIES[3] },
]

/** Payroll cost for a year: totals, the monthly run-rate, statutory dues and where the money goes. */
export default function PayrollDashboardPage() {
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['payroll-summary', activeBranch?.id, year],
    queryFn: () => payrollApi.summary({ year, ...(activeBranch ? { branch_id: activeBranch.id } : {}) })
      .then((r) => r.data?.data ?? r.data).catch(() => null),
    retry: false,
  })

  const monthly = (summary?.monthly ?? []).map((m) => ({ ...m, label: MONTHS_SHORT[m.month - 1] }))
  const hasData = monthly.length > 0
  const latest = monthly.at(-1)
  const previous = monthly.at(-2)
  const delta = latest && previous?.employer_cost ? ((latest.employer_cost - previous.employer_cost) / previous.employer_cost) * 100 : null
  const statutoryTotal = STATUTORY.reduce((n, s) => n + (summary?.statutory?.[s.key] ?? 0), 0)
  const departments = summary?.by_department ?? []

  return (
    <div>
      <PageHeader icon={BarChart3} title="Payroll overview"
        subtitle={`What ${activeBranch?.name ?? 'the organisation'} spent on pay in ${year} — processed, finalised and paid runs.`}
        actions={<>
          <Select className="w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Link to="/payroll/runs"><Button icon={PlayCircle}>Payroll runs</Button></Link>
        </>} />

      {isLoading ? <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>
        : !hasData ? (
          <Card>
            <EmptyState icon={Wallet} title={`No processed payroll in ${year}`}
              description="Once a payroll run is processed, its cost, deductions and statutory dues show up here."
              action={<Link to="/payroll/runs"><Button icon={PlayCircle}>Run payroll</Button></Link>} />
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard label="Cost to company" value={moneyShort(summary.employer_cost)} icon={Wallet} tone="blue"
                trend={delta != null ? { value: `${Math.abs(delta).toFixed(1)}%`, up: delta > 0, label: `${latest.label} vs ${previous.label}` } : undefined}
                hint={delta == null ? `${monthly.length} month${monthly.length === 1 ? '' : 's'} in ${year}` : undefined} />
              <StatCard label="Gross pay" value={moneyShort(summary.total_gross)} icon={IndianRupee} tone="purple" hint="Before deductions" />
              <StatCard label="Net paid" value={moneyShort(summary.total_net)} icon={Receipt} tone="green"
                hint={summary.total_gross ? `${Math.round((summary.total_net / summary.total_gross) * 100)}% of gross` : undefined} />
              <StatCard label="Employees paid" value={summary.employees_paid} icon={Users} tone="amber"
                hint={latest ? `${latest.headcount} on the ${latest.label} run` : undefined} />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-3">
              <Card padded={false} className="xl:col-span-2">
                <CardHeader title="Monthly payroll" icon={BarChart3} subtitle="Net pay and deductions make up gross; the line is cost to company." />
                <div className="h-[300px] px-2 pb-3 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthly} margin={{ top: 4, right: 16, left: -4, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => moneyShort(v).replace('₹', '')} width={48} />
                      <Tooltip content={<ChartTooltip format={(v) => money(v)} />} cursor={{ fill: '#f8fafc' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span className="text-slate-600">{v}</span>} />
                      <Bar dataKey="net_pay" name="Net pay" stackId="g" fill="#2a78d6" stroke="#fff" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
                      <Bar dataKey="total_deductions" name="Deductions" stackId="g" fill="#9ec5f4" stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                      <Line dataKey="employer_cost" name="Cost to company" type="monotone" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card padded={false}>
                <CardHeader title="Statutory dues" icon={Landmark} subtitle={`${money(statutoryTotal)} in ${year}`}
                  actions={<Link to="/payroll/compliance" className="text-xs font-medium text-blue-600 hover:underline">Compliance</Link>} />
                {statutoryTotal > 0 && (
                  <div className="mx-5 mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full">
                    {STATUTORY.map((s) => (
                      <span key={s.key} className="first:rounded-l-full last:rounded-r-full" style={{ width: `${((summary.statutory?.[s.key] ?? 0) / statutoryTotal) * 100}%`, backgroundColor: s.color }} />
                    ))}
                  </div>
                )}
                <ul className="divide-y divide-slate-100 px-5 pb-2 pt-3">
                  {STATUTORY.map((s) => (
                    <li key={s.key} className="flex items-center gap-3 py-2.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-800">{s.label}</p>
                        <p className="text-xs text-slate-500">{s.hint}</p>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums text-slate-900">{money(summary.statutory?.[s.key] ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-2">
              <Card padded={false}>
                <CardHeader title="Cost by department" icon={Building2} subtitle="Gross pay for the year" />
                {departments.length === 0 ? <EmptyState title="No department data" /> : (
                  <ul className="space-y-3 p-5">
                    {departments.map((d) => {
                      const share = summary.total_gross ? (d.total_gross / summary.total_gross) * 100 : 0
                      return (
                        <li key={d.name}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                            <span className="truncate font-medium text-slate-700">{d.name}
                              <span className="ml-1.5 font-normal text-slate-400">{d.employee_count} {d.employee_count === 1 ? 'person' : 'people'}</span>
                            </span>
                            <span className="whitespace-nowrap tabular-nums text-slate-900">{money(d.total_gross)} <span className="text-slate-400">· {share.toFixed(0)}%</span></span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${share}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>

              <Card padded={false}>
                <CardHeader title="Month by month" subtitle={`${monthly.length} run${monthly.length === 1 ? '' : 's'} in ${year}`} />
                <Table rows={monthly} rowKey="month"
                  columns={[
                    { key: 'label', label: 'Month', render: (m) => <span className="font-medium text-slate-800">{m.label} {year}</span> },
                    { key: 'headcount', label: 'People', align: 'right' },
                    { key: 'gross', label: 'Gross', align: 'right', render: (m) => money(m.gross_pay) },
                    { key: 'net', label: 'Net', align: 'right', render: (m) => money(m.net_pay) },
                    { key: 'cost', label: 'Cost to company', align: 'right', render: (m) => <span className="font-semibold text-slate-900">{money(m.employer_cost)}</span> },
                  ]} />
              </Card>
            </div>
          </div>
        )}
    </div>
  )
}
