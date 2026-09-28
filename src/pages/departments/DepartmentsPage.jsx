import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, Network, Users, Briefcase, CornerDownRight } from 'lucide-react'
import { departmentApi, branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, IconButton, Modal, Field, Input, Select, Table, EmptyState, ErrorBanner, StatCard } from '@/components/ui/kit'

const TILE_TONES = ['bg-blue-50 text-blue-600', 'bg-violet-50 text-violet-600', 'bg-emerald-50 text-emerald-600', 'bg-amber-50 text-amber-700', 'bg-cyan-50 text-cyan-600', 'bg-rose-50 text-rose-600']
const tone = (name = '') => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TILE_TONES[h % TILE_TONES.length] }

function DepartmentModal({ initial, branches, departments, defaultBranch, onSave, onClose, saving, error }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [branchId, setBranchId] = useState(String(initial?.branch_id ?? defaultBranch ?? ''))
  const [parentId, setParentId] = useState(String(initial?.parent_department_id ?? ''))
  const parents = departments.filter((d) => String(d.branch_id) === branchId && d.id !== initial?.id)

  return (
    <Modal title={initial ? 'Edit department' : 'New department'} subtitle={initial ? initial.name : 'A functional unit within a branch.'} size="sm" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="dept-form" loading={saving}>{initial ? 'Save changes' : 'Create department'}</Button>
      </>}>
      <form id="dept-form" className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); onSave({ name: name.trim(), branch_id: branchId, parent_department_id: parentId || null }) }}>
        <ErrorBanner error={error} />
        <Field label="Department name" required>
          <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales, Vehicle Service" />
        </Field>
        <Field label="Branch" required>
          <Select required value={branchId} onChange={(e) => { setBranchId(e.target.value); setParentId('') }}>
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Reports into" hint="Optional — nest this department under another one in the same branch.">
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)} disabled={!branchId}>
            <option value="">None (top level)</option>
            {parents.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </Select>
        </Field>
      </form>
    </Modal>
  )
}

/** Departments per branch, with how many roles and people sit in each. */
export default function DepartmentsPage() {
  const qc = useQueryClient()
  const { canManageEmployees } = useRole()
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const [editing, setEditing] = useState(null) // null | 'new' | department
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState(activeBranch?.id ? String(activeBranch.id) : '')

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })
  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.data ?? [])

  const { data, isLoading } = useQuery({
    queryKey: ['departments', filterBranch],
    queryFn: () => departmentApi.list(filterBranch ? { branch_id: filterBranch } : {}).then((r) => r.data),
  })
  const all = data?.data ?? []
  const departments = search ? all.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())) : all

  const done = () => { qc.invalidateQueries({ queryKey: ['departments'] }); setEditing(null) }
  const createMut = useMutation({ mutationFn: departmentApi.create, onSuccess: done })
  const updateMut = useMutation({ mutationFn: ({ id, ...d }) => departmentApi.update(id, d), onSuccess: done })
  const deleteMut = useMutation({
    mutationFn: departmentApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setDeleting(null) },
  })

  const people = all.reduce((n, d) => n + (d.employees_count ?? 0), 0)
  const roles = all.reduce((n, d) => n + (d.designations_count ?? 0), 0)
  const closeEditor = () => { setEditing(null); createMut.reset(); updateMut.reset() }

  return (
    <div>
      <PageHeader icon={Network} title="Departments" subtitle="Functional units inside each branch — designations and people hang off these."
        actions={<>
          <Link to="/designations"><Button variant="secondary" icon={Briefcase}>Designations</Button></Link>
          {canManageEmployees && <Button icon={Plus} onClick={() => setEditing('new')}>Add department</Button>}
        </>} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Departments" value={all.length} icon={Network} tone="blue" hint={filterBranch ? branches.find((b) => String(b.id) === filterBranch)?.name : 'Across all branches'} />
        <StatCard label="Designations" value={roles} icon={Briefcase} tone="purple" hint="Roles defined in these departments" />
        <StatCard label="Active people" value={people} icon={Users} tone="green" hint={all.length ? `${(people / all.length).toFixed(1)} per department on average` : undefined} />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search departments" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {branches.length > 1 && (
            <Select className="w-auto min-w-44" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </Select>
          )}
        </div>

        {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> : (
          <Table rows={departments}
            empty={all.length === 0
              ? <EmptyState icon={Network} title="No departments yet" description="Add your first department to start organising people."
                  action={canManageEmployees && <Button icon={Plus} onClick={() => setEditing('new')}>Add department</Button>} />
              : <EmptyState icon={Search} title={`No departments match "${search}"`} />}
            columns={[
              { key: 'name', label: 'Department', render: (d) => (
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${tone(d.name)}`}>{d.name.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{d.name}</p>
                    {d.parent_department && (
                      <p className="flex items-center gap-1 text-xs text-slate-500"><CornerDownRight size={11} />{d.parent_department.name}</p>
                    )}
                  </div>
                </div>
              ) },
              { key: 'branch', label: 'Branch', render: (d) => <span className="whitespace-nowrap">{d.branch?.name ?? '—'}</span> },
              { key: 'roles', label: 'Designations', align: 'right', render: (d) => d.designations_count ?? 0 },
              { key: 'people', label: 'Active people', align: 'right', render: (d) => (
                <Link to={`/employees?department_id=${d.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-900 hover:text-blue-600">{d.employees_count ?? 0}</Link>
              ) },
              ...(canManageEmployees ? [{ key: 'actions', label: '', align: 'right', render: (d) => (
                <div className="flex justify-end gap-0.5">
                  <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(d)} />
                  <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => setDeleting(d)} />
                </div>
              ) }] : []),
            ]} />
        )}
        {departments.length > 0 && (
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing {departments.length} of {all.length} departments</p>
        )}
      </Card>

      {editing && (
        <DepartmentModal
          initial={editing === 'new' ? null : editing}
          branches={branches}
          departments={all}
          defaultBranch={filterBranch}
          saving={createMut.isPending || updateMut.isPending}
          error={createMut.error || updateMut.error}
          onClose={closeEditor}
          onSave={(d) => (editing === 'new' ? createMut.mutate(d) : updateMut.mutate({ id: editing.id, ...d }))}
        />
      )}

      {deleting && (
        <Modal title="Delete department" size="sm" onClose={() => { setDeleting(null); deleteMut.reset() }}
          footer={<>
            <Button variant="secondary" onClick={() => { setDeleting(null); deleteMut.reset() }}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleting.id)}>Delete</Button>
          </>}>
          <ErrorBanner error={deleteMut.error} className="mb-3" />
          <p className="text-[13px] text-slate-600">
            Delete <strong className="text-slate-900">{deleting.name}</strong> ({deleting.branch?.name})?
            {deleting.employees_count > 0 && ` ${deleting.employees_count} active ${deleting.employees_count === 1 ? 'person is' : 'people are'} still assigned to it.`}
            {' '}Designations linked to it are affected too.
          </p>
        </Modal>
      )}
    </div>
  )
}
