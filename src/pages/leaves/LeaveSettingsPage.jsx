import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react'
import { leaveApi } from '@/lib/api/leaves'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

function TypeForm({ initial, branches, activeBranchId, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [branchId, setBranchId] = useState(initial?.branch_id ?? activeBranchId ?? '')
  const [daysPerYear, setDaysPerYear] = useState(initial?.days_per_year ?? 12)
  const [carryForward, setCarryForward] = useState(initial?.carry_forward ?? false)
  const [paid, setPaid] = useState(initial?.paid ?? true)

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !branchId) return
    onSave({
      name: name.trim(),
      branch_id: Number(branchId),
      days_per_year: Number(daysPerYear),
      carry_forward: carryForward,
      paid,
    })
  }

  const isEdit = Boolean(initial)

  return (
    <form onSubmit={handleSubmit}
      className={cn('rounded-xl border p-4', isEdit ? 'bg-white' : 'bg-blue-50 border-blue-200 mb-4')}>
      {!isEdit && (
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">New Leave Type</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type Name <span className="text-red-500">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="e.g. Casual Leave, Sick Leave"
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
          <label className="block text-xs font-medium text-slate-600 mb-1">Days Per Year</label>
          <input type="number" min={0} max={365} value={daysPerYear}
            onChange={(e) => setDaysPerYear(e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <button type="button" onClick={() => setPaid((v) => !v)}
            className={cn('relative w-10 h-5 rounded-full transition-colors', paid ? 'bg-blue-600' : 'bg-slate-300')}>
            <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              paid ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
          <span className="text-sm text-slate-700">Paid Leave</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <button type="button" onClick={() => setCarryForward((v) => !v)}
            className={cn('relative w-10 h-5 rounded-full transition-colors', carryForward ? 'bg-blue-600' : 'bg-slate-300')}>
            <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              carryForward ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
          <span className="text-sm text-slate-700">Carry Forward</span>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {saving && <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {isEdit ? 'Save Changes' : 'Add Leave Type'}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function LeaveSettingsPage() {
  const qc = useQueryClient()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [filterBranch, setFilterBranch] = useState('')

  const { data: branchesRaw } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })
  const branches = Array.isArray(branchesRaw) ? branchesRaw : (branchesRaw?.data ?? [])

  const { data, isLoading } = useQuery({
    queryKey: ['leave-types', filterBranch],
    queryFn: () => leaveApi.listTypes(filterBranch ? { branch_id: filterBranch } : {}).then((r) => r.data?.data ?? r.data ?? []),
  })
  const types = Array.isArray(data) ? data : []

  const createMut = useMutation({
    mutationFn: (d) => leaveApi.createType(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); setShowAdd(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => leaveApi.updateType(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); setEditId(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => leaveApi.deleteType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  })

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Leave Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure leave types, entitlements, and policies per branch</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">{types.length} leave type{types.length !== 1 ? 's' : ''}</p>
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            className="rounded-md border bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {!showAdd && (
          <button onClick={() => { setShowAdd(true); setEditId(null) }}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus size={15} /> Add Leave Type
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <TypeForm
          branches={branches}
          activeBranchId={activeBranchId}
          onSave={(d) => createMut.mutate(d)}
          onCancel={() => setShowAdd(false)}
          saving={createMut.isPending}
        />
      )}

      {createMut.isError && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          {createMut.error?.response?.data?.message ?? 'Failed to create leave type.'}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
      ) : types.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center text-slate-400">
          No leave types configured yet.
        </div>
      ) : (
        <div className="space-y-3">
          {types.map((lt) => (
            <div key={lt.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
              {editId === lt.id ? (
                <div className="p-4">
                  <TypeForm
                    initial={lt}
                    branches={branches}
                    activeBranchId={activeBranchId}
                    onSave={(d) => updateMut.mutate({ id: lt.id, ...d })}
                    onCancel={() => setEditId(null)}
                    saving={updateMut.isPending}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Colour dot */}
                  <div className="h-9 w-9 rounded-full flex items-center justify-center bg-blue-100 text-blue-700 font-bold text-sm shrink-0">
                    {lt.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{lt.name}</p>
                    <p className="text-xs text-slate-500">{lt.branch?.name ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <div className="text-center">
                      <p className="font-bold text-slate-800">{lt.days_per_year ?? 0}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">days/yr</p>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                      lt.paid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    )}>
                      {lt.paid ? 'Paid' : 'Unpaid'}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                      lt.carry_forward ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                    )}>
                      {lt.carry_forward ? 'Carry Forward' : 'No Carry'}
                    </span>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => { setEditId(lt.id); setShowAdd(false) }}
                        className="rounded p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${lt.name}"? Existing leave requests using this type will be affected.`)) deleteMut.mutate(lt.id) }}
                        className="rounded p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-1">
        <p><strong>Days Per Year</strong> sets the annual entitlement used to populate employee leave balances.</p>
        <p><strong>Paid</strong> leaves count toward payroll; unpaid leaves deduct from salary.</p>
        <p><strong>Carry Forward</strong> allows unused balance to roll over to the next year.</p>
      </div>
    </div>
  )
}
