import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Shield, Pencil, Trash2, KeyRound, Users } from 'lucide-react'
import { userApi } from '@/lib/api/users'
import { branchApi } from '@/lib/api/departments'
import { employeeApi } from '@/lib/api/employees'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  PageHeader, Card, Button, IconButton, Modal, Field, Input, Select, Toggle, Tabs,
  StatusPill, EmptyState, ErrorBanner, Pagination, Table, Avatar,
} from '@/components/ui/kit'
import { cn } from '@/lib/utils'

const ROLE_TONES = {
  tenant_admin: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  branch_admin: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  hr: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  manager: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  employee: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

const SCOPE_LABELS = {
  company: 'Whole organisation',
  branch: 'Assigned branches',
  team: 'Reporting team',
  self: 'Own records',
}

function RoleBadge({ name, label }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
      ROLE_TONES[name] ?? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20')}>
      <Shield size={10} /> {label}
    </span>
  )
}

const TYPE_TABS = [
  { key: '', label: 'All accounts' },
  { key: 'system', label: 'System users' },
  { key: 'employee', label: 'Employee logins' },
]

function formatDate(value) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function UsersPage() {
  const qc = useQueryClient()
  const { isCompanyAdmin, user: me } = useRole()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users', page, search, filterType, filterRole, filterBranch, filterStatus],
    queryFn: () => userApi.list({
      page,
      search: search || undefined,
      type: filterType || undefined,
      role: filterRole || undefined,
      branch_id: filterBranch || undefined,
      status: filterStatus || undefined,
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const { data: roleOptions = [] } = useQuery({
    queryKey: ['role-options'],
    queryFn: () => userApi.roles().then((r) => r.data?.options ?? (r.data?.data ?? []).map((n) => ({ name: n, label: n }))),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? []),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })
  const deleteMutation = useMutation({ mutationFn: (id) => userApi.remove(id), onSuccess: () => { invalidate(); setConfirmDelete(null) } })
  const statusMutation = useMutation({ mutationFn: ({ id, is_active }) => userApi.update(id, { is_active }), onSuccess: invalidate })

  const users = data?.data ?? []
  const meta = data?.meta ?? {}

  const columns = [
    {
      key: 'user', label: 'User', render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{u.name}</p>
            <p className="text-xs text-slate-400 truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'roles', label: 'Role', render: (u) => (
        <div className="flex flex-wrap gap-1">
          {(u.roles ?? []).length === 0 && <span className="text-xs text-slate-400">No role</span>}
          {(u.roles ?? []).map((r, i) => <RoleBadge key={r} name={r} label={u.role_labels?.[i] ?? r} />)}
        </div>
      ),
    },
    {
      key: 'access', label: 'Access', render: (u) => (
        <div className="text-xs">
          <p className="text-slate-700">{SCOPE_LABELS[u.data_scope] ?? '—'}</p>
          <p className="text-slate-400">
            {u.data_scope === 'company'
              ? 'All branches'
              : [u.branch?.name, ...(u.extra_branches ?? []).map((b) => b.name)].filter(Boolean).join(', ') || 'All branches'}
          </p>
        </div>
      ),
    },
    {
      key: 'type', label: 'Type', render: (u) => (
        <StatusPill dot={false} tone={u.user_type === 'system' ? 'indigo' : 'teal'} label={u.user_type === 'system' ? 'System user' : 'Employee login'} />
      ),
    },
    { key: 'last_login_at', label: 'Last sign-in', render: (u) => <span className="text-xs text-slate-500">{formatDate(u.last_login_at)}</span> },
    {
      key: 'status', label: 'Status', render: (u) => (
        <Toggle checked={u.is_active !== false} disabled={u.id === me?.id || statusMutation.isPending}
          onChange={(v) => statusMutation.mutate({ id: u.id, is_active: v })} />
      ),
    },
    {
      key: 'actions', label: '', align: 'right', render: (u) => (
        <div className="flex justify-end gap-0.5">
          <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setModal({ mode: 'edit', user: u })} />
          {u.id !== me?.id && <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => setConfirmDelete(u)} />}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Users & access"
        subtitle={`Who can sign in and what they can do — ${meta.total ?? '…'} account${meta.total === 1 ? '' : 's'}`}
        actions={<Button icon={Plus} onClick={() => setModal({ mode: 'create' })}>Add user</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs tabs={TYPE_TABS} value={filterType} onChange={(k) => { setFilterType(k); setPage(1) }} />
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search name or email…" value={search} className="pl-9"
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <Select value={filterRole} className="w-auto" onChange={(e) => { setFilterRole(e.target.value); setPage(1) }}>
            <option value="">All roles</option>
            {roleOptions.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
          </Select>
          {branches.length > 1 && (
            <Select value={filterBranch} className="w-auto" onChange={(e) => { setFilterBranch(e.target.value); setPage(1) }}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Select value={filterStatus} className="w-auto" onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </Select>
        </div>
      </div>

      {isError && <ErrorBanner className="mb-4" message={error?.response?.status === 403 ? 'You are not allowed to manage users.' : undefined} error={error} />}

      <Card padded={false}>
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : (
          <Table columns={columns} rows={users}
            empty={<EmptyState icon={Users} title="No users match" description="Try a different filter, or add a new user." />} />
        )}
      </Card>
      <Pagination meta={meta} onPage={setPage} />

      {modal && (
        <UserModal mode={modal.mode} user={modal.user} roleOptions={roleOptions} branches={branches}
          canPickAnyBranch={isCompanyAdmin} onClose={() => setModal(null)} />
      )}

      {confirmDelete && (
        <ConfirmDialog danger title={`Delete ${confirmDelete.name}?`}
          message="They will be signed out everywhere and can no longer sign in. Their employee record (if any) is kept."
          confirmLabel="Delete user" isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}

function UserModal({ mode, user, roleOptions, branches, canPickAnyBranch, onClose }) {
  const qc = useQueryClient()
  const isEdit = mode === 'edit'
  const [form, setForm] = useState({
    user_type: user?.user_type ?? 'system',
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    password: '',
    role: user?.roles?.[0] ?? '',
    branch_id: user?.branch_id ?? (branches.length === 1 ? branches[0].id : ''),
    extra_branch_ids: (user?.extra_branches ?? []).map((b) => b.id),
    employee_id: user?.employee_id ?? '',
    is_active: user?.is_active !== false,
  })
  const isSystem = form.user_type === 'system'
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'for-user-link', form.branch_id],
    queryFn: () => employeeApi.list({ branch_id: form.branch_id || undefined, status: 'active', per_page: 200 }).then((r) => r.data?.data ?? []),
    enabled: !isSystem,
  })

  const assignable = useMemo(
    () => roleOptions.filter((r) => (isSystem ? r.name !== 'employee' : true)),
    [roleOptions, isSystem]
  )
  const selectedRole = roleOptions.find((r) => r.name === form.role)
  const needsBranch = selectedRole && selectedRole.data_scope !== 'company'

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? userApi.update(user.id, payload) : userApi.create(payload)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose() },
  })

  function submit(e) {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.password) delete payload.password
    payload.branch_id = payload.branch_id || null
    payload.employee_id = isSystem ? null : (payload.employee_id || null)
    payload.phone = payload.phone || null
    if (isEdit) delete payload.user_type
    if (!isEdit) delete payload.is_active
    mutation.mutate(payload)
  }

  function toggleExtraBranch(id) {
    set({ extra_branch_ids: form.extra_branch_ids.includes(id) ? form.extra_branch_ids.filter((b) => b !== id) : [...form.extra_branch_ids, id] })
  }

  return (
    <Modal size="lg" title={isEdit ? `Edit ${user.name}` : 'Add user'}
      subtitle="Role decides what they can do; branches decide where."
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="user-form" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create user'}</Button>
      </>}>
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <ErrorBanner error={mutation.error} />

        {!isEdit && (
          <div className="grid grid-cols-2 gap-2">
            {[
              ['system', 'System user', 'Admins, HR staff, accountants. Not in the employee directory.', 'border-indigo-500 bg-indigo-50/50'],
              ['employee', 'Employee login', 'Self-service access for a staff member, linked to their record.', 'border-teal-500 bg-teal-50/50'],
            ].map(([key, label, desc, activeClass]) => (
              <button key={key} type="button"
                onClick={() => set({ user_type: key, role: '', employee_id: '' })}
                className={cn('rounded-xl border-2 p-3 text-left transition-all',
                  form.user_type === key ? activeClass : 'border-slate-200 hover:border-slate-300')}>
                <p className="text-[13px] font-bold text-slate-800">{label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{desc}</p>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required><Input required value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Email" required><Input required type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Mobile" hint="Used for SMS / WhatsApp alerts"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label={isEdit ? 'Reset password' : 'Temporary password'} required={!isEdit}
            hint={isEdit ? 'Leave blank to keep. A reset signs them out everywhere.' : 'They will be asked to change it at first sign-in.'}>
            <div className="relative">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input required={!isEdit} type="password" minLength={8} className="pl-9" value={form.password}
                placeholder="Min 8 characters, letters & numbers" onChange={(e) => set({ password: e.target.value })} />
            </div>
          </Field>
          <Field label="Role" required hint={selectedRole ? `Sees: ${SCOPE_LABELS[selectedRole.data_scope]}` : undefined}>
            <Select required value={form.role} onChange={(e) => set({ role: e.target.value })}>
              <option value="">Select a role…</option>
              {assignable.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label="Home branch" hint={needsBranch ? 'Scoped roles only see their branches.' : 'Organisation-wide role.'}>
            <Select value={form.branch_id ?? ''} disabled={!canPickAnyBranch && branches.length <= 1}
              onChange={(e) => set({ branch_id: e.target.value, employee_id: '' })}>
              {canPickAnyBranch && <option value="">All branches (head office)</option>}
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          {!isSystem && (
            <Field label="Linked employee" required className="sm:col-span-2">
              <Select required value={form.employee_id ?? ''} onChange={(e) => set({ employee_id: e.target.value })}>
                <option value="">Select employee…</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>)}
              </Select>
            </Field>
          )}
        </div>

        {needsBranch && branches.length > 1 && (
          <Field label="Additional branches" hint="Give an area manager or regional HR access to more than one branch.">
            <div className="flex flex-wrap gap-2">
              {branches.filter((b) => String(b.id) !== String(form.branch_id)).map((b) => (
                <button type="button" key={b.id} onClick={() => toggleExtraBranch(b.id)}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    form.extra_branch_ids.includes(b.id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                  {b.name}
                </button>
              ))}
            </div>
          </Field>
        )}

        {isEdit && (
          <div className="rounded-xl border border-slate-200 p-3">
            <Toggle checked={form.is_active} onChange={(v) => set({ is_active: v })}
              label={form.is_active ? 'Account active' : 'Account deactivated'}
              description="Deactivated users are signed out immediately and cannot sign in." />
          </div>
        )}
      </form>
    </Modal>
  )
}

