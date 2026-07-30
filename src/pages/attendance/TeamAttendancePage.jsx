import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, CalendarDays, Fingerprint, X, Save, Search,
  Users, CheckCircle, Clock, MinusCircle, XCircle, Umbrella, HelpCircle,
} from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi, departmentApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const STATUS_META = {
  present: { label: 'Present', chip: 'bg-green-100 text-green-700', dot: 'bg-green-500', icon: CheckCircle, border: 'border-l-green-500' },
  late: { label: 'Late', chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', icon: Clock, border: 'border-l-amber-500' },
  half_day: { label: 'Half Day', chip: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', icon: MinusCircle, border: 'border-l-blue-500' },
  absent: { label: 'Absent', chip: 'bg-red-100 text-red-600', dot: 'bg-red-500', icon: XCircle, border: 'border-l-red-500' },
  on_leave: { label: 'On Leave', chip: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', icon: Umbrella, border: 'border-l-purple-500' },
}

// Filter buckets shown as the clickable summary cards -- a superset of
// STATUS_META that also covers "not yet marked", which isn't a real
// attendance status but is the single most HR-relevant bucket for today.
const FILTER_META = {
  ...STATUS_META,
  unmarked: { label: 'Not Marked', chip: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', icon: HelpCircle, border: 'border-l-slate-300' },
}

const FILTER_ORDER = ['present', 'late', 'half_day', 'absent', 'on_leave', 'unmarked']

function rowBucket(row) {
  if (row.on_approved_leave) return 'on_leave'
  const status = row.attendance?.status
  if (status === 'on_leave') return 'on_leave'
  if (status && FILTER_META[status]) return status
  return 'unmarked'
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
  const [statusFilter, setStatusFilter] = useState(null) // one of FILTER_ORDER, or null for "all"
  const [search, setSearch] = useState('')
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
  const isToday = date === new Date().toISOString().slice(0, 10)

  // Computed client-side from the same rows the table renders, rather than
  // the backend's counts (which overlaps "present" with "late"), so the
  // numbers on each card always match exactly what clicking it filters to.
  const summary = useMemo(() => {
    const s = { total: rows.length, present: 0, late: 0, half_day: 0, absent: 0, on_leave: 0, unmarked: 0 }
    rows.forEach((row) => { s[rowBucket(row)]++ })
    return s
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter && rowBucket(row) !== statusFilter) return false
      if (q) {
        const hay = `${row.employee.name} ${row.employee.employee_code}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, statusFilter, search])

  function quickMark(row, status) {
    markMutation.mutate({ employee_id: row.employee.id, date, status })
  }

  function toggleFilter(key) {
    setStatusFilter((prev) => (prev === key ? null : key))
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

        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or employee code…"
            className="w-full rounded-md border bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500" />
        </div>
      </div>

      {/* Summary cards — click one to filter the roster below; click again to clear */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <button type="button" onClick={() => setStatusFilter(null)}
          className={cn(
            'rounded-xl border-2 border-l-4 bg-white p-3.5 text-left shadow-sm transition-all hover:shadow-md',
            statusFilter === null ? 'border-slate-800 border-l-slate-800' : 'border-transparent border-l-slate-300'
          )}>
          <div className="flex items-center gap-2 text-slate-400"><Users size={15} /><span className="text-[11px] font-semibold uppercase tracking-wide">Total</span></div>
          <p className="mt-1.5 text-2xl font-bold text-slate-800">{summary.total}</p>
        </button>
        {FILTER_ORDER.map((key) => {
          const meta = FILTER_META[key]
          const Icon = meta.icon
          const active = statusFilter === key
          return (
            <button key={key} type="button" onClick={() => toggleFilter(key)}
              className={cn(
                'rounded-xl border-2 border-l-4 bg-white p-3.5 text-left shadow-sm transition-all hover:shadow-md',
                active ? cn('border-slate-800', meta.border) : cn('border-transparent', meta.border)
              )}>
              <div className={cn('flex items-center gap-2', meta.chip.split(' ')[1])}>
                <Icon size={15} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">{meta.label}</span>
              </div>
              <p className="mt-1.5 text-2xl font-bold text-slate-800">{summary[key]}</p>
            </button>
          )
        })}
      </div>

      {statusFilter && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          Showing only <span className={cn('rounded-full px-2 py-0.5 font-medium', FILTER_META[statusFilter].chip)}>{FILTER_META[statusFilter].label}</span>
          <button onClick={() => setStatusFilter(null)} className="text-blue-600 hover:underline">Clear filter</button>
        </div>
      )}

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
              {filteredRows.length === 0 && (
                <tr><td colSpan={canManageEmployees ? 6 : 5} className="px-4 py-10 text-center text-slate-400">
                  {rows.length === 0 ? 'No active employees found.' : 'No employees match the current filter or search.'}
                </td></tr>
              )}
              {filteredRows.map((row) => {
                const att = row.attendance
                const meta = att ? STATUS_META[att.status] : null
                const bucketMeta = FILTER_META[rowBucket(row)]
                return (
                  <tr key={row.employee.id} className={cn('border-l-4 hover:bg-slate-50 transition-colors', bucketMeta.border)}>
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
