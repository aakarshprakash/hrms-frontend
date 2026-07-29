import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays, Fingerprint, X, Save } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi, departmentApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const STATUS_META = {
  present: { label: 'Present', chip: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  late: { label: 'Late', chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  half_day: { label: 'Half Day', chip: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  absent: { label: 'Absent', chip: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  on_leave: { label: 'On Leave', chip: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
}

function shiftDate(iso, delta) {
  const d = new Date(iso)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

export default function TeamAttendancePage() {
  const qc = useQueryClient()
  const { canManageEmployees } = useRole()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [filterBranch, setFilterBranch] = useState(activeBranchId ?? '')
  const [filterDept, setFilterDept] = useState('')
  const [editRow, setEditRow] = useState(null) // employee row being edited

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data),
  })

  const { data: deptsData } = useQuery({
    queryKey: ['departments', filterBranch],
    queryFn: () => departmentApi.list({ branch_id: filterBranch || undefined }).then((r) => r.data?.data ?? r.data ?? []),
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance-day', date, filterBranch, filterDept],
    queryFn: () => attendanceApi.daySummary({
      date,
      branch_id: filterBranch || undefined,
      department_id: filterDept || undefined,
    }).then((r) => r.data?.data),
    placeholderData: (prev) => prev,
  })

  const markMutation = useMutation({
    mutationFn: (payload) => attendanceApi.manualUpsert(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-day'] })
      qc.invalidateQueries({ queryKey: ['attendance'] })
      setEditRow(null)
    },
  })

  const rows = data?.rows ?? []
  const counts = data?.counts ?? {}
  const isToday = date === new Date().toISOString().slice(0, 10)

  function quickMark(row, status) {
    markMutation.mutate({ employee_id: row.employee.id, date, status })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Attendance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Mark and correct attendance for your team, branch-wise.</p>
        </div>
        {canManageEmployees && (
          <Link to="/settings/biometric"
            className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-100 transition-colors">
            <Fingerprint size={14} />
            Biometric device sync
          </Link>
        )}
      </div>

      {/* Date & filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border bg-white">
          <button onClick={() => setDate((d) => shiftDate(d, -1))} className="p-2 hover:bg-slate-50 rounded-l-md">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2 border-x px-3 py-2">
            <CalendarDays size={14} className="text-blue-500" />
            <input type="date" value={date} max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="bg-transparent text-sm text-slate-900 outline-none" />
            {isToday && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">TODAY</span>}
          </div>
          <button onClick={() => setDate((d) => shiftDate(d, 1))} disabled={isToday}
            className="p-2 hover:bg-slate-50 rounded-r-md disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>

        <select value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setFilterDept('') }}
          className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
          <option value="">All Branches</option>
          {(branchesData?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
          className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
          <option value="">All Departments</option>
          {(Array.isArray(deptsData) ? deptsData : []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          ['Total', counts.total, 'text-slate-800'],
          ['Present', counts.present, 'text-green-600'],
          ['Late', counts.late, 'text-amber-600'],
          ['Half Day', counts.half_day, 'text-blue-600'],
          ['Absent', counts.absent, 'text-red-500'],
          ['On Leave', counts.on_leave, 'text-purple-600'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border bg-white p-3 text-center shadow-sm">
            <p className={cn('text-xl font-bold', color)}>{value ?? 0}</p>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Failed to load the attendance roster.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Status</th>
                {canManageEmployees && <th className="px-4 py-3 text-right">Mark</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No active employees found.</td></tr>
              )}
              {rows.map((row) => {
                const att = row.attendance
                const meta = att ? STATUS_META[att.status] : null
                return (
                  <tr key={row.employee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {row.employee.avatar_url ? (
                          <img src={row.employee.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
                            {row.employee.name?.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-900">{row.employee.name}</p>
                          <p className="text-xs text-slate-400">{row.employee.employee_code}{row.employee.designation ? ` · ${row.employee.designation}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{row.employee.department ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {att?.check_in ? new Date(att.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {att?.check_out ? new Date(att.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.on_approved_leave ? (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">On Leave</span>
                      ) : meta ? (
                        <div className="flex items-center gap-1.5">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', meta.chip)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                            {meta.label}
                            {att.source === 'manual' && <span className="text-[9px] opacity-60">(manual)</span>}
                            {att.source === 'api' && <span className="text-[9px] opacity-60">(device)</span>}
                          </span>
                          {att.late_by_minutes > 0 && (
                            <span className="text-[10px] font-medium text-amber-600">+{att.late_by_minutes}m</span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Not marked</span>
                      )}
                    </td>
                    {canManageEmployees && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          {Object.entries(STATUS_META).map(([status, m]) => (
                            <button key={status}
                              onClick={() => quickMark(row, status)}
                              disabled={markMutation.isPending || row.on_approved_leave}
                              title={m.label}
                              className={cn(
                                'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40',
                                att?.status === status
                                  ? cn(m.chip, 'border-transparent')
                                  : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                              )}>
                              {m.label.split(' ')[0]}
                            </button>
                          ))}
                          <button onClick={() => setEditRow(row)} title="Set check-in / check-out times"
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100">
                            Times…
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <TimesModal
          row={editRow}
          date={date}
          onClose={() => setEditRow(null)}
          onSave={(payload) => markMutation.mutate(payload)}
          saving={markMutation.isPending}
        />
      )}
    </div>
  )
}

function TimesModal({ row, date, onClose, onSave, saving }) {
  const att = row.attendance
  const toTime = (v) => (v ? new Date(v).toTimeString().slice(0, 5) : '')
  const [status, setStatus] = useState(att?.status ?? 'present')
  const [checkIn, setCheckIn] = useState(toTime(att?.check_in))
  const [checkOut, setCheckOut] = useState(toTime(att?.check_out))

  function submit(e) {
    e.preventDefault()
    onSave({
      employee_id: row.employee.id,
      date,
      status,
      check_in: checkIn || undefined,
      check_out: checkOut || undefined,
    })
  }

  const field = 'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{row.employee.name}</h2>
            <p className="text-xs text-slate-400">{date}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_META).map(([s, m]) => <option key={s} value={s}>{m.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check In</label>
              <input type="time" className={field} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check Out</label>
              <input type="time" className={field} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
