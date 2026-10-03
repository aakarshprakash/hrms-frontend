import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Download, LogIn, TriangleAlert, Users } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi, departmentApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { Button, EmptyState, ErrorBanner, Input, PageHeader, Pagination, Select, StatusPill, Table } from '@/components/ui/kit'
import ReportNav from '@/components/attendance/ReportNav'

const PAGE_SIZE = 50
const duration = (minutes) => minutes == null ? '-' : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
const dateLabel = (date, options) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', options)

function PunchTime({ row, field }) {
  const timestamp = row[`${field}_at`]
  if (!timestamp) return <span className="text-slate-400">-</span>
  const date = timestamp.slice(0, 10)
  return (
    <span title={`${timestamp} (${row.timezone})`} className="inline-block whitespace-nowrap">
      {row[field]}
      {date !== row.date && <span className="mt-0.5 block text-[11px] text-slate-500">{dateLabel(date, { day: 'numeric', month: 'short' })}</span>}
    </span>
  )
}

export default function MonthlyPunchReportPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [monthValue, setMonthValue] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [branchId, setBranchId] = useState(activeBranchId ?? '')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [year, month] = monthValue.split('-').map(Number)
  const filters = { year, month, branch_id: branchId || undefined, department_id: departmentId || undefined }

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? []) })
  const departments = useQuery({
    queryKey: ['departments', branchId],
    queryFn: () => departmentApi.list({ branch_id: branchId || undefined }).then((r) => r.data?.data ?? []),
  })
  const report = useQuery({
    queryKey: ['attendance-monthly-punches', filters],
    queryFn: () => attendanceApi.monthlyPunches(filters).then((r) => r.data?.data ?? []),
  })
  const employees = [...new Map((report.data ?? []).map((row) => [String(row.employee.id), row.employee])).values()]
  const effectiveEmployeeId = employees.some((employee) => String(employee.id) === employeeId) ? employeeId : ''
  const rows = (report.data ?? []).filter((row) => !effectiveEmployeeId || String(row.employee.id) === effectiveEmployeeId)
  const workedMinutes = rows.reduce((total, row) => total + (row.worked_minutes ?? 0), 0)
  const lastPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, lastPage)
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const monthName = dateLabel(`${monthValue}-01`, { month: 'long', year: 'numeric' })
  const metrics = [
    { label: 'Employees', value: effectiveEmployeeId ? 1 : employees.length, icon: Users, color: 'text-blue-600' },
    { label: 'Days with punches', value: rows.filter((row) => row.check_in || row.check_out).length, icon: LogIn, color: 'text-emerald-600' },
    { label: 'Worked hours', value: duration(workedMinutes), icon: Clock, color: 'text-teal-600' },
    { label: 'Incomplete punches', value: rows.filter((row) => Boolean(row.check_in) !== Boolean(row.check_out)).length, icon: TriangleAlert, color: 'text-amber-600' },
  ]

  function changeMonth(value) {
    if (!/^\d{4}-\d{2}$/.test(value) || value < '2000-01' || value > '2100-12') return
    setMonthValue(value)
    setPage(1)
    setExportError(null)
  }

  function shiftMonth(offset) {
    const date = new Date(year, month - 1 + offset, 1)
    changeMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  async function exportCsv() {
    setExporting(true)
    setExportError(null)
    try {
      const res = await attendanceApi.monthlyPunchesExport({ ...filters, employee_id: effectiveEmployeeId || undefined })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }))
      const link = Object.assign(document.createElement('a'), { href: url, download: `attendance-monthly-punches-${monthValue}.csv` })
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setExportError(error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader icon={CalendarClock} title="Monthly punch report"
        actions={<Button variant="secondary" icon={Download} loading={exporting} disabled={!rows.length || report.isFetching || report.isError} onClick={exportCsv}>Export CSV</Button>} />
      <ReportNav />

      <div className="mb-5 grid grid-cols-2 gap-x-5 gap-y-4 border-b border-slate-200 pb-5 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Icon size={15} className={`${color} shrink-0`} />{label}</div>
            <p className="mt-1 break-words text-lg font-semibold tabular-nums text-slate-900">{report.isLoading || report.isError ? '-' : value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="punch-month" className="mb-1 block text-xs font-medium text-slate-600">Month</label>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" icon={ChevronLeft} className="h-9 w-9 p-0" title="Previous month" aria-label="Previous month" disabled={monthValue === '2000-01'} onClick={() => shiftMonth(-1)} />
            <Input id="punch-month" type="month" min="2000-01" max="2100-12" value={monthValue} onChange={(e) => changeMonth(e.target.value)} className="w-44" />
            <Button variant="secondary" size="sm" icon={ChevronRight} className="h-9 w-9 p-0" title="Next month" aria-label="Next month" disabled={monthValue === '2100-12'} onClick={() => shiftMonth(1)} />
          </div>
        </div>
        <div className="w-full sm:w-44">
          <label htmlFor="punch-branch" className="mb-1 block text-xs font-medium text-slate-600">Branch</label>
          <Select id="punch-branch" value={branchId} disabled={branches.isLoading} onChange={(e) => { setBranchId(e.target.value); setDepartmentId(''); setEmployeeId(''); setPage(1) }}>
            <option value="">All branches</option>
            {(branches.data ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <label htmlFor="punch-department" className="mb-1 block text-xs font-medium text-slate-600">Department</label>
          <Select id="punch-department" value={departmentId} disabled={departments.isLoading} onChange={(e) => { setDepartmentId(e.target.value); setEmployeeId(''); setPage(1) }}>
            <option value="">All departments</option>
            {(departments.data ?? []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </Select>
        </div>
        <div className="w-full sm:w-60">
          <label htmlFor="punch-employee" className="mb-1 block text-xs font-medium text-slate-600">Employee</label>
          <Select id="punch-employee" value={effectiveEmployeeId} disabled={report.isLoading} onChange={(e) => { setEmployeeId(e.target.value); setPage(1) }}>
            <option value="">All employees</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.employee_code})</option>)}
          </Select>
        </div>
      </div>

      <ErrorBanner error={report.error ?? branches.error ?? departments.error} className="mb-4" />
      <ErrorBanner error={exportError} message={exportError ? 'Could not export the report. Please try again.' : undefined} className="mb-4" />
      {report.isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> : !report.isError && (
        <>
          <Table className="border-y border-slate-200" rows={visibleRows.map((row) => ({ ...row, key: `${row.employee.id}-${row.date}` }))} rowKey="key"
            empty={<EmptyState icon={CalendarClock} title="No employees for these filters" />}
            columns={[
              { key: 'date', label: 'Date', render: (row) => <span className="whitespace-nowrap">{dateLabel(row.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span> },
              { key: 'employee', label: 'Employee', cellClassName: 'min-w-44', render: (row) => <div><p className="font-medium text-slate-900">{row.employee.name}</p><p className="text-xs text-slate-500">{row.employee.employee_code}</p></div> },
              { key: 'branch', label: 'Branch', render: (row) => row.employee.branch ?? '-' },
              { key: 'check_in', label: 'Punch in', align: 'right', render: (row) => <PunchTime row={row} field="check_in" /> },
              { key: 'check_out', label: 'Punch out', align: 'right', render: (row) => <PunchTime row={row} field="check_out" /> },
              { key: 'hours', label: 'Worked hours', align: 'right', cellClassName: 'whitespace-nowrap font-medium', render: (row) => row.check_in && !row.check_out ? '-' : duration(row.worked_minutes) },
              { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
            ]} />
          {rows.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-[13px] text-slate-600">
            <span>{monthName}</span><span className="font-semibold tabular-nums text-slate-900">Total worked: {duration(workedMinutes)}</span>
          </div>}
          <Pagination meta={{ current_page: currentPage, last_page: lastPage, total: rows.length }} onPage={setPage} />
        </>
      )}
    </div>
  )
}
