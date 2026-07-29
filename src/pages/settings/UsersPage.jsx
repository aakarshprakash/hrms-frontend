import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Shield, Pencil, Trash2, X, KeyRound } from 'lucide-react'
import { userApi } from '@/lib/api/users'
import { branchApi } from '@/lib/api/departments'
import { employeeApi } from '@/lib/api/employees'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const ROLE_STYLES = {
  super_admin: 'bg-purple-100 text-purple-700',
  branch_admin: 'bg-blue-100 text-blue-700',
  hr: 'bg-teal-100 text-teal-700',
  manager: 'bg-amber-100 text-amber-700',
  employee: 'bg-slate-100 text-slate-600',
}

function RoleBadge({ role }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize', ROLE_STYLES[role] ?? 'bg-slate-100 text-slate-600')}>
      <Shield size={10} />
      {role?.replace(/_/g, ' ')}
    </span>
  )
}

const TYPE_TABS = [
  { key: '', label: 'All Accounts' },
  { key: 'system', label: 'System Users' },
  { key: 'employee', label: 'Employee Logins' },
]

export default function UsersPage() {
  const qc = useQueryClient()
  const { isSuperAdmin } = useRole()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // null | { mode: 'create' } | { mode: 'edit', user }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users', page, search, filterType, filterRole, filterBranch],
    queryFn: () => userApi.list({
      page,
      search: search || undefined,
      type: filterType || undefined,
      role: filterRole || undefined,
      branch_id: filterBranch || undefined,
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userApi.roles().then((r) => r.data?.data ?? []),
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => userApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const users = data?.data ?? []
  const meta = data?.meta ?? {}

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Control who can sign in and what they can do — {meta.total ?? '—'} user{meta.total === 1 ? '' : 's'}
          </p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Type tabs — the two user bases are managed separately */}
      <div className="mb-4 flex rounded-xl bg-slate-100 p-1 w-fit">
        {TYPE_TABS.map((tab) => (
          <button key={tab.key}
            onClick={() => { setFilterType(tab.key); setPage(1) }}
            className={cn(
              'rounded-lg px-4 py-1.5 text-[13px] font-medium transition-all',
              filterType === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by name or email…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-md border bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <select value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setPage(1) }}
          className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
          <option value="">All Roles</option>
          {(rolesData ?? []).map((r) => <option key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</option>)}
        </select>
        {isSuperAdmin && (
          <select value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setPage(1) }}
            className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="">All Branches</option>
            {(branchesData?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error?.response?.status === 403 ? 'You are not allowed to manage users.' : 'Failed to load users.'}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Account Type</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Linked Employee</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No users found.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-xs font-bold shrink-0">
                        {u.name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
                      u.user_type === 'system'
                        ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
                        : 'bg-teal-50 text-teal-700 ring-teal-600/20'
                    )}>
                      {u.user_type === 'system' ? 'System User' : 'Employee Login'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).length === 0 && <span className="text-xs text-slate-400">no role</span>}
                      {(u.roles ?? []).map((r) => <RoleBadge key={r} role={r} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.branch?.name ?? (u.is_super_admin ? 'All branches' : '—')}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.employee ? `${u.employee.first_name} ${u.employee.last_name} (${u.employee.employee_code})` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ mode: 'edit', user: u })}
                        className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Delete user "${u.name}"? They will no longer be able to sign in.`)) deleteMutation.mutate(u.id) }}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Page {meta.current_page} of {meta.last_page}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-md border px-3 py-1 hover:bg-slate-50 disabled:opacity-40">Prev</button>
            <button disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}
              className="rounded-md border px-3 py-1 hover:bg-slate-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user}
          roles={rolesData ?? []}
          branches={branchesData?.data ?? []}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function UserModal({ mode, user, roles, branches, isSuperAdmin, onClose }) {
  const qc = useQueryClient()
  const isEdit = mode === 'edit'
  const [form, setForm] = useState({
    user_type: user?.user_type ?? 'system',
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.roles?.[0] ?? (user?.user_type === 'employee' ? 'employee' : 'branch_admin'),
    branch_id: user?.branch_id ?? '',
    employee_id: user?.employee_id ?? '',
  })
  const isSystem = form.user_type === 'system'

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'for-user-link', form.branch_id],
    queryFn: () => employeeApi.list({ branch_id: form.branch_id || undefined, status: 'active' }).then((r) => r.data?.data ?? []),
    enabled: !isSystem,
  })

  const mutation = useMutation({
    mutationFn: (payload) => isEdit ? userApi.update(user.id, payload) : userApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })

  function submit(e) {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.password) delete payload.password
    if (!payload.branch_id) payload.branch_id = null
    if (!payload.employee_id) payload.employee_id = null
    if (isSystem) payload.employee_id = null
    if (isEdit) delete payload.user_type
    mutation.mutate(payload)
  }

  function setType(type) {
    setForm((f) => ({
      ...f,
      user_type: type,
      // Keep the role consistent with the base being created
      role: type === 'system'
        ? (['employee'].includes(f.role) ? 'branch_admin' : f.role)
        : (['super_admin'].includes(f.role) ? 'employee' : f.role),
      employee_id: type === 'system' ? '' : f.employee_id,
    }))
  }

  const assignableRoles = roles
    .filter((r) => isSuperAdmin || r !== 'super_admin')
    .filter((r) => (isSystem ? r !== 'employee' : r !== 'super_admin'))
  const field = 'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-slate-900">{isEdit ? `Edit User — ${user.name}` : 'Add User'}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          {mutation.isError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {mutation.error?.response?.data?.message ?? 'Something went wrong.'}
              {mutation.error?.response?.data?.errors && (
                <ul className="mt-1 list-disc list-inside">
                  {Object.values(mutation.error.response.data.errors).flat().map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Account type — fixed after creation so the bases never mix */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Type</label>
            {isEdit ? (
              <span className={cn(
                'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset',
                isSystem ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' : 'bg-teal-50 text-teal-700 ring-teal-600/20'
              )}>
                {isSystem ? 'System User (solution operator)' : 'Employee Login (self-service)'}
              </span>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setType('system')}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all',
                    isSystem ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'
                  )}>
                  <p className="text-[13px] font-bold text-slate-800">System User</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Operates the HRMS — admins, HR staff, managers. Not listed in the employee directory.</p>
                </button>
                <button type="button" onClick={() => setType('employee')}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all',
                    !isSystem ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'
                  )}>
                  <p className="text-[13px] font-bold text-slate-800">Employee Login</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Self-service access for a staff member — must be linked to an employee record.</p>
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input required className={field} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input required type="email" className={field} value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isEdit ? 'New Password' : 'Password'}{!isEdit && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input required={!isEdit} type="password" minLength={8}
                  placeholder={isEdit ? 'Leave blank to keep current' : 'Min 8 characters'}
                  className={cn(field, 'pl-9')} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role <span className="text-red-500">*</span></label>
              <select required className={field} value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {assignableRoles.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            {isSuperAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
                <select className={field} value={form.branch_id ?? ''}
                  onChange={(e) => setForm({ ...form, branch_id: e.target.value, employee_id: '' })}>
                  <option value="">All branches (HQ)</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-400">Branch admins, HR and managers should be scoped to a branch.</p>
              </div>
            )}
            {!isSystem && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Linked Employee <span className="text-red-500">*</span>
                </label>
                <select required className={field} value={form.employee_id ?? ''}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                  <option value="">Select employee…</option>
                  {(employeesData ?? []).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
