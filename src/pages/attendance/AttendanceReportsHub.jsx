import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query'
import {
  FileBarChart2, BarChart3, CalendarDays, Grid3x3, AlarmClock, UserX, Timer, Building, Fingerprint, MapPinOff, FileDown, FileSpreadsheet,
  ExternalLink,
} from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { departmentApi } from '@/lib/api/departments'
import { saveBlob } from '@/lib/api/payroll'
import { useAuthStore } from '@/store/authStore'
import { dateLabel, number } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Select, Input, Table, StatusPill, EmptyState, Pagination, ErrorBanner } from '@/components/ui/kit'
import EmployeePicker from '@/components/ui/EmployeePicker'

/** The report catalogue, grouped the way HR thinks about it. */
const REPORTS = [
  { key: 'summary', icon: BarChart3, group: 'Summaries', hint: 'Days present, absent, on leave and payable — per employee' },
  { key: 'department', icon: Building, group: 'Summaries', hint: 'Attendance % and hours by department' },
  { key: 'muster', icon: Grid3x3, group: 'Registers', hint: 'Employee × day register (up to 31 days)' },
  { key: 'daily', icon: CalendarDays, group: 'Registers', hint: 'Every employee-day with in / out times' },
  { key: 'late_early', icon: AlarmClock, group: 'Exceptions', hint: 'Late arrivals and early exits, in minutes' },
  { key: 'absent', icon: UserX, group: 'Exceptions', hint: 'Absences and missing punches, with streaks' },
  { key: 'overtime', icon: Timer, group: 'Exceptions', hint: 'Overtime worked, claimed and approved' },
  { key: 'punches', icon: Fingerprint, group: 'Punches', hint: 'Every raw punch with source and location' },
  { key: 'location', icon: MapPinOff, group: 'Punches', hint: 'Punches outside the branch geo-fence' },
]
const TITLES = {
  summary: 'Attendance summary', department: 'Department summary', muster: 'Muster roll', daily: 'Daily attendance',
  late_early: 'Late arrivals & early exits', absent: 'Absentees', overtime: 'Overtime', punches: 'Punch log', location: 'Location exceptions',
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function presetRange(key) {
  const t = new Date()
  const d = (y, m, day) => new Date(y, m, day)
  switch (key) {
    case 'today': return [iso(t), iso(t)]
    case 'yesterday': { const y = d(t.getFullYear(), t.getMonth(), t.getDate() - 1); return [iso(y), iso(y)] }
    case 'this_week': { const s = d(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7)); return [iso(s), iso(t)] }
    case 'last_month': return [iso(d(t.getFullYear(), t.getMonth() - 1, 1)), iso(d(t.getFullYear(), t.getMonth(), 0))]
    case 'last_7': return [iso(d(t.getFullYear(), t.getMonth(), t.getDate() - 6)), iso(t)]
    default: return [iso(d(t.getFullYear(), t.getMonth(), 1)), iso(d(t.getFullYear(), t.getMonth() + 1, 0))] // this month
  }
}
const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['this_week', 'This week'], ['last_7', 'Last 7 days'], ['this_month', 'This month'], ['last_month', 'Last month']]

const STATUS_TONE = {
  present: 'green', late: 'amber', half_day: 'amber', absent: 'red', on_leave: 'purple', weekly_off: 'slate', holiday: 'teal', not_marked: 'slate',
  Inside: 'green', Outside: 'red', Exempt: 'amber',
}
const CODE_STYLE = {
  P: 'text-emerald-700', HD: 'bg-amber-50 text-amber-700', A: 'bg-rose-50 font-semibold text-rose-700', L: 'bg-violet-50 text-violet-700',
  WO: 'text-slate-400', H: 'bg-teal-50 text-teal-700', '-': 'text-slate-300',
}

/**
 * Attendance reports: pick a report, set one filter bar (dates, branch,
 * department, employee), read it on screen or export it as Excel / PDF.
 * The URL holds the selection so a report can be bookmarked or shared.
 */
export default function AttendanceReportsHub() {
  const [params, setParams] = useSearchParams()
  const branches = useAuthStore((s) => s.branches)
  const [defaultFrom, defaultTo] = presetRange('this_month')
  const type = TITLES[params.get('type')] ? params.get('type') : 'summary'
  const filters = {
    from: params.get('from') ?? defaultFrom,
    to: params.get('to') ?? defaultTo,
    branch_id: params.get('branch_id') ?? '',
    department_id: params.get('department_id') ?? '',
    employee_id: params.get('employee_id') ?? '',
    status: params.get('status') ?? '',
  }
  const [employee, setEmployee] = useState(() => (filters.employee_id ? { id: filters.employee_id, name: params.get('employee_name') ?? `Employee #${filters.employee_id}` } : null))
  const [page, setPage] = useState(1)

  const update = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
    setPage(1)
  }

  const { data: departments } = useQuery({ queryKey: ['departments-all'], queryFn: () => departmentApi.list({ per_page: 200 }).then((r) => r.data.data ?? r.data) })
  const query = useMemo(() => Object.fromEntries(Object.entries({ ...filters, status: type === 'daily' ? filters.status : '' }).filter(([, v]) => v)), [params, type]) // eslint-disable-line react-hooks/exhaustive-deps
  const { data: report, isLoading, isFetching, error } = useQuery({
    queryKey: ['attendance-report', type, query, page],
    queryFn: () => attendanceApi.report(type, { ...query, page, per_page: 100 }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const exporter = useMutation({
    mutationFn: (format) => attendanceApi.reportExport(type, { ...query, format })
      .then((res) => saveBlob(res.data, `${type.replace('_', '-')}-${query.from}-to-${query.to}.${format}`, format === 'pdf' ? 'application/pdf' : 'text/csv')),
  })

  const activePreset = PRESETS.find(([k]) => { const [f, t] = presetRange(k); return f === filters.from && t === filters.to })?.[0]

  return (
    <div className="space-y-5">
      <PageHeader icon={FileBarChart2} title="Attendance reports" subtitle="One place for every attendance report — any date range, export to Excel or PDF."
        actions={<>
          <Button variant="secondary" icon={FileSpreadsheet} loading={exporter.isPending && exporter.variables === 'csv'} onClick={() => exporter.mutate('csv')}>Excel (CSV)</Button>
          <Button icon={FileDown} loading={exporter.isPending && exporter.variables === 'pdf'} onClick={() => exporter.mutate('pdf')}>PDF</Button>
        </>} />

      <div className="grid gap-5 xl:grid-cols-[250px_minmax(0,1fr)]">
        {/* Report catalogue */}
        <Card padded={false} className="h-fit">
          {['Summaries', 'Registers', 'Exceptions', 'Punches'].map((group) => (
            <div key={group} className="border-b border-slate-100 px-2 py-2 last:border-0">
              <p className="px-2 pb-1 pt-1 text-[12px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
              {REPORTS.filter((r) => r.group === group).map((r) => {
                const Icon = r.icon
                const active = r.key === type
                return (
                  <button key={r.key} type="button" onClick={() => update({ type: r.key })}
                    className={cn('flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors', active ? 'bg-blue-50' : 'hover:bg-slate-50')}>
                    <Icon size={16} className={cn('mt-0.5 shrink-0', active ? 'text-blue-600' : 'text-slate-400')} />
                    <span className="min-w-0">
                      <span className={cn('block text-[14px] font-medium', active ? 'text-blue-700' : 'text-slate-800')}>{TITLES[r.key]}</span>
                      <span className="block text-[12px] leading-snug text-slate-500">{r.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </Card>

        <div className="min-w-0 space-y-4">
          {/* Filter bar */}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESETS.map(([k, label]) => (
                <button key={k} type="button" onClick={() => { const [f, t] = presetRange(k); update({ from: f, to: t }) }}
                  className={cn('rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors',
                    activePreset === k ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}>
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              <label className="text-xs font-medium text-slate-500">From<Input type="date" className="mt-1" value={filters.from} max={filters.to} onChange={(e) => update({ from: e.target.value })} /></label>
              <label className="text-xs font-medium text-slate-500">To<Input type="date" className="mt-1" value={filters.to} min={filters.from} onChange={(e) => update({ to: e.target.value })} /></label>
              <label className="text-xs font-medium text-slate-500">Branch
                <Select className="mt-1" value={filters.branch_id} onChange={(e) => update({ branch_id: e.target.value })}>
                  <option value="">All branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </label>
              <label className="text-xs font-medium text-slate-500">Department
                <Select className="mt-1" value={filters.department_id} onChange={(e) => update({ department_id: e.target.value })}>
                  <option value="">All departments</option>
                  {(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </label>
              <div className="text-xs font-medium text-slate-500">Employee
                <EmployeePicker className="mt-1" value={employee}
                  onChange={(e) => { setEmployee(e); update({ employee_id: e?.id ?? '', employee_name: e?.name ?? '' }) }} />
              </div>
              {type === 'daily' && (
                <label className="text-xs font-medium text-slate-500">Status
                  <Select className="mt-1" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
                    <option value="">Any status</option>
                    {[['present', 'Present (incl. late)'], ['half_day', 'Half day'], ['absent', 'Absent'], ['on_leave', 'On leave'], ['not_marked', 'Not marked'], ['weekly_off', 'Weekly off'], ['holiday', 'Holiday']]
                      .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                </label>
              )}
            </div>
          </Card>

          <ErrorBanner error={error ?? exporter.error} />

          {isLoading || !report ? (
            <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>
          ) : (
            <>
              <Totals report={report} />
              <Card padded={false} className={cn('transition-opacity', isFetching && 'opacity-60')}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3">
                  <p className="text-[16px] font-semibold text-slate-900">{report.title}</p>
                  <p className="text-xs text-slate-500">{dateLabel(report.period.from)} – {dateLabel(report.period.to)} · {report.period.days} day{report.period.days === 1 ? '' : 's'}
                    {report.meta ? ` · ${number(report.meta.total)} rows` : ` · ${report.rows.length} employees`}</p>
                </div>
                {report.layout === 'grid' ? <MusterGrid report={report} /> : <ReportTable report={report} />}
                {report.meta && <div className="px-4 pb-4"><Pagination meta={report.meta} onPage={setPage} /></div>}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const TOTAL_LABELS = {
  summary: [['present', 'Present days'], ['absent', 'Absent days'], ['leave', 'Leave days'], ['payable_days', 'Payable days'], ['attendance_pct', 'Attendance %', '%']],
  department: [['headcount', 'Employees'], ['present', 'Present days'], ['absent', 'Absent days'], ['attendance_pct', 'Attendance %', '%']],
  late_early: [['late_count', 'Late arrivals'], ['late_minutes', 'Late minutes'], ['early_count', 'Early exits'], ['early_minutes', 'Early-exit minutes']],
  absent: [['employees', 'Employees affected'], ['absent_days', 'Absent days'], ['not_marked_days', 'Days not marked']],
  overtime: [['computed_hours', 'OT from punches (hrs)'], ['claimed_hours', 'Claimed (hrs)'], ['approved_hours', 'Approved (hrs)'], ['pending_hours', 'Pending (hrs)']],
  punches: [['punches', 'Punches'], ['outside', 'Outside geo-fence']],
  location: [['punches', 'Punches outside geo-fence']],
}

function Totals({ report }) {
  const items = TOTAL_LABELS[report.type]
  if (!items || !report.totals) return null
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(([key, label, suffix]) => (
        <div key={key} className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{report.totals[key] ?? '—'}{report.totals[key] != null && suffix}</p>
        </div>
      ))}
    </div>
  )
}

function cell(row, col) {
  const v = row[col.key]
  if (v === null || v === undefined || v === '') return <span className="text-slate-300">—</span>
  if (col.type === 'status') return <StatusPill tone={STATUS_TONE[row[col.status_key]] ?? 'slate'} label={v} />
  if (col.type === 'percent') return <span className={cn(v < 75 ? 'text-rose-600' : v < 90 ? 'text-amber-600' : 'text-emerald-700')}>{v}%</span>
  if (col.type === 'date') return <span className="whitespace-nowrap">{dateLabel(v, { day: '2-digit', month: 'short' })}</span>
  if (col.type === 'link' && row[col.href_key]) {
    return <a href={row[col.href_key]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">{v}<ExternalLink size={11} /></a>
  }
  return v
}

function ReportTable({ report }) {
  const columns = report.columns.map((c) => ({
    key: c.key, label: c.label, align: c.align,
    cellClassName: cn(c.emphasis && 'font-semibold text-slate-900', c.key === 'name' && 'whitespace-nowrap font-medium text-slate-900'),
    render: (row) => cell(row, c),
  }))
  const rows = report.rows.map((r, i) => ({ ...r, __key: `${r.employee_id ?? r.department ?? ''}-${r.date ?? r.punched_at ?? ''}-${r.id ?? i}` }))
  return <Table columns={columns} rows={rows} rowKey="__key" empty={<EmptyState icon={FileBarChart2} title="Nothing to report" description="No records match this period and filter." />} />
}

function MusterGrid({ report }) {
  const extra = report.columns.slice(2)
  if (report.rows.length === 0) return <EmptyState icon={Grid3x3} title="No employees" description="No one matches this filter." />
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="sticky left-0 z-10 min-w-[170px] bg-slate-50 px-3 py-2 text-left font-semibold">Employee</th>
              {report.dates.map((d) => {
                const day = new Date(d)
                return (
                  <th key={d} className={cn('min-w-[28px] px-0.5 py-1.5 text-center font-medium', [0, 6].includes(day.getDay()) && 'bg-slate-100')}>
                    <span className="block text-slate-700">{day.getDate()}</span>
                    <span className="block text-[9px] uppercase">{day.toLocaleDateString('en-IN', { weekday: 'narrow' })}</span>
                  </th>
                )
              })}
              {extra.map((c) => <th key={c.key} className="min-w-[38px] px-1 py-2 text-right font-semibold">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.rows.map((row) => (
              <tr key={row.employee_id} className="hover:bg-slate-50/60">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                  <p className="truncate font-medium text-slate-900">{row.name}</p>
                  <p className="text-[11px] text-slate-400">{row.employee_code}</p>
                </td>
                {report.dates.map((d) => {
                  const c = row.cells[d]
                  return <td key={d} className={cn('px-0.5 py-1.5 text-center', CODE_STYLE[c?.code])}>{c?.code}</td>
                })}
                {extra.map((c) => <td key={c.key} className={cn('px-1 py-1.5 text-right tabular-nums', c.emphasis && 'font-semibold text-slate-900')}>{row[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-5 py-3 text-[12px] text-slate-500">
        {Object.entries(report.legend).map(([code, label]) => (
          <span key={code}><span className={cn('mr-1 rounded px-1 font-semibold', CODE_STYLE[code])}>{code}</span>{label}</span>
        ))}
      </div>
    </>
  )
}
