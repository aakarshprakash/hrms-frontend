import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Fingerprint, Search, ClipboardCheck, ChevronDown, Clock3, ScrollText, Check } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi, departmentApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { PageHeader, Card, Button, IconButton, Input, Select, Field, Modal, Table, StatusPill, EmptyState, ErrorBanner, Avatar } from '@/components/ui/kit'

const STATUSES = {
  present: { label: 'Present', color: '#10b981' },
  late: { label: 'Late', color: '#f59e0b' },
  half_day: { label: 'Half day', color: '#3b82f6' },
  absent: { label: 'Absent', color: '#f43f5e' },
  on_leave: { label: 'On leave', color: '#8b5cf6' },
  weekly_off: { label: 'Weekly off', color: '#cbd5e1' },
  holiday: { label: 'Holiday', color: '#14b8a6' },
}
const BUCKETS = { ...STATUSES, unmarked: { label: 'Not marked', color: '#e2e8f0' } }
const ORDER = ['present', 'late', 'half_day', 'absent', 'on_leave', 'weekly_off', 'holiday', 'unmarked']

const SOURCES = { manual: 'manual', api: 'device', web: 'web', mobile: 'mobile', kiosk: 'kiosk', regularization: 'corrected' }

const localToday = () => new Date().toLocaleDateString('en-CA')
function shiftDate(iso, delta) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return d.toLocaleDateString('en-CA')
}
function bucket(row) {
  if (row.on_approved_leave) return 'on_leave'
  const s = row.attendance?.status
  return s && BUCKETS[s] ? s : 'unmarked'
}
const time = (v) => (v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—')

/** A day's attendance for a branch: who's in, late, out -- and corrections. */
export default function TeamAttendancePage() {
  const qc = useQueryClient()
  const { can } = useRole()
  const canMark = can('attendance.manage')
  const activeBranchId = useAuthStore((s) => s.activeBranchId)

  const [date, setDate] = useState(localToday)
  const [filterBranch, setFilterBranch] = useState(activeBranchId ?? '')
  const [filterDept, setFilterDept] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [editRow, setEditRow] = useState(null)
  const [menuFor, setMenuFor] = useState(null)

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? []) })
  const { data: departments = [] } = useQuery({
    queryKey: ['departments', filterBranch],
    queryFn: () => departmentApi.list({ branch_id: filterBranch || undefined }).then((r) => r.data?.data ?? r.data ?? []),
  })
  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance-day', date, filterBranch, filterDept],
    queryFn: () => attendanceApi.daySummary({ date, branch_id: filterBranch || undefined, department_id: filterDept || undefined }).then((r) => r.data?.data),
    placeholderData: (prev) => prev,
  })

  const mark = useMutation({
    mutationFn: (payload) => attendanceApi.manualUpsert(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-day'] })
      qc.invalidateQueries({ queryKey: ['attendance'] })
      setEditRow(null)
      setMenuFor(null)
    },
  })

  const rows = useMemo(() => data?.rows ?? [], [data])
  const isToday = date === localToday()
  const summary = useMemo(() => {
    const s = Object.fromEntries(ORDER.map((k) => [k, 0]))
    rows.forEach((r) => { s[bucket(r)]++ })
    return s
  }, [rows])
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => (!statusFilter || bucket(r) === statusFilter)
      && (!q || `${r.employee.name} ${r.employee.employee_code}`.toLowerCase().includes(q)))
  }, [rows, statusFilter, search])

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <PageHeader icon={ClipboardCheck} title="Team attendance" subtitle={`${dateLabel}${isToday ? ' · today' : ''}`}
        actions={<>
          {can('attendance.view', 'attendance.manage') && <Link to="/attendance/punches"><Button variant="secondary" icon={ScrollText}>Punch log</Button></Link>}
          {can('settings.manage') && <Link to="/settings/biometric"><Button variant="secondary" icon={Fingerprint}>Devices</Button></Link>}
        </>} />

      <Card padded={false}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-white shadow-xs">
            <button onClick={() => setDate((d) => shiftDate(d, -1))} className="flex h-full items-center rounded-l-lg px-2 text-slate-500 hover:bg-slate-50" aria-label="Previous day"><ChevronLeft size={16} /></button>
            <input type="date" value={date} max={localToday()} onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-full border-x border-slate-200 bg-transparent px-2 text-[13px] text-slate-900 outline-none" />
            <button onClick={() => setDate((d) => shiftDate(d, 1))} disabled={isToday} className="flex h-full items-center rounded-r-lg px-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30" aria-label="Next day"><ChevronRight size={16} /></button>
          </div>
          {!isToday && <Button variant="ghost" size="sm" onClick={() => setDate(localToday())}>Today</Button>}
          {branches.length > 1 && (
            <Select className="w-auto min-w-44" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setFilterDept('') }}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Select className="w-auto min-w-40" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All departments</option>
            {(Array.isArray(departments) ? departments : []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search by name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Distribution + filters */}
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
            {ORDER.map((k) => summary[k] > 0 && (
              <div key={k} style={{ width: `${(summary[k] / Math.max(rows.length, 1)) * 100}%`, backgroundColor: BUCKETS[k].color }} title={`${BUCKETS[k].label}: ${summary[k]}`} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <FilterChip active={!statusFilter} onClick={() => setStatusFilter(null)} label="Everyone" count={rows.length} />
            {ORDER.filter((k) => summary[k] > 0 || ['present', 'absent', 'unmarked'].includes(k)).map((k) => (
              <FilterChip key={k} active={statusFilter === k} onClick={() => setStatusFilter(statusFilter === k ? null : k)}
                label={BUCKETS[k].label} count={summary[k]} color={BUCKETS[k].color} />
            ))}
          </div>
        </div>

        <ErrorBanner error={error} className="m-3" />
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
          <Table rows={visible.map((r) => ({ ...r, id: r.employee.id }))}
            empty={<EmptyState title={rows.length ? 'No one matches this filter' : 'No active employees here'} />}
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => (
                <div className="flex items-center gap-3">
                  <Avatar name={r.employee.name} src={r.employee.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{r.employee.name}</p>
                    <p className="truncate text-xs text-slate-500">{r.employee.employee_code}{r.employee.designation ? ` · ${r.employee.designation}` : ''}</p>
                  </div>
                </div>
              ) },
              { key: 'department', label: 'Department', render: (r) => r.employee.department ?? '—' },
              { key: 'in', label: 'In', render: (r) => <span className="tabular-nums">{time(r.attendance?.check_in)}</span> },
              { key: 'out', label: 'Out', render: (r) => <span className="tabular-nums">{time(r.attendance?.check_out)}</span> },
              { key: 'status', label: 'Status', render: (r) => {
                const b = bucket(r)
                const att = r.attendance
                return (
                  <div className="flex items-center gap-2">
                    <StatusPill status={b === 'unmarked' ? 'draft' : b} label={BUCKETS[b].label} />
                    {att?.late_by_minutes > 0 && <span className="text-[11px] font-medium text-amber-600">+{att.late_by_minutes}m</span>}
                    {att?.source && SOURCES[att.source] && <span className="text-[11px] text-slate-400">{SOURCES[att.source]}</span>}
                  </div>
                )
              } },
              ...(canMark ? [{ key: 'actions', label: '', align: 'right', render: (r) => (
                <div className="relative flex justify-end gap-1">
                  <Button size="sm" variant="secondary" disabled={r.on_approved_leave || mark.isPending}
                    onClick={() => setMenuFor(menuFor === r.employee.id ? null : r.employee.id)}>
                    Mark <ChevronDown size={13} />
                  </Button>
                  <IconButton icon={Clock3} label="Set times" disabled={r.on_approved_leave} onClick={() => setEditRow(r)} />
                  {menuFor === r.employee.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
                      <div className="absolute right-8 top-9 z-30 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
                        {Object.entries(STATUSES).map(([status, m]) => (
                          <button key={status} onClick={() => mark.mutate({ employee_id: r.employee.id, date, status })}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                            <span className="flex-1">{m.label}</span>
                            {r.attendance?.status === status && <Check size={14} className="text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) }] : []),
            ]} />
        )}
      </Card>

      {editRow && <TimesModal row={editRow} date={date} onClose={() => setEditRow(null)} onSave={(p) => mark.mutate(p)} saving={mark.isPending} error={mark.error} />}
    </div>
  )
}

function FilterChip({ active, onClick, label, count, color }) {
  return (
    <button onClick={onClick}
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
        active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      <span className={cn('tabular-nums', active ? 'text-blue-100' : 'text-slate-400')}>{count}</span>
    </button>
  )
}

function TimesModal({ row, date, onClose, onSave, saving, error }) {
  const att = row.attendance
  const toTime = (v) => (v ? new Date(v).toTimeString().slice(0, 5) : '')
  const [status, setStatus] = useState(att?.status ?? 'present')
  const [checkIn, setCheckIn] = useState(toTime(att?.check_in))
  const [checkOut, setCheckOut] = useState(toTime(att?.check_out))

  return (
    <Modal size="sm" title={row.employee.name} subtitle={new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={saving} onClick={() => onSave({ employee_id: row.employee.id, date, status, check_in: checkIn || undefined, check_out: checkOut || undefined })}>Save</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={error} />
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUSES).map(([s, m]) => <option key={s} value={s}>{m.label}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check in"><Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></Field>
          <Field label="Check out"><Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-slate-500">Manual entries are kept as they are — reprocessing never overwrites them.</p>
      </div>
    </Modal>
  )
}
