import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Clock, Check, X, Users } from 'lucide-react'
import { shiftApi } from '@/lib/api/shifts'
import { branchApi } from '@/lib/api/departments'
import { employeeApi } from '@/lib/api/employees'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

function toHHMM(val) {
  if (!val) return '—'
  return val.slice(0, 5)
}

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

function ShiftForm({ initial, branches, activeBranchId, onSave, onCancel, saving }) {
  const [name, setName]             = useState(initial?.name ?? '')
  const [branchId, setBranchId]     = useState(initial?.branch_id ?? activeBranchId ?? '')
  const [startTime, setStartTime]   = useState(initial?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime]       = useState(initial?.end_time?.slice(0, 5) ?? '18:00')
  const [breakMin, setBreakMin]     = useState(initial?.break_minutes ?? 30)
  const [graceMin, setGraceMin]     = useState(initial?.grace_minutes ?? 10)

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !branchId) return
    onSave({
      name: name.trim(),
      branch_id: Number(branchId),
      start_time: startTime,
      end_time: endTime,
      break_minutes: Number(breakMin),
      grace_minutes: Number(graceMin),
    })
  }

  const preview = workingHours(startTime, endTime, Number(breakMin))

  return (
    <form onSubmit={handleSubmit}
      className="rounded-xl border border-blue-200 bg-blue-50 p-5 mb-4">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-4">
        {initial ? 'Edit Shift' : 'New Shift'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Shift Name <span className="text-red-500">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="e.g. Morning Shift, Night Shift"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Branch <span className="text-red-500">*</span></label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Start Time <span className="text-red-500">*</span></label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">End Time <span className="text-red-500">*</span></label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Break (minutes)</label>
          <input type="number" min={0} max={120} value={breakMin} onChange={(e) => setBreakMin(e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Grace Period (minutes)</label>
          <input type="number" min={0} max={60} value={graceMin} onChange={(e) => setGraceMin(e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
          <p className="text-[10px] text-slate-400 mt-0.5">Check-ins within grace period are marked present (not late)</p>
        </div>
      </div>

      {/* Live preview */}
      {preview && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white border border-blue-200 px-3 py-2 text-xs text-slate-600">
          <Clock size={13} className="text-blue-500" />
          <span><strong>{toHHMM(startTime)}</strong> – <strong>{toHHMM(endTime)}</strong></span>
          <span className="text-slate-400">·</span>
          <span>{preview} working</span>
          {Number(breakMin) > 0 && <span className="text-slate-400">({breakMin}m break)</span>}
          {Number(graceMin) > 0 && <span className="text-slate-400">· {graceMin}m grace</span>}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {saving && <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {initial ? 'Save Changes' : 'Create Shift'}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function ShiftSettingsPage() {
  const qc = useQueryClient()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const { canManageEmployees } = useRole()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
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

  const createMut = useMutation({
    mutationFn: (d) => shiftApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setShowAdd(false) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => shiftApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setEditId(null) },
  })
  const deleteMut = useMutation({
    mutationFn: (id) => shiftApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  })

  const SHIFT_COLORS = [
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-teal-500',
    'bg-orange-500', 'bg-rose-500', 'bg-green-600', 'bg-slate-600',
  ]

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Shift Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Define work shifts — name, timings, break, and grace period — then assign them to employees below.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">{shifts.length} shift{shifts.length !== 1 ? 's' : ''}</p>
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            className="rounded-md border bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {canManageEmployees && !showAdd && !editId && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus size={15} /> Add Shift
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <ShiftForm
          branches={branches}
          activeBranchId={activeBranchId}
          onSave={(d) => createMut.mutate(d)}
          onCancel={() => setShowAdd(false)}
          saving={createMut.isPending}
        />
      )}

      {createMut.isError && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          {createMut.error?.response?.data?.message ?? 'Failed to create shift.'}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
      ) : shifts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center">
          <Clock size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">No shifts configured yet.</p>
          <p className="text-slate-400 text-xs mt-1">Add a shift to assign employees to work schedules.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shifts.map((shift, idx) => {
            const color = SHIFT_COLORS[idx % SHIFT_COLORS.length]
            const hrs = workingHours(shift.start_time, shift.end_time, shift.break_minutes)
            const isEditing = editId === shift.id

            if (isEditing) {
              return (
                <div key={shift.id} className="sm:col-span-2">
                  <ShiftForm
                    initial={shift}
                    branches={branches}
                    activeBranchId={activeBranchId}
                    onSave={(d) => updateMut.mutate({ id: shift.id, ...d })}
                    onCancel={() => setEditId(null)}
                    saving={updateMut.isPending}
                  />
                </div>
              )
            }

            return (
              <div key={shift.id}
                className="rounded-2xl border bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Color bar */}
                <div className={cn('h-1.5', color)} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-sm shrink-0', color)}>
                        {shift.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{shift.name}</h3>
                        <p className="text-xs text-slate-400">{shift.branch?.name ?? '—'}</p>
                      </div>
                    </div>
                    {canManageEmployees && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setAssignShift(shift)} title="Assign to employees"
                          className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                          <Users size={14} />
                        </button>
                        <button onClick={() => { setEditId(shift.id); setShowAdd(false) }}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => { if (confirm(`Delete "${shift.name}"? Employees assigned to this shift will be unaffected.`)) deleteMut.mutate(shift.id) }}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Time details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Start</p>
                      <p className="font-semibold text-slate-800">{toHHMM(shift.start_time)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">End</p>
                      <p className="font-semibold text-slate-800">{toHHMM(shift.end_time)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Break</p>
                      <p className="font-semibold text-slate-800">{shift.break_minutes ?? 0}m</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Grace</p>
                      <p className="font-semibold text-slate-800">{shift.grace_minutes ?? 0}m</p>
                    </div>
                  </div>

                  {hrs && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={11} />
                      <span>{hrs} net working time</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-1">
        <p><strong>Break minutes</strong> are subtracted from total hours when calculating daily working time and overtime.</p>
        <p><strong>Grace period</strong> — check-ins within this window after shift start are marked <em>present</em> rather than <em>late</em>.</p>
        <p>After creating a shift, click the <strong><Users size={11} className="inline -mt-0.5" /> people icon</strong> on its card to assign it to employees.</p>
      </div>

      {assignShift && (
        <AssignShiftModal shift={assignShift} branches={branches} onClose={() => setAssignShift(null)} />
      )}
    </div>
  )
}

function AssignShiftModal({ shift, branches, onClose }) {
  const [branchId, setBranchId] = useState(shift.branch_id ?? '')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [result, setResult] = useState(null)

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', 'for-shift-assign', branchId],
    queryFn: () => employeeApi.list({ branch_id: branchId || undefined, status: 'active', per_page: 200 }).then((r) => r.data?.data ?? []),
    enabled: !!branchId,
  })

  const mutation = useMutation({
    mutationFn: () => shiftApi.assignBulk(shift.id, { employee_ids: [...selected], effective_from: effectiveFrom }),
    onSuccess: (res) => setResult({ message: res.data?.message }),
    onError: (err) => setResult({ error: err.response?.data?.message ?? 'Could not assign the shift.' }),
  })

  const filtered = (employees ?? []).filter((emp) => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(q) || emp.employee_code.toLowerCase().includes(q)
  })

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => prev.size === filtered.length ? new Set() : new Set(filtered.map((e) => e.id)))
  }

  const field = 'w-full rounded-xl border-0 bg-slate-100/80 px-3.5 py-2 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-slate-900">Assign "{shift.name}" to Employees</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        {result ? (
          <div className="p-5">
            {result.error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-600">{result.error}</div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-700">
                <Check size={15} /> {result.message}
              </div>
            )}
            <button onClick={onClose} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 border-b p-5">
              <div className="grid grid-cols-2 gap-3">
                <select value={branchId} onChange={(e) => { setBranchId(e.target.value); setSelected(new Set()) }} className={field}>
                  <option value="">Select branch…</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={field} />
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees…" className={field} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {!branchId ? (
                <p className="py-8 text-center text-[13px] text-slate-400">Select a branch to list employees.</p>
              ) : isLoading ? (
                <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-slate-400">No employees found.</p>
              ) : (
                <>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-blue-600 hover:bg-blue-50">
                    <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleAll} className="h-4 w-4 accent-blue-600" />
                    Select all ({filtered.length})
                  </label>
                  {filtered.map((emp) => (
                    <label key={emp.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-slate-50">
                      <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggle(emp.id)} className="h-4 w-4 accent-blue-600" />
                      <span className="text-[13px] font-medium text-slate-700">{emp.first_name} {emp.last_name}</span>
                      <span className="text-[11px] text-slate-400">{emp.employee_code}</span>
                    </label>
                  ))}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t p-5">
              <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => mutation.mutate()} disabled={selected.size === 0 || mutation.isPending}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60">
                {mutation.isPending ? 'Assigning…' : `Assign to ${selected.size || ''} Employee${selected.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
