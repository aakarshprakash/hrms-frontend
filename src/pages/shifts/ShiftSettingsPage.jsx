import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Clock, Check, Users, Search, ChevronDown, Info } from 'lucide-react'
import { shiftApi } from '@/lib/api/shifts'
import { branchApi } from '@/lib/api/departments'
import { employeeApi } from '@/lib/api/employees'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { PageHeader, Card, Button, IconButton, Modal, Field, Input, Select, EmptyState, ErrorBanner } from '@/components/ui/kit'

const hhmm = (v) => (v ? v.slice(0, 5) : '—')

function workingHours(start, end, breakMin) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  mins -= (breakMin ?? 0)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const RULES = [
  ['code', 'Short code', 'text', 'Shown on the roster, e.g. GEN'],
  ['early_exit_grace_minutes', 'Early-exit grace (min)', 'number', 'Leaving this early isn’t flagged'],
  ['half_day_threshold_minutes', 'Half day below (min worked)', 'number', 'Blank = half the shift'],
  ['absent_threshold_minutes', 'Absent below (min worked)', 'number', 'Blank = never, e.g. 120'],
  ['ot_threshold_minutes', 'Overtime after (min extra)', 'number', 'Blank = no overtime tracking'],
  ['punch_window_before_minutes', 'Punches accepted from (min before start)', 'number', 'Default 180'],
  ['punch_window_after_minutes', 'Punches accepted until (min after end)', 'number', 'Default 360 — covers night shifts'],
]

function ShiftModal({ initial, branches, activeBranchId, onSave, onClose, saving, error }) {
  const [base, setBase] = useState({
    name: initial?.name ?? '',
    branch_id: initial?.branch_id ?? activeBranchId ?? '',
    start_time: initial?.start_time?.slice(0, 5) ?? '09:00',
    end_time: initial?.end_time?.slice(0, 5) ?? '18:00',
    break_minutes: initial?.break_minutes ?? 30,
    grace_minutes: initial?.grace_minutes ?? 10,
  })
  const [rules, setRules] = useState({
    code: initial?.code ?? '',
    color: initial?.color ?? '#2a78d6',
    early_exit_grace_minutes: initial?.early_exit_grace_minutes ?? 0,
    half_day_threshold_minutes: initial?.half_day_threshold_minutes ?? '',
    absent_threshold_minutes: initial?.absent_threshold_minutes ?? '',
    ot_threshold_minutes: initial?.ot_threshold_minutes ?? '',
    punch_window_before_minutes: initial?.punch_window_before_minutes ?? 180,
    punch_window_after_minutes: initial?.punch_window_after_minutes ?? 360,
  })
  const [showRules, setShowRules] = useState(false)
  const setB = (k) => (e) => setBase((f) => ({ ...f, [k]: e.target.value }))
  const setR = (k) => (e) => setRules((r) => ({ ...r, [k]: e.target.value }))
  const optional = (v) => (v === '' || v === null ? null : Number(v))
  const preview = workingHours(base.start_time, base.end_time, Number(base.break_minutes))

  function submit(e) {
    e.preventDefault()
    if (!base.name.trim() || !base.branch_id) return
    onSave({
      name: base.name.trim(),
      branch_id: Number(base.branch_id),
      start_time: base.start_time,
      end_time: base.end_time,
      break_minutes: Number(base.break_minutes),
      grace_minutes: Number(base.grace_minutes),
      code: rules.code || null,
      color: rules.color || null,
      early_exit_grace_minutes: Number(rules.early_exit_grace_minutes) || 0,
      half_day_threshold_minutes: optional(rules.half_day_threshold_minutes),
      absent_threshold_minutes: optional(rules.absent_threshold_minutes),
      ot_threshold_minutes: optional(rules.ot_threshold_minutes),
      punch_window_before_minutes: Number(rules.punch_window_before_minutes) || 180,
      punch_window_after_minutes: Number(rules.punch_window_after_minutes) || 360,
    })
  }

  return (
    <Modal size="lg" title={initial ? `Edit ${initial.name}` : 'New shift'} subtitle="Timings decide late marks, half days and overtime for everyone on this shift." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="shift-form" loading={saving}>{initial ? 'Save changes' : 'Create shift'}</Button></>}>
      <form id="shift-form" onSubmit={submit} className="space-y-4">
        <ErrorBanner error={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shift name" required><Input required autoFocus value={base.name} onChange={setB('name')} placeholder="e.g. General, Morning, Night" /></Field>
          <Field label="Branch" required>
            <Select required value={base.branch_id} onChange={setB('branch_id')}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Starts" required><Input type="time" required value={base.start_time} onChange={setB('start_time')} /></Field>
          <Field label="Ends" required><Input type="time" required value={base.end_time} onChange={setB('end_time')} /></Field>
          <Field label="Break (minutes)" hint="Subtracted from working time and overtime."><Input type="number" min={0} max={120} value={base.break_minutes} onChange={setB('break_minutes')} /></Field>
          <Field label="Grace period (minutes)" hint="Check-ins within this window aren’t marked late."><Input type="number" min={0} max={60} value={base.grace_minutes} onChange={setB('grace_minutes')} /></Field>
        </div>

        {preview && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
            <Clock size={13} className="text-blue-600" />
            <strong className="text-slate-900">{hhmm(base.start_time)} – {hhmm(base.end_time)}</strong> · {preview} working
            {Number(base.break_minutes) > 0 && <span className="text-slate-400">({base.break_minutes}m break)</span>}
          </div>
        )}

        <div className="rounded-lg border border-slate-200">
          <button type="button" onClick={() => setShowRules((v) => !v)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] font-medium text-slate-700">
            Attendance rules <span className="flex items-center gap-1 text-xs font-normal text-slate-500">half day, absent, overtime, punch window<ChevronDown size={14} className={cn('transition-transform', showRules && 'rotate-180')} /></span>
          </button>
          {showRules && (
            <div className="grid gap-4 border-t border-slate-200 p-4 sm:grid-cols-2">
              {RULES.map(([key, label, type, hint]) => (
                <Field key={key} label={label} hint={hint}><Input type={type} min={0} value={rules[key] ?? ''} onChange={setR(key)} /></Field>
              ))}
              <Field label="Roster colour">
                <input type="color" value={rules.color} onChange={setR('color')} className="h-9 w-16 cursor-pointer rounded-lg border border-slate-200 bg-white" />
              </Field>
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

/** Work shifts per branch: timings, grace and the attendance rules they apply. */
export default function ShiftSettingsPage() {
  const qc = useQueryClient()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const { canManageEmployees } = useRole()
  const [editing, setEditing] = useState(null) // null | 'new' | shift
  const [deleting, setDeleting] = useState(null)
  const [filterBranch, setFilterBranch] = useState('')
  const [assignShift, setAssignShift] = useState(null)

  const { data: branchesRaw } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })
  const branches = Array.isArray(branchesRaw) ? branchesRaw : (branchesRaw?.data ?? [])

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', filterBranch],
    queryFn: () => shiftApi.list(filterBranch ? { branch_id: filterBranch } : {}).then((r) => r.data?.data ?? r.data ?? []),
  })
  const shifts = Array.isArray(data) ? data : []

  const done = () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setEditing(null) }
  const createMut = useMutation({ mutationFn: (d) => shiftApi.create(d), onSuccess: done })
  const updateMut = useMutation({ mutationFn: ({ id, ...d }) => shiftApi.update(id, d), onSuccess: done })
  const deleteMut = useMutation({
    mutationFn: (id) => shiftApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setDeleting(null) },
  })

  return (
    <div>
      <PageHeader icon={Clock} title="Shifts" subtitle="Working hours, breaks and grace periods — assign a shift to people once it’s set up."
        actions={<>
          {branches.length > 1 && (
            <Select className="w-auto min-w-44" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          {canManageEmployees && <Button icon={Plus} onClick={() => setEditing('new')}>Add shift</Button>}
        </>} />

      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
        : shifts.length === 0 ? (
          <Card><EmptyState icon={Clock} title="No shifts yet" description="Add a shift, then assign people to it."
            action={canManageEmployees && <Button icon={Plus} onClick={() => setEditing('new')}>Add shift</Button>} /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shifts.map((shift) => {
              const hrs = workingHours(shift.start_time, shift.end_time, shift.break_minutes)
              const color = shift.color || '#2a78d6'
              return (
                <Card key={shift.id} padded={false} className="flex flex-col overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: color }} />
                  <div className="flex items-start gap-3 p-5 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: color }}>
                      {(shift.code || shift.name?.[0] || '?').slice(0, 3).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-semibold text-slate-900">{shift.name}</h3>
                      <p className="truncate text-xs text-slate-500">{shift.branch?.name ?? '—'}</p>
                    </div>
                    {canManageEmployees && (
                      <div className="flex gap-0.5">
                        <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(shift)} />
                        <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => setDeleting(shift)} />
                      </div>
                    )}
                  </div>
                  <div className="px-5 pb-4">
                    <p className="text-[22px] font-semibold tabular-nums tracking-tight text-slate-900">{hhmm(shift.start_time)} – {hhmm(shift.end_time)}</p>
                    <p className="text-xs text-slate-500">{hrs ? `${hrs} working` : ''}{shift.break_minutes ? ` · ${shift.break_minutes}m break` : ''} · {shift.grace_minutes ?? 0}m grace</p>
                  </div>
                  {canManageEmployees && (
                    <div className="mt-auto border-t border-slate-100 px-5 py-3">
                      <Button variant="soft" size="sm" icon={Users} onClick={() => setAssignShift(shift)}>Assign people</Button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

      <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <Info size={15} className="mt-0.5 shrink-0 text-blue-600" />
        <p>Rosters override the assigned shift for specific days. People without an assigned shift follow their branch’s default shift.</p>
      </div>

      {editing && (
        <ShiftModal
          initial={editing === 'new' ? null : editing}
          branches={branches}
          activeBranchId={activeBranchId}
          saving={createMut.isPending || updateMut.isPending}
          error={createMut.error || updateMut.error}
          onSave={(d) => (editing === 'new' ? createMut.mutate(d) : updateMut.mutate({ id: editing.id, ...d }))}
          onClose={() => { setEditing(null); createMut.reset(); updateMut.reset() }}
        />
      )}

      {deleting && (
        <Modal title="Delete shift" size="sm" onClose={() => { setDeleting(null); deleteMut.reset() }}
          footer={<>
            <Button variant="secondary" onClick={() => { setDeleting(null); deleteMut.reset() }}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleting.id)}>Delete</Button>
          </>}>
          <ErrorBanner error={deleteMut.error} className="mb-3" />
          <p className="text-[13px] text-slate-600">Delete <strong className="text-slate-900">{deleting.name}</strong>? This can’t be undone.</p>
        </Modal>
      )}

      {assignShift && <AssignShiftModal shift={assignShift} branches={branches} onClose={() => setAssignShift(null)} />}
    </div>
  )
}

function AssignShiftModal({ shift, branches, onClose }) {
  const [branchId, setBranchId] = useState(shift.branch_id ?? '')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toLocaleDateString('en-CA'))

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', 'for-shift-assign', branchId],
    queryFn: () => employeeApi.list({ branch_id: branchId || undefined, status: 'active', per_page: 200 }).then((r) => r.data?.data ?? []),
    enabled: !!branchId,
  })
  const mutation = useMutation({
    mutationFn: () => shiftApi.assignBulk(shift.id, { employee_ids: [...selected], effective_from: effectiveFrom }),
  })

  const filtered = (employees ?? []).filter((emp) => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(q) || emp.employee_code.toLowerCase().includes(q)
  })
  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleAll = () => setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((e) => e.id))))

  if (mutation.isSuccess) {
    return (
      <Modal size="sm" title={`Assigned ${shift.name}`} onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-700">
          <Check size={15} />{mutation.data?.data?.message ?? 'Shift assigned.'}
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Assign ${shift.name}`} subtitle={`${hhmm(shift.start_time)} – ${hhmm(shift.end_time)}`} onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={selected.size === 0} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Assign {selected.size || ''} {selected.size === 1 ? 'person' : 'people'}
        </Button>
      </>}>
      <div className="space-y-3">
        <ErrorBanner error={mutation.error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Branch">
            <Select value={branchId} onChange={(e) => { setBranchId(e.target.value); setSelected(new Set()) }}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Effective from"><Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></Field>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
          {!branchId ? <p className="py-8 text-center text-[13px] text-slate-400">Pick a branch to list its people.</p>
            : isLoading ? <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
            : filtered.length === 0 ? <p className="py-8 text-center text-[13px] text-slate-400">No one found.</p>
            : (
              <ul className="divide-y divide-slate-100">
                <li>
                  <label className="flex cursor-pointer items-center gap-2.5 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleAll} className="h-4 w-4 accent-blue-600" />
                    Select all ({filtered.length})
                  </label>
                </li>
                {filtered.map((emp) => (
                  <li key={emp.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50">
                      <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggle(emp.id)} className="h-4 w-4 accent-blue-600" />
                      <span className="text-[13px] font-medium text-slate-800">{emp.first_name} {emp.last_name}</span>
                      <span className="text-xs text-slate-400">{emp.employee_code}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
    </Modal>
  )
}
