import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, X, Save, Loader2, Search,
  Building2, Briefcase, ChevronDown,
} from 'lucide-react'
import { departmentApi, designationApi, branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { cn } from '@/lib/utils'

const LEVEL_LABELS = { 1: 'Junior', 2: 'Mid', 3: 'Senior', 4: 'Lead', 5: 'Head' }
const LEVEL_COLORS = {
  1: 'bg-slate-100 text-slate-600',
  2: 'bg-blue-50 text-blue-700',
  3: 'bg-indigo-50 text-indigo-700',
  4: 'bg-violet-50 text-violet-700',
  5: 'bg-purple-50 text-purple-800',
}

const DEPT_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-teal-500', 'bg-cyan-500',
  'bg-violet-500', 'bg-rose-500', 'bg-orange-500', 'bg-emerald-500',
]
function deptColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % DEPT_COLORS.length
  return DEPT_COLORS[h]
}

// ─── Slide-over form ──────────────────────────────────────────────────────────

function DesigFormPanel({ initial, branches, departments, onSave, onCancel, saving }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [branchId, setBranchId] = useState(initial?.branch_id ? String(initial.branch_id) : '')
  const [deptId, setDeptId] = useState(initial?.department_id ? String(initial.department_id) : '')
  const [level, setLevel] = useState(String(initial?.level ?? '1'))

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onCancel} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
              <Briefcase size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                {initial ? 'Edit Designation' : 'New Designation'}
              </h2>
              <p className="text-xs text-slate-400">{initial ? `Editing "${initial.title}"` : 'Add a new job title'}</p>
            </div>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); onSave({ title, branch_id: branchId, department_id: deptId, level: Number(level) }) }}
          className="flex flex-col flex-1 overflow-y-auto"
        >
          <div className="flex-1 p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Job Title <span className="text-rose-500">*</span>
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sales Executive, Service Manager"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Branch <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15 focus:bg-white transition-all"
              >
                <option value="">— Select branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Department <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15 focus:bg-white transition-all"
              >
                <option value="">— Select department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Seniority Level</label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(String(l))}
                    className={cn(
                      'rounded-xl border py-2 text-xs font-semibold transition-all',
                      String(level) === String(l)
                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                    )}
                  >
                    {l}
                    <span className="block text-[10px] font-normal mt-0.5 opacity-80">{LEVEL_LABELS[l]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save Designation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({ target, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Delete Designation</h3>
            <p className="text-sm text-slate-500 mt-1">
              Delete <strong className="text-slate-700">"{target.title}"</strong>? Employees assigned this designation will be unlinked.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DesignationsPage() {
  const qc = useQueryClient()
  const { canManageEmployees } = useRole()
  const [formTarget, setFormTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [groupByDept, setGroupByDept] = useState(true)

  const activeBranch = useAuthStore((s) => s.activeBranch)
  const bid = filterBranch || activeBranch?.id || ''

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })

  useEffect(() => {
    if (!filterBranch && activeBranch?.id) setFilterBranch(String(activeBranch.id))
  }, [activeBranch?.id])
  const { data: deptsData } = useQuery({
    queryKey: ['departments', bid],
    queryFn: () => departmentApi.list(bid ? { branch_id: bid } : {}).then((r) => r.data),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['designations', bid],
    queryFn: () => designationApi.list(bid ? { branch_id: bid } : {}).then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: designationApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); setFormTarget(null) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => designationApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); setFormTarget(null) },
  })
  const deleteMut = useMutation({
    mutationFn: designationApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); setDeleteTarget(null) },
  })

  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.data ?? [])
  const departments = deptsData?.data ?? []
  const allDesigs = data?.data ?? []

  const filtered = allDesigs.filter((d) => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase())
    const matchDept = !filterDept || String(d.department_id) === filterDept
    return matchSearch && matchDept
  })

  // Group by department
  const grouped = departments.map((dept) => ({
    dept,
    items: filtered.filter((d) => d.department_id === dept.id),
  })).filter((g) => g.items.length > 0)

  // Ungrouped (items with no matching dept or dept filter off)
  const ungrouped = filtered.filter((d) => !departments.find((dep) => dep.id === d.department_id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Designations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Job titles and roles within your departments.</p>
        </div>
        {canManageEmployees && (
          <button
            onClick={() => setFormTarget('new')}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors shrink-0"
          >
            <Plus size={16} /> Add Designation
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 flex-1 min-w-[180px] max-w-sm shadow-sm">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designations…"
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        <select
          value={filterBranch}
          onChange={(e) => { setFilterBranch(e.target.value); setFilterDept('') }}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 shadow-sm"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={String(b.id)}>{b.name}</option>
          ))}
        </select>

        <select
          value={filterDept}
          onChange={(e) => { setFilterDept(e.target.value); if (e.target.value) setGroupByDept(false) }}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 shadow-sm"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>{d.name}</option>
          ))}
        </select>

        <button
          onClick={() => setGroupByDept((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium shadow-sm transition-colors',
            groupByDept
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          )}
        >
          <ChevronDown size={14} />
          Group by dept
        </button>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm ml-auto">
          <Briefcase size={15} className="text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">{allDesigs.length}</span>
          <span className="text-xs text-slate-400">total</span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
        </div>
      ) : allDesigs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-20 text-center bg-white">
          <Briefcase size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="font-medium text-slate-500">No designations yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Add job titles to organize roles within departments.</p>
          {canManageEmployees && (
            <button
              onClick={() => setFormTarget('new')}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus size={15} /> Add Designation
            </button>
          )}
        </div>
      ) : groupByDept && !filterDept ? (
        // Grouped view
        <div className="space-y-4">
          {grouped.map(({ dept, items }) => (
            <div key={dept.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Dept header */}
              <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white text-xs font-bold shrink-0', deptColor(dept.name))}>
                  {dept.name.charAt(0)}
                </div>
                <h3 className="font-semibold text-slate-800 text-sm">{dept.name}</h3>
                <span className="ml-auto rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  {items.length} {items.length === 1 ? 'role' : 'roles'}
                </span>
              </div>

              {/* Rows */}
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {items.map((d) => (
                    <DesigRow
                      key={d.id}
                      desig={d}
                      canManage={canManageEmployees}
                      onEdit={() => setFormTarget(d)}
                      onDelete={() => setDeleteTarget(d)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-500">Uncategorised</span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {ungrouped.map((d) => (
                    <DesigRow key={d.id} desig={d} canManage={canManageEmployees} onEdit={() => setFormTarget(d)} onDelete={() => setDeleteTarget(d)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // Flat table
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Level</th>
                {canManageEmployees && <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">No results match your filters.</td>
                </tr>
              )}
              {filtered.map((d, idx) => (
                <DesigRow key={d.id} desig={d} idx={idx} canManage={canManageEmployees} showDept showBranch onEdit={() => setFormTarget(d)} onDelete={() => setDeleteTarget(d)} />
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/60">
            <p className="text-xs text-slate-400">
              Showing <span className="font-medium text-slate-600">{filtered.length}</span> of <span className="font-medium text-slate-600">{allDesigs.length}</span> designations
            </p>
          </div>
        </div>
      )}

      {/* Form panel */}
      {formTarget !== null && (
        <DesigFormPanel
          initial={formTarget === 'new' ? null : formTarget}
          branches={branches}
          departments={departments}
          saving={createMut.isPending || updateMut.isPending}
          onCancel={() => setFormTarget(null)}
          onSave={(d) => {
            if (formTarget === 'new') createMut.mutate(d)
            else updateMut.mutate({ id: formTarget.id, ...d })
          }}
        />
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          deleting={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Shared row component ─────────────────────────────────────────────────────

function DesigRow({ desig: d, idx, canManage, showDept, showBranch, onEdit, onDelete }) {
  const level = d.level ?? 1
  return (
    <tr className="hover:bg-slate-50/70 transition-colors">
      {idx !== undefined && (
        <td className="px-5 py-4 text-xs text-slate-400 font-medium">{idx + 1}</td>
      )}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 shrink-0">
            <Briefcase size={14} className="text-indigo-600" />
          </div>
          <span className="font-semibold text-slate-900">{d.title}</span>
        </div>
      </td>
      {showDept && (
        <td className="px-5 py-4">
          {d.department ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              <Building2 size={10} />{d.department.name}
            </span>
          ) : <span className="text-slate-400">—</span>}
        </td>
      )}
      {showBranch && (
        <td className="px-5 py-4 text-xs text-slate-500">{d.branch?.name ?? '—'}</td>
      )}
      <td className="px-5 py-4">
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', LEVEL_COLORS[level] ?? LEVEL_COLORS[1])}>
          L{level} · {LEVEL_LABELS[level] ?? 'Custom'}
        </span>
      </td>
      {canManage && (
        <td className="px-5 py-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent hover:border-indigo-100 transition-all"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      )}
    </tr>
  )
}
