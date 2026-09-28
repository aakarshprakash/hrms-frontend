import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Search, Users, Activity, PauseCircle, Sparkles, LogIn } from 'lucide-react'
import { platformApi } from '@/lib/api/platform'
import { enterSupportMode } from '@/lib/session'
import { Spinner } from '@/components/ui/Spinner'
import {
  PageHeader, Card, Button, Modal, Field, Input, Select, StatusPill, StatCard, Table, Pagination, EmptyState, ErrorBanner, Toggle,
} from '@/components/ui/kit'

export default function PlatformDashboardPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [industry, setIndustry] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [entering, setEntering] = useState(null)

  const { data: stats } = useQuery({ queryKey: ['platform-stats'], queryFn: () => platformApi.stats().then((r) => r.data.data) })
  const { data: industries } = useQuery({ queryKey: ['platform-industries'], queryFn: () => platformApi.industries().then((r) => r.data) })
  const { data, isLoading } = useQuery({
    queryKey: ['platform-companies', search, status, industry, page],
    queryFn: () => platformApi.companies({ search: search || undefined, status: status || undefined, industry: industry || undefined, page }).then((r) => r.data),
    placeholderData: (p) => p,
  })

  const industryLabel = Object.fromEntries((industries?.data ?? []).map((i) => [i.key, i.label]))

  async function openSupport(company) {
    setEntering(company.id)
    try {
      await enterSupportMode(company.id)
      navigate('/dashboard')
    } finally {
      setEntering(null)
    }
  }

  const columns = [
    {
      key: 'name', label: 'Organisation', render: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white">
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{c.name} {c.is_demo && <span className="ml-1 rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">DEMO</span>}</p>
            <p className="text-xs text-slate-400 truncate">{c.slug} · {c.email ?? 'no email'}</p>
          </div>
        </div>
      ),
    },
    { key: 'industry', label: 'Industry', render: (c) => <span className="text-xs text-slate-600">{industryLabel[c.industry] ?? c.industry}</span> },
    { key: 'branches_count', label: 'Branches', align: 'right' },
    { key: 'active_employees_count', label: 'Employees', align: 'right' },
    { key: 'users_count', label: 'Users', align: 'right' },
    { key: 'status', label: 'Status', render: (c) => <StatusPill status={c.status} /> },
    { key: 'created_at', label: 'Since', render: (c) => <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</span> },
    {
      key: 'actions', label: '', align: 'right', render: (c) => (
        <Button size="sm" variant="secondary" icon={LogIn} loading={entering === c.id}
          disabled={c.status !== 'active'}
          onClick={(e) => { e.stopPropagation(); openSupport(c) }}>Open</Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader icon={Sparkles} title="Platform console"
        subtitle="Every organisation on Peoplenex — onboarding, health and support access."
        actions={<Button icon={Plus} onClick={() => setCreating(true)}>New organisation</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Organisations" value={stats?.companies} icon={Building2} hint={stats ? `${stats.new_this_month} new this month` : undefined} />
        <StatCard label="Active" value={stats?.active} icon={Activity} tone="green" />
        <StatCard label="Suspended" value={stats?.suspended} icon={PauseCircle} tone="red" />
        <StatCard label="Employees managed" value={stats?.employees?.toLocaleString()} icon={Users} tone="purple" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search organisations…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select className="w-auto" value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1) }}>
          <option value="">All industries</option>
          {(industries?.data ?? []).map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
        </Select>
        <Select className="w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      <Card padded={false}>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
          <Table columns={columns} rows={data?.data ?? []} onRowClick={(c) => navigate(`/platform/companies/${c.id}`)}
            empty={<EmptyState icon={Building2} title="No organisations yet" description="Create the first one to get started."
              action={<Button icon={Plus} size="sm" onClick={() => setCreating(true)}>New organisation</Button>} />} />
        )}
      </Card>
      <Pagination meta={data?.meta} onPage={setPage} />

      {creating && <CreateCompanyModal industries={industries?.data ?? []} onClose={() => setCreating(false)} />}
    </div>
  )
}

function CreateCompanyModal({ industries, onClose }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    company_name: '', industry: 'automotive', city: '', state: '', branch_name: 'Head Office', email: '', phone: '',
    admin_name: '', admin_email: '', admin_password: '', apply_template: true,
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const mutation = useMutation({
    mutationFn: (payload) => platformApi.createCompany(payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['platform-companies'] })
      qc.invalidateQueries({ queryKey: ['platform-stats'] })
      navigate(`/platform/companies/${res.data.data.company.id}`)
    },
  })

  return (
    <Modal size="lg" title="New organisation" subtitle="Creates the organisation, its first branch and the tenant admin login in one step."
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={mutation.isPending} onClick={() => mutation.mutate(form)}>Create organisation</Button>
      </>}>
      <div className="space-y-5">
        <ErrorBanner error={mutation.error} />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Organisation</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required><Input value={form.company_name} onChange={(e) => set({ company_name: e.target.value })} placeholder="Velocity Motors Pvt Ltd" /></Field>
            <Field label="Industry" required hint="Sets starter departments, shifts, leave & pay components — all editable later.">
              <Select value={form.industry} onChange={(e) => set({ industry: e.target.value })}>
                {industries.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
              </Select>
            </Field>
            <Field label="First branch"><Input value={form.branch_name} onChange={(e) => set({ branch_name: e.target.value })} /></Field>
            <Field label="City"><Input value={form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field label="State"><Input value={form.state} onChange={(e) => set({ state: e.target.value })} placeholder="Kerala" /></Field>
            <Field label="Contact phone"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          </div>
          <div className="mt-3">
            <Toggle checked={form.apply_template} onChange={(v) => set({ apply_template: v })}
              label="Apply industry starter template" description="Recommended. Skip only if you'll configure everything by hand." />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tenant admin</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required><Input value={form.admin_name} onChange={(e) => set({ admin_name: e.target.value })} /></Field>
            <Field label="Email" required><Input type="email" value={form.admin_email} onChange={(e) => set({ admin_email: e.target.value })} /></Field>
            <Field label="Temporary password" required hint="Min 8 characters with letters and numbers.">
              <Input type="password" value={form.admin_password} onChange={(e) => set({ admin_password: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  )
}
