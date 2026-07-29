import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, X, Save, Loader2, Search,
  Building2, Users, ChevronRight, AlertCircle,
} from 'lucide-react'
import { departmentApi, branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { cn } from '@/lib/utils'

const COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500',
  'bg-pink-500', 'bg-rose-500', 'bg-orange-500', 'bg-amber-500',
  'bg-teal-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-green-500',
]

function avatarColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % COLORS.length
  return COLORS[h]
}

// ─── Slide-over form panel ────────────────────────────────────────────────────

function DeptFormPanel({ initial, branches, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [branchId, setBranchId] = useState(initial?.branch_id ? String(initial.branch_id) : '')

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onCancel} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Building2 size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                {initial ? 'Edit Department' : 'New Department'}
              </h2>
              <p className="text-xs text-slate-400">{initial ? `Editing "${initial.name}"` : 'Add a new department'}</p>
            </div>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={(e) => { e.preventDefault(); onSave({ name, branch_id: branchId }) }}
          className="flex flex-col flex-1 overflow-y-auto"
        >
          <div className="flex-1 p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Department Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales, Vehicle Service"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all"
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all"
              >
                <option value="">— Select branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

function DeleteModal({ dept, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Delete Department</h3>
            <p className="text-sm text-slate-500 mt-1">
              Delete <strong className="text-slate-700">"{dept.name}"</strong>? This will also affect any designations linked to it.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
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

export default function DepartmentsPage() {
  const qc = useQueryClient()
  const { canManageEmployees } = useRole()
  const [formTarget, setFormTarget] = useState(null) // null=closed, 'new'=add, dept=edit
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')

  const activeBranch = useAuthStore((s) => s.activeBranch)
  // seed filter with active branch on first render
  const bid = filterBranch || activeBranch?.id || ''

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })

  useEffect(() => {
    if (!filterBranch && activeBranch?.id) setFilterBranch(String(activeBranch.id))
  }, [activeBranch?.id])

  const { data, isLoading } = useQuery({
    queryKey: ['departments', bid],
    queryFn: () => departmentApi.list(bid ? { branch_id: bid } : {}).then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: departmentApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setFormTarget(null) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => departmentApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setFormTarget(null) },
  })

  const deleteMut = useMutation({
    mutationFn: departmentApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setDeleteTarget(null) },
  })

  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.data ?? [])
  const allDepts = data?.data ?? []
  const departments = search
    ? allDepts.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : allDepts

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage functional units within your branches.</p>
        </div>
        {canManageEmployees && (
          <button
            onClick={() => setFormTarget('new')}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors shrink-0"
          >
            <Plus size={16} /> Add Department
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
            placeholder="Search departments…"
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 shadow-sm"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={String(b.id)}>{b.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm ml-auto">
          <Building2 size={15} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-700">{allDepts.length}</span>
          <span className="text-xs text-slate-400">total</span>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : allDepts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-20 text-center bg-white">
          <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="font-medium text-slate-500">No departments yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Add your first department to get started.</p>
          {canManageEmployees && (
            <button
              onClick={() => setFormTarget('new')}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={15} /> Add Department
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Designations</th>
                {canManageEmployees && (
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">
                    No results for "{search}"
                  </td>
                </tr>
              )}
              {departments.map((dept, idx) => (
                <tr key={dept.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-4 text-xs text-slate-400 font-medium">{idx + 1}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold shrink-0', avatarColor(dept.name))}>
                        {dept.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{dept.name}</p>
                        {dept.parentDepartment && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <ChevronRight size={10} /> {dept.parentDepartment.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {dept.branch ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        <Building2 size={11} />
                        {dept.branch.name}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      <Users size={11} />
                      {dept.designations?.length ?? 0} roles
                    </span>
                  </td>
                  {canManageEmployees && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setFormTarget(dept)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-100 transition-all"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(dept)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer count */}
          <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/60">
            <p className="text-xs text-slate-400">
              Showing <span className="font-medium text-slate-600">{departments.length}</span> of <span className="font-medium text-slate-600">{allDepts.length}</span> departments
            </p>
          </div>
        </div>
      )}

      {/* Form slide-over */}
      {formTarget !== null && (
        <DeptFormPanel
          initial={formTarget === 'new' ? null : formTarget}
          branches={branches}
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
          dept={deleteTarget}
          deleting={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
