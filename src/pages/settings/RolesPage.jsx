import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Shield, ShieldCheck, Lock, Pencil, Trash2, X, Users } from 'lucide-react'
import api from '@/lib/api/axios'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const roleApi = {
  list: () => api.get('/roles/manage'),
  permissions: () => api.get('/permissions'),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  remove: (id) => api.delete(`/roles/${id}`),
}

const prettify = (name) => name.replace(/_/g, ' ')

export default function RolesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // { mode: 'create' } | { mode: 'edit', role }

  const { data: rolesData, isLoading, isError } = useQuery({
    queryKey: ['roles-manage'],
    queryFn: () => roleApi.list().then((r) => r.data?.data ?? []),
  })

  const { data: catalog } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: () => roleApi.permissions().then((r) => r.data?.data ?? []),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => roleApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles-manage'] }),
  })

  const roles = rolesData ?? []

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Roles & Permissions</h1>
            <p className="text-[13px] text-slate-500">
              Create custom roles and control exactly what each one can do.
            </p>
          </div>
        </div>
        <button onClick={() => setModal({ mode: 'create' })}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-600/25 transition-all hover:bg-purple-700 active:scale-[0.98]">
          <Plus size={16} strokeWidth={2.5} /> Create Role
        </button>
      </div>

      {deleteMutation.isError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {deleteMutation.error?.response?.data?.message ?? 'Could not delete the role.'}
        </div>
      )}

      {isLoading && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          Failed to load roles. Only a super admin can manage roles.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.id}
              className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-purple-200 hover:shadow-lg hover:shadow-purple-600/5">
              <div className="mb-3 flex items-start justify-between">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  role.is_locked ? 'bg-purple-50 text-purple-600' :
                  role.is_system ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600'
                )}>
                  {role.is_locked ? <Lock size={17} /> : <Shield size={17} />}
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!role.is_locked && (
                    <button onClick={() => setModal({ mode: 'edit', role })}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-purple-50 hover:text-purple-600" title="Edit permissions">
                      <Pencil size={14} />
                    </button>
                  )}
                  {!role.is_system && (
                    <button
                      onClick={() => { if (window.confirm(`Delete the "${prettify(role.name)}" role?`)) deleteMutation.mutate(role.id) }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete role">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[15px] font-bold capitalize text-slate-900">{prettify(role.name)}</p>
              <div className="mt-1 flex items-center gap-3 text-[12px] text-slate-400">
                <span className="inline-flex items-center gap-1"><Users size={12} /> {role.users_count} user{role.users_count === 1 ? '' : 's'}</span>
                <span>{role.is_locked ? 'Full access' : `${role.permissions.length} permission${role.permissions.length === 1 ? '' : 's'}`}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {role.is_locked ? (
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600 ring-1 ring-inset ring-purple-600/20">
                    All permissions — protected
                  </span>
                ) : (
                  <>
                    {role.permissions.slice(0, 4).map((p) => (
                      <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{p}</span>
                    ))}
                    {role.permissions.length > 4 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">+{role.permissions.length - 4} more</span>
                    )}
                    {role.permissions.length === 0 && (
                      <span className="text-[11px] text-slate-300">No permissions — self-service only</span>
                    )}
                  </>
                )}
              </div>

              {role.is_system && !role.is_locked && (
                <p className="mt-3 border-t border-slate-50 pt-2 text-[10px] text-slate-400">
                  Built-in role — permissions editable, cannot be renamed or deleted
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <RoleModal
          mode={modal.mode}
          role={modal.role}
          catalog={catalog ?? []}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function RoleModal({ mode, role, catalog, onClose }) {
  const qc = useQueryClient()
  const isEdit = mode === 'edit'
  const [name, setName] = useState(role ? prettify(role.name) : '')
  const [selected, setSelected] = useState(new Set(role?.permissions ?? []))

  const mutation = useMutation({
    mutationFn: (payload) => isEdit ? roleApi.update(role.id, payload) : roleApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles-manage'] })
      qc.invalidateQueries({ queryKey: ['roles'] })
      onClose()
    },
  })

  function toggle(perm) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(perm) ? next.delete(perm) : next.add(perm)
      return next
    })
  }

  function toggleGroup(perms) {
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = perms.every((p) => next.has(p.name))
      perms.forEach((p) => allOn ? next.delete(p.name) : next.add(p.name))
      return next
    })
  }

  function submit(e) {
    e.preventDefault()
    const payload = { permissions: [...selected] }
    if (!isEdit || !role.is_system) payload.name = name
    mutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            {isEdit ? `Edit Role — ${prettify(role.name)}` : 'Create Role'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            {mutation.isError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {mutation.error?.response?.data?.message ?? 'Something went wrong.'}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Role Name {(!isEdit || !role.is_system) && <span className="text-red-500">*</span>}
              </label>
              {isEdit && role.is_system ? (
                <p className="text-sm font-semibold capitalize text-slate-800">{prettify(role.name)} <span className="ml-1 text-[11px] font-normal text-slate-400">(built-in — name locked)</span></p>
              ) : (
                <input required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Attendance Manager, Payroll Officer"
                  className="w-full rounded-xl border-0 bg-slate-100/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-purple-500/60" />
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Permissions</label>
                <span className="text-[12px] text-slate-400">{selected.size} selected</span>
              </div>
              <div className="space-y-3">
                {catalog.map(({ group, permissions }) => {
                  const allOn = permissions.every((p) => selected.has(p.name))
                  return (
                    <div key={group} className="overflow-hidden rounded-xl border border-slate-200/80">
                      <button type="button" onClick={() => toggleGroup(permissions)}
                        className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-2.5 text-left transition-colors hover:bg-slate-100/80">
                        <span className="text-[13px] font-bold text-slate-700">{group}</span>
                        <span className={cn('text-[11px] font-semibold', allOn ? 'text-purple-600' : 'text-slate-400')}>
                          {allOn ? 'Deselect all' : 'Select all'}
                        </span>
                      </button>
                      <div className="divide-y divide-slate-50">
                        {permissions.map((perm) => (
                          <label key={perm.name}
                            className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-purple-50/40">
                            <input
                              type="checkbox"
                              checked={selected.has(perm.name)}
                              onChange={() => toggle(perm.name)}
                              className="h-4 w-4 rounded border-slate-300 text-purple-600 accent-purple-600"
                            />
                            <div className="min-w-0">
                              <p className="font-mono text-[12px] font-semibold text-slate-700">{perm.name}</p>
                              <p className="text-[12px] text-slate-400">{perm.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t px-5 py-4">
            <button type="button" onClick={onClose}
              className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-600/25 hover:bg-purple-700 disabled:opacity-60">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
