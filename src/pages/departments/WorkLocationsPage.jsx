import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Search, MapPinned } from 'lucide-react'
import { workLocationApi, branchApi } from '@/lib/api/departments'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, IconButton, Modal, Field, Input, Select, Table, Toggle, EmptyState, ErrorBanner, StatusPill } from '@/components/ui/kit'

const TYPES = { office: 'Office', site: 'Site / plant', client: 'Client location', remote: 'Remote / home' }
const TYPE_TONES = { office: 'blue', site: 'amber', client: 'purple', remote: 'teal' }

function LocationModal({ initial, branches, onSave, onClose, saving, error }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '', code: initial?.code ?? '', type: initial?.type ?? 'office',
    branch_id: String(initial?.branch_id ?? ''), address: initial?.address ?? '', city: initial?.city ?? '',
    state: initial?.state ?? '', is_active: initial?.is_active ?? true,
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  function submit(e) {
    e.preventDefault()
    const payload = { ...form, name: form.name.trim() }
    for (const k of ['code', 'address', 'city', 'state', 'branch_id']) if (payload[k] === '') payload[k] = null
    onSave(payload)
  }

  return (
    <Modal title={initial ? 'Edit work location' : 'New work location'} subtitle="Where people are based — picked on each employee’s record." onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="wl-form" loading={saving}>{initial ? 'Save changes' : 'Add location'}</Button>
      </>}>
      <form id="wl-form" className="space-y-4" onSubmit={submit}>
        <ErrorBanner error={error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" required className="sm:col-span-2">
            <Input required autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Head Office, Kochi Showroom, Remote" />
          </Field>
          <Field label="Code"><Input value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="HO" className="font-mono uppercase" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => set({ type: e.target.value })}>
              {Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Branch" hint="Optional — leave blank if any branch can use it.">
            <Select value={form.branch_id} onChange={(e) => set({ branch_id: e.target.value })}>
              <option value="">Any branch</option>
              {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </Select>
          </Field>
        </div>
        {form.type !== 'remote' && (
          <>
            <Field label="Address"><Input value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City"><Input value={form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="State"><Input value={form.state} onChange={(e) => set({ state: e.target.value })} /></Field>
            </div>
          </>
        )}
        <Toggle checked={form.is_active} onChange={(is_active) => set({ is_active })} label="Active"
          description="Inactive locations stay on existing records but can’t be picked for new ones." />
      </form>
    </Modal>
  )
}

/** Master list of work locations used on employee records. */
export default function WorkLocationsPage() {
  const qc = useQueryClient()
  const { can } = useRole()
  const editable = can('departments.manage')
  const [editing, setEditing] = useState(null) // null | 'new' | location
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')

  const { data: branchesData } = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []) })
  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.data ?? [])

  const { data: all = [], isLoading } = useQuery({ queryKey: ['work-locations'], queryFn: () => workLocationApi.list().then((r) => r.data.data) })
  const rows = all.filter((l) => !search || `${l.name} ${l.code ?? ''} ${l.city ?? ''}`.toLowerCase().includes(search.toLowerCase()))

  const done = () => { qc.invalidateQueries({ queryKey: ['work-locations'] }); setEditing(null) }
  const createMut = useMutation({ mutationFn: workLocationApi.create, onSuccess: done })
  const updateMut = useMutation({ mutationFn: ({ id, ...d }) => workLocationApi.update(id, d), onSuccess: done })
  const deleteMut = useMutation({ mutationFn: workLocationApi.remove, onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-locations'] }); setDeleting(null) } })

  const columns = [
    { key: 'name', label: 'Location', render: (l) => (
      <div>
        <span className="font-medium text-slate-900">{l.name}</span>
        {l.code && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-600">{l.code}</span>}
        {(l.city || l.state) && <p className="text-xs text-slate-500">{[l.city, l.state].filter(Boolean).join(', ')}</p>}
      </div>
    ) },
    { key: 'type', label: 'Type', render: (l) => <StatusPill tone={TYPE_TONES[l.type]} dot={false} label={TYPES[l.type] ?? l.type} /> },
    { key: 'branch', label: 'Branch', render: (l) => l.branch?.name ?? <span className="text-slate-400">Any</span> },
    { key: 'people', label: 'People', align: 'right', render: (l) => l.employees_count ?? 0 },
    { key: 'status', label: 'Status', render: (l) => <StatusPill status={l.is_active ? 'active' : 'inactive'} /> },
    ...(editable ? [{ key: 'actions', label: '', align: 'right', render: (l) => (
      <div className="flex justify-end gap-0.5">
        <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(l)} />
        <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => setDeleting(l)} />
      </div>
    ) }] : []),
  ]

  return (
    <div>
      <PageHeader icon={MapPinned} title="Work Locations" subtitle="Offices, sites, client locations and remote — the list HR picks from on each employee."
        actions={editable && <Button icon={Plus} onClick={() => setEditing('new')}>Add location</Button>} />

      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
        : all.length === 0 ? (
          <Card>
            <EmptyState icon={MapPinned} title="No work locations yet" description="Add the places your people work from, then pick one on each employee."
              action={editable && <Button icon={Plus} onClick={() => setEditing('new')}>Add location</Button>} />
          </Card>
        ) : (
          <Card padded={false}>
            <div className="border-b border-slate-100 p-3">
              <div className="relative max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Search locations" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <Table rows={rows} columns={columns} empty={<EmptyState icon={Search} title="Nothing matches your search" />} />
          </Card>
        )}

      {editing && (
        <LocationModal initial={editing === 'new' ? null : editing} branches={branches}
          saving={createMut.isPending || updateMut.isPending} error={createMut.error || updateMut.error}
          onClose={() => { setEditing(null); createMut.reset(); updateMut.reset() }}
          onSave={(d) => (editing === 'new' ? createMut.mutate(d) : updateMut.mutate({ id: editing.id, ...d }))} />
      )}

      {deleting && (
        <Modal title="Delete work location" size="sm" onClose={() => { setDeleting(null); deleteMut.reset() }}
          footer={<>
            <Button variant="secondary" onClick={() => { setDeleting(null); deleteMut.reset() }}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleting.id)}>Delete</Button>
          </>}>
          <ErrorBanner error={deleteMut.error} className="mb-3" />
          <p className="text-[14px] text-slate-600">Delete <strong className="text-slate-900">{deleting.name}</strong>?</p>
        </Modal>
      )}
    </div>
  )
}
