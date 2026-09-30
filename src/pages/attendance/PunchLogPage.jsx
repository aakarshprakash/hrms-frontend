import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Fingerprint, RefreshCw, Link2, Smartphone, Monitor, ScanFace, FileCheck2, Search } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi } from '@/lib/api/departments'
import { employeeApi } from '@/lib/api/employees'
import { useRole } from '@/hooks/useRole'
import { dateLabel } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Modal, Field, Input, Select, Tabs, Table, StatusPill, EmptyState, ErrorBanner, Pagination } from '@/components/ui/kit'

const SOURCE_META = {
  biometric: { label: 'Device', icon: Fingerprint, tone: 'indigo' },
  mobile: { label: 'Mobile', icon: Smartphone, tone: 'teal' },
  web: { label: 'Web', icon: Monitor, tone: 'blue' },
  kiosk: { label: 'Kiosk', icon: ScanFace, tone: 'purple' },
  regularization: { label: 'Regularized', icon: FileCheck2, tone: 'amber' },
  backfill: { label: 'Imported', icon: FileCheck2, tone: 'slate' },
  import: { label: 'Imported', icon: FileCheck2, tone: 'slate' },
}

function localTime(value) {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T'))
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}

export default function PunchLogPage() {
  const { can } = useRole()
  const [tab, setTab] = useState('log')
  const [reprocessing, setReprocessing] = useState(false)

  const { data: unmatched = [] } = useQuery({
    queryKey: ['unmatched-codes'],
    queryFn: () => attendanceApi.unmatchedCodes().then((r) => r.data?.data ?? []),
  })

  return (
    <div>
      <PageHeader icon={Fingerprint} title="Punch log"
        subtitle="Every punch exactly as received — daily attendance is derived from these and can be reprocessed at any time."
        actions={can('attendance.manage') && <Button variant="secondary" icon={RefreshCw} onClick={() => setReprocessing(true)}>Reprocess attendance</Button>} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[
        { key: 'log', label: 'Punches' },
        { key: 'unmatched', label: 'Unmapped device codes', count: unmatched.length },
      ]} />
      {tab === 'log' ? <PunchTable /> : <UnmatchedCodes codes={unmatched} />}
      {reprocessing && <ReprocessModal onClose={() => setReprocessing(false)} />}
    </div>
  )
}

function PunchTable() {
  // Default range: the last seven days.
  const [filters, setFilters] = useState(() => ({
    from: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    source: '',
    employee_id: '',
  }))
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'punch-filter', search],
    queryFn: () => employeeApi.list({ search: search || undefined, per_page: 20, status: 'active' }).then((r) => r.data?.data ?? []),
    enabled: search.length >= 2,
  })
  const { data, isLoading } = useQuery({
    queryKey: ['raw-punches', filters, page],
    queryFn: () => attendanceApi.rawPunches({ ...filters, source: filters.source || undefined, employee_id: filters.employee_id || undefined, page }).then((r) => r.data),
    placeholderData: (p) => p,
  })
  const set = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1) }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="date" className="w-auto" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        <Input type="date" className="w-auto" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        <Select className="w-auto" value={filters.source} onChange={(e) => set({ source: e.target.value })}>
          <option value="">All sources</option>
          {Object.entries(SOURCE_META).filter(([k]) => k !== 'import').map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </Select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="w-56 pl-8" placeholder="Filter by employee…" value={search} onChange={(e) => { setSearch(e.target.value); if (!e.target.value) set({ employee_id: '' }) }} />
          {search.length >= 2 && !filters.employee_id && employees.length > 0 && (
            <div className="absolute z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {employees.map((e) => (
                <button key={e.id} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => { set({ employee_id: e.id }); setSearch(`${e.first_name} ${e.last_name}`) }}>
                  {e.first_name} {e.last_name} <span className="text-xs text-slate-400">{e.employee_code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <Card padded={false}>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
          <Table rows={data?.data ?? []} empty={<EmptyState icon={Fingerprint} title="No punches in this range" />}
            columns={[
              { key: 'when', label: 'Punched at (local)', render: (p) => <span className="font-medium text-slate-800">{localTime(p.punched_at_local)}</span> },
              { key: 'employee', label: 'Employee', render: (p) => p.employee
                ? <div><p className="text-slate-800">{p.employee.first_name} {p.employee.last_name}</p><p className="text-xs text-slate-400">{p.employee.employee_code}</p></div>
                : <span className="text-xs text-amber-700">Unmapped code {p.device_emp_code}</span> },
              { key: 'source', label: 'Source', render: (p) => {
                const m = SOURCE_META[p.source] ?? SOURCE_META.import
                return <StatusPill tone={m.tone} dot={false} label={m.label} />
              } },
              { key: 'code', label: 'Device code', render: (p) => <span className="font-mono text-xs text-slate-500">{p.device_emp_code ?? '—'}</span> },
              { key: 'branch', label: 'Branch', render: (p) => <span className="text-xs text-slate-500">{p.branch?.name}</span> },
              { key: 'day', label: 'Counted on', render: (p) => p.attendance_date ? dateLabel(p.attendance_date, { day: 'numeric', month: 'short' }) : <span className="text-xs text-slate-400">not yet</span> },
            ]} />
        )}
      </Card>
      <Pagination meta={data?.meta} onPage={setPage} />
    </>
  )
}

function UnmatchedCodes({ codes }) {
  const [mapping, setMapping] = useState(null)
  if (codes.length === 0) {
    return <Card><EmptyState icon={Link2} title="Every device code is mapped" description="Punches from codes that aren't linked to an employee appear here, so no attendance is lost." /></Card>
  }
  return (
    <Card padded={false}>
      <Table rows={codes} rowKey="device_emp_code"
        columns={[
          { key: 'device_emp_code', label: 'Device code', render: (c) => <span className="font-mono font-semibold text-slate-800">{c.device_emp_code}</span> },
          { key: 'branch', label: 'Branch' },
          { key: 'punches', label: 'Punches', align: 'right' },
          { key: 'seen', label: 'Seen', render: (c) => <span className="text-xs text-slate-500">{localTime(c.first_seen)} → {localTime(c.last_seen)}</span> },
          { key: 'map', label: '', align: 'right', render: (c) => <Button size="sm" icon={Link2} onClick={() => setMapping(c)}>Map to employee</Button> },
        ]} />
      {mapping && <MapCodeModal code={mapping} onClose={() => setMapping(null)} />}
    </Card>
  )
}

function MapCodeModal({ code, onClose }) {
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = useState('')
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'map-code', code.branch_id],
    queryFn: () => employeeApi.list({ branch_id: code.branch_id, status: 'active', per_page: 200 }).then((r) => r.data?.data ?? []),
  })
  const map = useMutation({
    mutationFn: () => attendanceApi.mapDeviceCode(employeeId, { device_emp_code: code.device_emp_code }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['unmatched-codes'] }); qc.invalidateQueries({ queryKey: ['raw-punches'] }); onClose() },
  })
  return (
    <Modal size="sm" title={`Map device code ${code.device_emp_code}`} subtitle="Its punches are linked to the employee and their attendance is processed immediately." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={map.isPending} disabled={!employeeId} onClick={() => map.mutate()}>Map & process</Button></>}>
      <div className="space-y-3">
        <ErrorBanner error={map.error} />
        <Field label={`Employee at ${code.branch}`}>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code}){e.biometric_emp_code ? ` — currently ${e.biometric_emp_code}` : ''}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

function ReprocessModal({ onClose }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ from: today.slice(0, 8) + '01', to: today, branch_id: '' })
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? []) })
  const run = useMutation({
    mutationFn: () => attendanceApi.reprocess({ ...form, branch_id: form.branch_id || undefined }),
    onSuccess: () => qc.invalidateQueries(),
  })
  return (
    <Modal size="sm" title="Reprocess attendance" subtitle="Re-derives days from stored punches with current shifts, rosters and leave. Manual entries and payroll-locked days are left untouched." onClose={onClose}
      footer={run.isSuccess
        ? <Button onClick={onClose}>Done</Button>
        : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={RefreshCw} loading={run.isPending} onClick={() => run.mutate()}>Reprocess</Button></>}>
      {run.isSuccess ? (
        <p className="text-sm text-slate-700">{run.data.data.message}</p>
      ) : (
        <div className="space-y-3">
          <ErrorBanner error={run.error} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><Input type="date" value={form.from} max={today} onChange={(e) => setForm({ ...form, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={form.to} max={today} onChange={(e) => setForm({ ...form, to: e.target.value })} /></Field>
          </div>
          {branches.length > 1 && (
            <Field label="Branch">
              <Select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">All my branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          )}
        </div>
      )}
    </Modal>
  )
}
