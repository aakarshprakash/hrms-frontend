import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Download, Grid3x3, AlertTriangle, Users,
  Clock, XCircle, CalendarOff,
} from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi, departmentApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
          <Icon size={16} className="text-white" />
        </div>
        <div>
          <p className="text-lg font-extrabold text-slate-900">{value}</p>
          <p className="text-[11px] text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

export default function AttendanceReportsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [branchId, setBranchId] = useState(activeBranchId ?? '')
  const [deptId, setDeptId] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data),
  })

  const { data: deptsData } = useQuery({
    queryKey: ['departments', branchId],
    queryFn: () => departmentApi.list({ branch_id: branchId || undefined }).then((r) => r.data?.data ?? r.data ?? []),
  })

  const { data: rows, isLoading, isError } = useQuery({
    queryKey: ['attendance-report-summary', month, year, branchId, deptId],
    queryFn: () => attendanceApi.reportSummary({
      month, year, branch_id: branchId || undefined, department_id: deptId || undefined,
    }).then((r) => r.data?.data ?? []),
  })

  async function handleExport() {
    setExporting(true)
    try {
      const res = await attendanceApi.reportSummaryExport({ month, year, branch_id: branchId || undefined, department_id: deptId || undefined })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance-summary-${year}-${String(month).padStart(2, '0')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const totals = (rows ?? []).reduce((acc, r) => ({
    present: acc.present + r.present_days,
    late: acc.late + r.late_days,
    absent: acc.absent + r.absent_days,
    leave: acc.leave + r.leave_days,
  }), { present: 0, late: 0, absent: 0, leave: 0 })

  const field = 'rounded-xl border-0 bg-slate-100/80 px-3.5 py-2 text-sm text-slate-700 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/60'

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-blue-600/20">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Attendance Reports</h1>
            <p className="text-[13px] text-slate-500">Monthly rollup of presence, lateness and leave, per employee.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/attendance/muster-roll"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Grid3x3 size={13} /> Muster Roll
          </Link>
          <Link to="/attendance/exceptions"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <AlertTriangle size={13} /> Exceptions
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={field}>
          {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={field}>
          {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={branchId} onChange={(e) => { setBranchId(e.target.value); setDeptId('') }} className={field}>
          <option value="">All Branches</option>
          {(branchesData?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={field}>
          <option value="">All Departments</option>
          {(Array.isArray(deptsData) ? deptsData : []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={handleExport} disabled={exporting || !rows?.length}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-50">
          <Download size={13} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Users} label="Employees" value={rows?.length ?? 0} color="bg-slate-600" />
        <KpiCard icon={Clock} label="Late Marks" value={totals.late} color="bg-amber-500" />
        <KpiCard icon={XCircle} label="Absences" value={totals.absent} color="bg-rose-500" />
        <KpiCard icon={CalendarOff} label="Leave Days" value={totals.leave} color="bg-purple-500" />
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          Failed to load the report. You may not have permission to view attendance reports.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-center">Present</th>
                  <th className="px-4 py-3 text-center">Late</th>
                  <th className="px-4 py-3 text-center">Half Day</th>
                  <th className="px-4 py-3 text-center">Absent</th>
                  <th className="px-4 py-3 text-center">Leave</th>
                  <th className="px-4 py-3 text-center">Holidays</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3 text-right">Avg Late</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(rows ?? []).length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">No employees found for this filter.</td></tr>
                )}
                {(rows ?? []).map((r) => (
                  <tr key={r.employee.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{r.employee.name}</p>
                      <p className="text-[11px] text-slate-400">{r.employee.employee_code} · {r.employee.branch}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.employee.department ?? '—'}</td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-600">{r.present_days}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{r.late_days || '—'}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{r.half_days || '—'}</td>
                    <td className="px-4 py-3 text-center text-rose-600">{r.absent_days || '—'}</td>
                    <td className="px-4 py-3 text-center text-purple-600">{r.leave_days || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{r.holiday_days || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{r.worked_hours}h</td>
                    <td className="px-4 py-3 text-right text-slate-400">{r.avg_late_minutes ? `${r.avg_late_minutes}m` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
