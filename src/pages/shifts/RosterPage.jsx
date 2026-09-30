import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, ChevronLeft, ChevronRight, Copy, Save, Eraser, Moon, Users } from 'lucide-react'
import { shiftApi } from '@/lib/api/shifts'
import { branchApi, departmentApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { WEEKDAYS } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Modal, Select, Tabs, Toggle, ErrorBanner, EmptyState } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

const ATTENDANCE_DOT = {
  present: 'bg-emerald-500', late: 'bg-amber-500', half_day: 'bg-blue-500', absent: 'bg-rose-500',
  on_leave: 'bg-purple-500', weekly_off: 'bg-slate-300', holiday: 'bg-teal-500',
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function mondayOf(date) {
  const d = new Date(`${date}T00:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1)
  return isoDate(d)
}

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return isoDate(d)
}

export default function RosterPage() {
  const qc = useQueryClient()
  const { can } = useRole()
  const editable = can('shifts.manage')
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [branchId, setBranchId] = useState(activeBranchId ?? '')
  const [departmentId, setDepartmentId] = useState('')
  const [start, setStart] = useState(mondayOf(isoDate(new Date())))
  const [span, setSpan] = useState('7')
  const [brush, setBrush] = useState(null) // {shift_id} | {is_off: true} | {clear: true}
  const [pending, setPending] = useState({}) // "empId|date" -> entry
  const [weeklyOffFor, setWeeklyOffFor] = useState(null)

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? []) })
  const bid = branchId || branches[0]?.id
  const { data: departments = [] } = useQuery({
    queryKey: ['departments', bid], enabled: !!bid,
    queryFn: () => departmentApi.list({ branch_id: bid }).then((r) => r.data?.data ?? r.data ?? []),
  })
  const to = addDays(start, Number(span) - 1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['roster-grid', bid, start, to, departmentId],
    queryFn: () => shiftApi.rosterGrid({ branch_id: bid, from: start, to, department_id: departmentId || undefined }).then((r) => r.data.data),
    enabled: !!bid,
    placeholderData: (p) => p,
  })

  const shiftsById = useMemo(() => Object.fromEntries((data?.shifts ?? []).map((s) => [s.id, s])), [data])
  const today = isoDate(new Date())

  const save = useMutation({
    mutationFn: () => shiftApi.saveRoster({ branch_id: bid, entries: Object.values(pending) }),
    onSuccess: () => { setPending({}); qc.invalidateQueries({ queryKey: ['roster-grid'] }) },
  })
  const copy = useMutation({
    mutationFn: () => shiftApi.copyWeek({ branch_id: bid, source_start: addDays(start, -7), target_start: start }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster-grid'] }),
  })

  function paint(employeeId, date) {
    if (!brush || !editable) return
    const key = `${employeeId}|${date}`
    setPending((p) => ({ ...p, [key]: { employee_id: employeeId, date, ...brush } }))
  }

  function cellView(row, date) {
    const change = pending[`${row.employee.id}|${date}`]
    const cell = row.cells[date]
    if (change) {
      if (change.clear) return { label: 'Reset', style: 'border-dashed border-slate-400 text-slate-500', pending: true }
      if (change.is_off) return { label: 'OFF', style: 'bg-slate-200 text-slate-600', pending: true }
      const s = shiftsById[change.shift_id]
      return { label: s?.code || s?.name, color: s?.color, pending: true }
    }
    if (cell.leave) return { label: 'Leave', style: 'bg-purple-50 text-purple-700' }
    if (cell.holiday) return { label: 'Holiday', style: 'bg-teal-50 text-teal-700', title: cell.holiday }
    if (cell.is_weekly_off) return { label: 'OFF', style: 'bg-slate-100 text-slate-500', rostered: cell.shift_source === 'roster' }
    if (!cell.shift) return { label: '—', style: 'text-slate-300' }
    return { label: cell.shift.name, color: cell.shift.color, rostered: cell.shift_source === 'roster', title: `${cell.shift.name} ${cell.shift.start_time}–${cell.shift.end_time} (${cell.shift_source?.replace('_', ' ')})` }
  }

  const pendingCount = Object.keys(pending).length

  return (
    <div>
      <PageHeader icon={CalendarRange} title="Shift roster"
        subtitle="Who works which shift, day by day. Rostered days override standing shift assignments."
        actions={<>
          {branches.length > 1 && (
            <Select className="w-auto" value={bid ?? ''} onChange={(e) => { setBranchId(Number(e.target.value)); setDepartmentId(''); setPending({}) }}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Select className="w-auto" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </>} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => setStart(addDays(start, -Number(span)))} aria-label="Previous" />
          <Button variant="secondary" size="sm" onClick={() => setStart(mondayOf(today))}>This week</Button>
          <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, Number(span)))} aria-label="Next"><ChevronRight size={14} /></Button>
          <span className="ml-2 text-sm font-medium text-slate-700">
            {new Date(`${start}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(`${to}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Tabs className="ml-2" value={span} onChange={setSpan} tabs={[{ key: '7', label: 'Week' }, { key: '14', label: '2 weeks' }]} />
        </div>
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" icon={Copy} loading={copy.isPending} onClick={() => copy.mutate()}>Copy previous week</Button>
            <Button size="sm" icon={Save} disabled={!pendingCount} loading={save.isPending} onClick={() => save.mutate()}>Save {pendingCount ? `(${pendingCount})` : ''}</Button>
            {pendingCount > 0 && <Button variant="ghost" size="sm" onClick={() => setPending({})}>Discard</Button>}
          </div>
        )}
      </div>

      {editable && (
        <Card className="mb-4 flex flex-wrap items-center gap-2 py-3">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Brush</span>
          {(data?.shifts ?? []).filter((s) => s.is_active !== false).map((s) => (
            <button key={s.id} type="button" onClick={() => setBrush({ shift_id: s.id })}
              className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium',
                brush?.shift_id === s.id ? 'border-slate-800 ring-2 ring-slate-800/10' : 'border-slate-200')}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color ?? '#64748b' }} />
              {s.name} <span className="text-slate-400">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>
            </button>
          ))}
          <button type="button" onClick={() => setBrush({ is_off: true })}
            className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium', brush?.is_off ? 'border-slate-800 ring-2 ring-slate-800/10' : 'border-slate-200')}>
            <Moon size={12} /> Day off
          </button>
          <button type="button" onClick={() => setBrush({ clear: true })}
            className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium', brush?.clear ? 'border-slate-800 ring-2 ring-slate-800/10' : 'border-slate-200')}>
            <Eraser size={12} /> Reset to default
          </button>
          <span className="ml-auto text-xs text-slate-400">{brush ? 'Click cells to apply, then Save.' : 'Pick a brush to edit the roster.'}</span>
        </Card>
      )}

      <ErrorBanner error={save.error ?? copy.error ?? error} className="mb-4" />

      <Card padded={false}>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (data?.rows ?? []).length === 0 ? (
          <EmptyState icon={Users} title="No employees" description="Nobody active in this branch/department." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[200px] border-b border-slate-100 bg-white px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                  {data.days.map((d) => {
                    const dt = new Date(`${d}T00:00:00`)
                    return (
                      <th key={d} className={cn('min-w-[88px] border-b border-slate-100 px-1 py-2 text-center font-semibold', d === today ? 'text-blue-600' : 'text-slate-500')}>
                        <div className="text-[10px] uppercase">{WEEKDAYS[dt.getDay()]}</div>
                        <div className="text-sm">{dt.getDate()}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.employee.id} className="group">
                    <td className="sticky left-0 z-10 border-b border-slate-50 bg-white px-4 py-2 group-hover:bg-slate-50">
                      <button type="button" className="text-left" onClick={() => editable && setWeeklyOffFor(row.employee)}>
                        <p className="font-medium text-slate-800">{row.employee.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {row.employee.designation ?? row.employee.department}
                          {' · off '}{row.employee.weekly_off_days ? row.employee.weekly_off_days.map((d) => WEEKDAYS[d]).join('/') || 'none' : 'branch default'}
                        </p>
                      </button>
                    </td>
                    {data.days.map((d) => {
                      const v = cellView(row, d)
                      const att = row.cells[d].attendance
                      return (
                        <td key={d} className="border-b border-slate-50 p-1 group-hover:bg-slate-50/60">
                          <button type="button" title={v.title} onClick={() => paint(row.employee.id, d)}
                            className={cn('relative flex h-10 w-full items-center justify-center rounded-lg border px-1 text-[11px] font-medium transition-all',
                              v.style ?? 'border-transparent text-white',
                              v.pending && 'ring-2 ring-blue-500 ring-offset-1',
                              v.rostered && 'border-slate-800/30',
                              brush && editable ? 'cursor-cell hover:brightness-95' : 'cursor-default')}
                            style={v.color ? { background: v.color, opacity: v.rostered || v.pending ? 1 : 0.8 } : undefined}>
                            <span className="truncate">{v.label}</span>
                            {att && <span className={cn('absolute right-1 top-1 h-1.5 w-1.5 rounded-full ring-1 ring-white', ATTENDANCE_DOT[att])} title={att.replace('_', ' ')} />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-2 text-xs text-slate-400">Solid-bordered cells are rostered for that day; others come from the employee's shift assignment or the branch default. Dots show the attendance outcome for past days.</p>

      {weeklyOffFor && <WeeklyOffModal employee={weeklyOffFor} onClose={() => setWeeklyOffFor(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['roster-grid'] })} />}
    </div>
  )
}

function WeeklyOffModal({ employee, onClose, onSaved }) {
  const [useBranch, setUseBranch] = useState(employee.weekly_off_days === null || employee.weekly_off_days === undefined)
  const [daysOff, setDaysOff] = useState(employee.weekly_off_days ?? [0])
  const save = useMutation({
    mutationFn: () => shiftApi.setWeeklyOffs({ employee_ids: [employee.id], weekly_off_days: useBranch ? null : daysOff }),
    onSuccess: () => { onSaved(); onClose() },
  })
  return (
    <Modal size="sm" title={`Weekly off — ${employee.name}`} subtitle="Staggered weekly offs keep a 7-day showroom staffed." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={save.error} />
        <Toggle checked={useBranch} onChange={setUseBranch} label="Use the branch's weekly off" />
        {!useBranch && (
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => setDaysOff((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}
                className={cn('rounded-lg border px-3 py-1.5 text-sm', daysOff.includes(i) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600')}>{d}</button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
