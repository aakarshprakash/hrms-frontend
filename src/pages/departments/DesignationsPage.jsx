import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, Briefcase, Network } from 'lucide-react'
import { departmentApi, designationApi, branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { PageHeader, Card, CardHeader, Button, IconButton, Modal, Field, Input, Select, Table, Tabs, EmptyState, ErrorBanner, StatusPill } from '@/components/ui/kit'

const LEVELS = { 1: 'Junior', 2: 'Mid', 3: 'Senior', 4: 'Lead', 5: 'Head' }
const LEVEL_TONES = { 1: 'slate', 2: 'blue', 3: 'indigo', 4: 'purple', 5: 'amber' }

const LevelPill = ({ level = 1 }) => <StatusPill tone={LEVEL_TONES[level] ?? 'slate'} dot={false} label={`L${level} · ${LEVELS[level] ?? 'Custom'}`} />

function DesignationModal({ initial, branches, departments, defaultBranch, onSave, onClose, saving, error }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [branchId, setBranchId] = useState(String(initial?.branch_id ?? defaultBranch ?? ''))
  const [deptId, setDeptId] = useState(String(initial?.department_id ?? ''))
  const [level, setLevel] = useState(Number(initial?.level ?? 1))
  const options = departments.filter((d) => String(d.branch_id) === branchId)

  return (
    <Modal title={initial ? 'Edit designation' : 'New designation'} subtitle={initial ? initial.title : 'A job title within a department.'} size="sm" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="desig-form" loading={saving}>{initial ? 'Save changes' : 'Create designation'}</Button>
      </>}>
      <form id="desig-form" className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); onSave({ title: title.trim(), branch_id: branchId, department_id: deptId, level }) }}>
        <ErrorBanner error={error} />
        <Field label="Job title" required>
          <Input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sales Executive, Service Manager" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Branch" required>
            <Select required value={branchId} onChange={(e) => { setBranchId(e.target.value); setDeptId('') }}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Department" required>
            <Select required value={deptId} onChange={(e) => setDeptId(e.target.value)} disabled={!branchId}>
              <option value="">{branchId ? 'Select department' : 'Pick a branch first'}</option>
              {options.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Seniority level">
          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(LEVELS).map(([l, label]) => (
              <button key={l} type="button" onClick={() => setLevel(Number(l))}
                className={cn('rounded-lg border py-1.5 text-center text-xs font-semibold transition-colors',
                  level === Number(l) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700')}>
                L{l}<span className="block text-[10px] font-normal opacity-80">{label}</span>
              </button>
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  )
}

/** Job titles per department, with seniority level and how many people hold each. */
export default function DesignationsPage() {
  const qc = useQueryClient()
  const { canManageEmployees } = useRole()
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const [editing, setEditing] = useState(null) // null | 'new' | designation
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState(activeBranch?.id ? String(activeBranch.id) : '')
  const [filterDept, setFilterDept] = useState('')
  const [view, setView] = useState('grouped')

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })
  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.data ?? [])

  // Every department once; the filter and the form both narrow it by branch.
  const { data: deptsData } = useQuery({
    queryKey: ['departments', ''],
    queryFn: () => departmentApi.list({}).then((r) => r.data),
  })
  const allDepartments = deptsData?.data ?? []
  const departments = filterBranch ? allDepartments.filter((d) => String(d.branch_id) === filterBranch) : allDepartments

  const { data, isLoading } = useQuery({
    queryKey: ['designations', filterBranch],
    queryFn: () => designationApi.list(filterBranch ? { branch_id: filterBranch } : {}).then((r) => r.data),
  })
  const all = data?.data ?? []
  const rows = all.filter((d) =>
    (!search || d.title.toLowerCase().includes(search.toLowerCase())) && (!filterDept || String(d.department_id) === filterDept))

  const groups = departments
    .map((dept) => ({ dept, items: rows.filter((d) => d.department_id === dept.id).sort((a, b) => (a.level ?? 1) - (b.level ?? 1)) }))
    .filter((g) => g.items.length > 0)
  const orphans = rows.filter((d) => !departments.some((dep) => dep.id === d.department_id))

  const done = () => { qc.invalidateQueries({ queryKey: ['designations'] }); qc.invalidateQueries({ queryKey: ['departments'] }); setEditing(null) }
  const createMut = useMutation({ mutationFn: designationApi.create, onSuccess: done })
  const updateMut = useMutation({ mutationFn: ({ id, ...d }) => designationApi.update(id, d), onSuccess: done })
  const deleteMut = useMutation({
    mutationFn: designationApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); setDeleting(null) },
  })

  const actions = canManageEmployees ? [{ key: 'actions', label: '', align: 'right', render: (d) => (
    <div className="flex justify-end gap-0.5">
      <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(d)} />
      <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => setDeleting(d)} />
    </div>
  ) }] : []
  const titleCol = { key: 'title', label: 'Title', render: (d) => <span className="font-medium text-slate-900">{d.title}</span> }
  const levelCol = { key: 'level', label: 'Level', render: (d) => <LevelPill level={d.level ?? 1} /> }
  const peopleCol = { key: 'people', label: 'People', align: 'right', render: (d) => d.employees_count ?? 0 }
  const multiBranch = !filterBranch && branches.length > 1

  return (
    <div>
      <PageHeader icon={Briefcase} title="Designations" subtitle="Job titles and seniority levels inside each department."
        actions={<>
          <Link to="/departments"><Button variant="secondary" icon={Network}>Departments</Button></Link>
          {canManageEmployees && <Button icon={Plus} onClick={() => setEditing('new')}>Add designation</Button>}
        </>} />

      <Card padded={false} className="mb-6">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search designations" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {branches.length > 1 && (
            <Select className="w-auto min-w-44" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setFilterDept('') }}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </Select>
          )}
          <Select className="w-auto min-w-44" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}{multiBranch && d.branch ? ` — ${d.branch.name}` : ''}</option>)}
          </Select>
          <Tabs variant="pills" className="ml-auto" value={view} onChange={setView}
            tabs={[{ key: 'grouped', label: 'By department' }, { key: 'list', label: 'List', count: rows.length }]} />
        </div>
      </Card>

      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
        : all.length === 0 ? (
          <Card>
            <EmptyState icon={Briefcase} title="No designations yet" description="Add job titles to organise roles within departments."
              action={canManageEmployees && <Button icon={Plus} onClick={() => setEditing('new')}>Add designation</Button>} />
          </Card>
        ) : view === 'list' ? (
          <Card padded={false}>
            <Table rows={rows} empty={<EmptyState icon={Search} title="Nothing matches your filters" />}
              columns={[titleCol,
                { key: 'dept', label: 'Department', render: (d) => d.department?.name ?? '—' },
                { key: 'branch', label: 'Branch', render: (d) => <span className="whitespace-nowrap">{d.branch?.name ?? '—'}</span> },
                levelCol, peopleCol, ...actions]} />
          </Card>
        ) : groups.length === 0 && orphans.length === 0 ? (
          <Card><EmptyState icon={Search} title="Nothing matches your filters" /></Card>
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {[...groups, ...(orphans.length ? [{ dept: { id: 'none', name: 'Unassigned' }, items: orphans }] : [])].map(({ dept, items }) => (
              <Card key={dept.id} padded={false}>
                <CardHeader title={dept.name} icon={Network}
                  subtitle={`${items.length} role${items.length === 1 ? '' : 's'} · ${items.reduce((n, d) => n + (d.employees_count ?? 0), 0)} people${multiBranch && dept.branch ? ` · ${dept.branch.name}` : ''}`} />
                <Table rows={items} columns={[titleCol, levelCol, peopleCol, ...actions]} />
              </Card>
            ))}
          </div>
        )}

      {editing && (
        <DesignationModal
          initial={editing === 'new' ? null : editing}
          branches={branches}
          departments={allDepartments}
          defaultBranch={filterBranch}
          saving={createMut.isPending || updateMut.isPending}
          error={createMut.error || updateMut.error}
          onClose={() => { setEditing(null); createMut.reset(); updateMut.reset() }}
          onSave={(d) => (editing === 'new' ? createMut.mutate(d) : updateMut.mutate({ id: editing.id, ...d }))}
        />
      )}

      {deleting && (
        <Modal title="Delete designation" size="sm" onClose={() => { setDeleting(null); deleteMut.reset() }}
          footer={<>
            <Button variant="secondary" onClick={() => { setDeleting(null); deleteMut.reset() }}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleting.id)}>Delete</Button>
          </>}>
          <ErrorBanner error={deleteMut.error} className="mb-3" />
          <p className="text-[13px] text-slate-600">
            Delete <strong className="text-slate-900">{deleting.title}</strong>
            {deleting.department && ` in ${deleting.department.name}`}?
            {deleting.employees_count > 0 && ` ${deleting.employees_count} active ${deleting.employees_count === 1 ? 'person holds' : 'people hold'} this title and will be unlinked.`}
          </p>
        </Modal>
      )}
    </div>
  )
}
