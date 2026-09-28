import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Plus, Pencil, Trash2, Lock, Check, Users } from 'lucide-react'
import api from '@/lib/api/axios'
import { Spinner } from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { PageHeader, Card, Button, IconButton, Modal, Field, Input, Textarea, StatusPill, ErrorBanner } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

const rolesApi = {
  list: () => api.get('/roles/manage'),
  catalog: () => api.get('/permissions'),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  remove: (id) => api.delete(`/roles/${id}`),
}

const SCOPE_TONES = { company: 'purple', branch: 'blue', team: 'amber', self: 'slate' }
const SCOPE_LABELS = { company: 'Whole organisation', branch: 'Assigned branches', team: 'Reporting team', self: 'Own records' }

export default function RolesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null) // null | { role?: object }
  const [deleting, setDeleting] = useState(null)

  const { data: roles = [], isLoading } = useQuery({ queryKey: ['roles-manage'], queryFn: () => rolesApi.list().then((r) => r.data.data) })
  const { data: catalog } = useQuery({ queryKey: ['permission-catalog'], queryFn: () => rolesApi.catalog().then((r) => r.data) })

  const deleteMutation = useMutation({
    mutationFn: (id) => rolesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles-manage'] }); qc.invalidateQueries({ queryKey: ['role-options'] }); setDeleting(null) },
  })

  const builtIn = roles.filter((r) => r.is_system)
  const custom = roles.filter((r) => !r.is_system)

  return (
    <div>
      <PageHeader icon={ShieldCheck} title="Roles & permissions"
        subtitle="Permissions decide what a role can do. Data scope decides whose records it sees."
        actions={<Button icon={Plus} onClick={() => setEditing({})}>New role</Button>} />

      {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your custom roles</h2>
            {custom.length === 0 ? (
              <Card className="text-center">
                <p className="text-sm text-slate-600">No custom roles yet.</p>
                <p className="mt-1 text-xs text-slate-400">Create one when a built-in role doesn't fit — e.g. an Accountant who only needs payroll, or a Showroom Supervisor.</p>
                <Button className="mt-3" size="sm" icon={Plus} onClick={() => setEditing({})}>Create a role</Button>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {custom.map((role) => (
                  <RoleCard key={role.id} role={role} catalog={catalog}
                    onEdit={() => setEditing({ role })} onDelete={() => setDeleting(role)} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Built-in roles</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {builtIn.map((role) => <RoleCard key={role.id} role={role} catalog={catalog} />)}
            </div>
          </section>
        </div>
      )}

      {editing && <RoleEditor role={editing.role} catalog={catalog} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog danger title={`Delete "${deleting.label}"?`}
          message={deleting.users_count > 0 ? 'This role is still assigned to users — reassign them first.' : 'This cannot be undone.'}
          confirmLabel="Delete role" isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.id)} onCancel={() => setDeleting(null)} />
      )}
      {deleteMutation.isError && <ErrorBanner className="mt-4" error={deleteMutation.error} />}
    </div>
  )
}

function RoleCard({ role, catalog, onEdit, onDelete }) {
  const total = (catalog?.data ?? []).reduce((n, g) => n + g.permissions.length, 0)
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">{role.label}</h3>
            {role.is_system && <Lock size={13} className="text-slate-400" title="Built-in" />}
          </div>
          {role.description && <p className="mt-0.5 text-xs text-slate-500">{role.description}</p>}
        </div>
        {onEdit && (
          <div className="flex shrink-0">
            <IconButton icon={Pencil} label="Edit" tone="primary" onClick={onEdit} />
            <IconButton icon={Trash2} label="Delete" tone="danger" onClick={onDelete} />
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusPill tone={SCOPE_TONES[role.data_scope]} label={SCOPE_LABELS[role.data_scope]} />
        <span className="text-xs text-slate-500">
          {role.all_permissions ? 'All permissions' : `${role.permissions.length}${total ? ` / ${total}` : ''} permissions`}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400"><Users size={12} /> {role.users_count}</span>
      </div>
    </Card>
  )
}

function RoleEditor({ role, catalog, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: role?.label ?? '',
    description: role?.description ?? '',
    data_scope: role?.data_scope ?? 'branch',
    permissions: role?.permissions ?? [],
  })
  const selected = useMemo(() => new Set(form.permissions), [form.permissions])

  const mutation = useMutation({
    mutationFn: (payload) => (role ? rolesApi.update(role.id, payload) : rolesApi.create(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles-manage'] })
      qc.invalidateQueries({ queryKey: ['role-options'] })
      onClose()
    },
  })

  const toggle = (name) => setForm((f) => ({
    ...f, permissions: selected.has(name) ? f.permissions.filter((p) => p !== name) : [...f.permissions, name],
  }))
  const toggleGroup = (group) => {
    const names = group.permissions.map((p) => p.name)
    const all = names.every((n) => selected.has(n))
    setForm((f) => ({ ...f, permissions: all ? f.permissions.filter((p) => !names.includes(p)) : [...new Set([...f.permissions, ...names])] }))
  }

  return (
    <Modal size="xl" title={role ? `Edit role — ${role.label}` : 'New role'} onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={mutation.isPending} onClick={() => mutation.mutate(form)}>{role ? 'Save role' : 'Create role'}</Button>
      </>}>
      <div className="space-y-5">
        <ErrorBanner error={mutation.error} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Role name" required><Input value={form.name} maxLength={50} placeholder="e.g. Accountant"
            onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={1} className="min-h-[38px]" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>

        <Field label="Data scope" hint="Whose records people with this role can see.">
          <div className="grid gap-2 sm:grid-cols-4">
            {(catalog?.data_scopes ?? []).map((s) => (
              <button key={s.value} type="button" onClick={() => setForm({ ...form, data_scope: s.value })}
                className={cn('rounded-xl border-2 px-3 py-2 text-left text-xs font-medium transition-all',
                  form.data_scope === s.value ? 'border-blue-500 bg-blue-50/60 text-blue-800' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Permissions</p>
          <div className="grid gap-3 md:grid-cols-2">
            {(catalog?.data ?? []).map((group) => {
              const names = group.permissions.map((p) => p.name)
              const count = names.filter((n) => selected.has(n)).length
              return (
                <div key={group.group} className="rounded-xl border border-slate-200">
                  <button type="button" onClick={() => toggleGroup(group)}
                    className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left">
                    <span className="text-sm font-semibold text-slate-800">{group.group}</span>
                    <span className="text-xs text-slate-400">{count}/{names.length}</span>
                  </button>
                  <div className="divide-y divide-slate-50">
                    {group.permissions.map((p) => (
                      <button key={p.name} type="button" onClick={() => toggle(p.name)}
                        className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50">
                        <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          selected.has(p.name) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300')}>
                          {selected.has(p.name) && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="text-xs text-slate-600">{p.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
