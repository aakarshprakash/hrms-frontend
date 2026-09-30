import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, Users, Clock, XCircle, CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi, departmentApi } from '@/lib/api/departments'
import { employeeApi } from '@/lib/api/employees'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Select, Tabs, Table, StatusPill, StatCard, EmptyState, ErrorBanner } from '@/components/ui/kit'
import ReportNav from '@/components/attendance/ReportNav'

const dash = (v, suffix = '') => (v ? `${v}${suffix}` : <span className="text-slate-300">—</span>)
const day = (d) => new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

function Person({ e }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-slate-900">{e.name}</p>
      <p className="text-xs text-slate-500">{e.employee_code}{e.branch ? ` · ${e.branch}` : ''}</p>
    </div>
  )
}

/** Monthly attendance per employee, or day by day, with CSV export. */
export default function AttendanceReportsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [branchId, setBranchId] = useState(activeBranchId ?? '')
  const [deptId, setDeptId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [tab, setTab] = useState('summary')
  const [exporting, setExporting] = useState(false)
  const { year, month } = cursor
  const shift = (n) => setCursor(({ year: y, month: m }) => { const d = new Date(y, m - 1 + n, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 } })
  const filters = { month, year, branch_id: branchId || undefined, department_id: deptId || undefined }

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? []) })
  const { data: depts = [] } = useQuery({
    queryKey: ['departments', branchId],
    queryFn: () => departmentApi.list({ branch_id: branchId || undefined }).then((r) => r.data?.data ?? []),
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-lite', branchId],
    queryFn: () => employeeApi.list({ branch_id: branchId || undefined, status: 'active', per_page: 200 }).then((r) => r.data?.data ?? []),
    enabled: tab === 'daily',
  })
  const summary = useQuery({
    queryKey: ['attendance-report-summary', filters],
    queryFn: () => attendanceApi.reportSummary(filters).then((r) => r.data?.data ?? []),
    enabled: tab === 'summary',
  })
  const daily = useQuery({
    queryKey: ['attendance-report-daily', filters, employeeId],
    queryFn: () => attendanceApi.reportDaily({ ...filters, employee_id: employeeId || undefined }).then((r) => r.data?.data ?? []),
    enabled: tab === 'daily',
  })
  const current = tab === 'summary' ? summary : daily
  const rows = current.data ?? []

  const totals = tab === 'summary'
    ? rows.reduce((a, r) => ({ late: a.late + r.late_days, absent: a.absent + r.absent_days, leave: a.leave + r.leave_days }), { late: 0, absent: 0, leave: 0 })
    : rows.reduce((a, r) => ({ late: a.late + (r.status === 'late'), absent: a.absent + (r.status === 'absent'), leave: a.leave + (r.status === 'on_leave') }), { late: 0, absent: 0, leave: 0 })

  async function exportCsv() {
    setExporting(true)
    try {
      const res = tab === 'summary'
        ? await attendanceApi.reportSummaryExport(filters)
        : await attendanceApi.reportDailyExport({ ...filters, employee_id: employeeId || undefined })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      Object.assign(document.createElement('a'), { href: url, download: `attendance-${tab}-${year}-${String(month).padStart(2, '0')}.csv` }).click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div>
      <PageHeader icon={BarChart3} title="Attendance reports" subtitle="Summaries, the monthly register and anything that needs a second look."
        actions={<Button variant="secondary" icon={Download} loading={exporting} disabled={!rows.length} onClick={exportCsv}>Export CSV</Button>} />
      <ReportNav />

      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label={tab === 'summary' ? 'Employees' : 'Day records'} value={rows.length} icon={Users} tone="blue" hint={monthName} />
        <StatCard label="Late marks" value={totals.late} icon={Clock} tone="amber" />
        <StatCard label="Absences" value={totals.absent} icon={XCircle} tone="red" />
        <StatCard label="Leave days" value={totals.leave} icon={CalendarOff} tone="purple" />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Tabs variant="pills" value={tab} onChange={setTab} tabs={[{ key: 'summary', label: 'By employee' }, { key: 'daily', label: 'Day by day' }]} />
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => shift(-1)} aria-label="Previous month" />
            <span className="min-w-32 text-center text-[13px] font-semibold text-slate-800">{monthName}</span>
            <Button variant="secondary" size="sm" icon={ChevronRight} onClick={() => shift(1)} aria-label="Next month" />
          </div>
          {branches.length > 1 && (
            <Select className="w-auto min-w-40" value={branchId} onChange={(e) => { setBranchId(e.target.value); setDeptId(''); setEmployeeId('') }}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Select className="w-auto min-w-40" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          {tab === 'daily' && (
            <Select className="w-auto min-w-44" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">All employees</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name ?? `${e.first_name} ${e.last_name}`}</option>)}
            </Select>
          )}
        </div>

        <ErrorBanner error={current.error} className="m-3" message={current.error ? 'Couldn’t load the report — you may not have access to attendance reports.' : undefined} />
        {current.isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
          : tab === 'summary' ? (
            <Table rows={rows.map((r) => ({ ...r, key: r.employee.id }))} rowKey="key" empty={<EmptyState icon={BarChart3} title="No employees for these filters" />}
              columns={[
                { key: 'employee', label: 'Employee', render: (r) => <Person e={r.employee} /> },
                { key: 'dept', label: 'Department', render: (r) => r.employee.department ?? '—' },
                { key: 'present', label: 'Present', align: 'right', render: (r) => <span className="font-semibold text-emerald-700">{r.present_days}</span> },
                { key: 'late', label: 'Late', align: 'right', render: (r) => <span className="text-amber-700">{dash(r.late_days)}</span> },
                { key: 'half', label: 'Half day', align: 'right', render: (r) => dash(r.half_days) },
                { key: 'absent', label: 'Absent', align: 'right', render: (r) => <span className="text-rose-600">{dash(r.absent_days)}</span> },
                { key: 'leave', label: 'Leave', align: 'right', render: (r) => <span className="text-violet-700">{dash(r.leave_days)}</span> },
                { key: 'hol', label: 'Holidays', align: 'right', render: (r) => dash(r.holiday_days) },
                { key: 'hours', label: 'Hours', align: 'right', render: (r) => <span className="font-medium text-slate-900">{r.worked_hours}h</span> },
                { key: 'avgLate', label: 'Avg late', align: 'right', render: (r) => dash(r.avg_late_minutes, 'm') },
              ]}
            />
          ) : (
            <Table rows={rows.map((r) => ({ ...r, key: `${r.employee.id}-${r.date}` }))} rowKey="key"
              empty={<EmptyState icon={BarChart3} title="No attendance records for these filters" />}
              columns={[
                { key: 'employee', label: 'Employee', render: (r) => <Person e={r.employee} /> },
                { key: 'date', label: 'Day', render: (r) => <span className="whitespace-nowrap">{day(r.date)}</span> },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                { key: 'in', label: 'In', align: 'right', render: (r) => r.check_in ?? '—' },
                { key: 'out', label: 'Out', align: 'right', render: (r) => r.check_out ?? '—' },
                { key: 'hours', label: 'Hours', align: 'right', render: (r) => (r.worked_hours != null ? `${r.worked_hours}h` : '—') },
                { key: 'late', label: 'Late by', align: 'right', render: (r) => dash(r.late_by_minutes, 'm') },
              ]} />
          )}
      </Card>
    </div>
  )
}
