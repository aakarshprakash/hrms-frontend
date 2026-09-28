import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings2, Plus, Pencil, Trash2, Landmark, ShieldCheck, Receipt, HeartPulse, Scale, HandCoins, Power, Timer } from 'lucide-react'
import { salaryApi } from '@/lib/api/payroll'
import { branchApi } from '@/lib/api/departments'
import { overtimeApi } from '@/lib/api/overtime'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { money, MONTHS } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { PageHeader, Card, Button, IconButton, Modal, Field, Input, Select, Toggle, Tabs, Table, StatusPill, EmptyState, ErrorBanner } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

export default function PayrollSettingsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [branchId, setBranchId] = useState(activeBranchId ?? '')
  const [params] = useSearchParams()
  const [tab, setTab] = useState(['components', 'statutory', 'overtime'].includes(params.get('tab')) ? params.get('tab') : 'components')
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? []) })
  const effectiveBranch = branchId || branches[0]?.id

  return (
    <div>
      <PageHeader icon={Settings2} title="Pay settings"
        subtitle="How salaries are built, which statutory deductions apply and how overtime is paid — configured per branch."
        actions={branches.length > 1 && (
          <Select className="w-auto" value={effectiveBranch ?? ''} onChange={(e) => setBranchId(Number(e.target.value))}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )} />
      <Tabs className="mb-4" value={tab} onChange={setTab}
        tabs={[{ key: 'components', label: 'Pay components' }, { key: 'statutory', label: 'Statutory rules' }, { key: 'overtime', label: 'Overtime' }]} />
      {effectiveBranch && tab === 'components' && <ComponentsTab branchId={effectiveBranch} />}
      {effectiveBranch && tab === 'statutory' && <StatutoryTab branchId={effectiveBranch} />}
      {effectiveBranch && tab === 'overtime' && <OvertimeTab branchId={effectiveBranch} branchName={branches.find((b) => b.id === Number(effectiveBranch))?.name} />}
    </div>
  )
}

// ── Pay components ─────────────────────────────────────────────────────────

const FLAGS = [
  ['is_basic', 'Basic', 'The basic pay other percentages are based on.'],
  ['pf_applicable', 'PF wage', 'Counts towards PF wages.'],
  ['esi_applicable', 'ESI wage', 'Counts towards ESI wages.'],
  ['taxable', 'Taxable', 'Part of taxable income for TDS.'],
  ['prorate', 'Pro-rated', 'Reduced for loss-of-pay days.'],
  ['is_variable', 'Variable', 'Varies month to month (not projected for TDS / ESI eligibility).'],
]

function ComponentsTab({ branchId }) {
  const qc = useQueryClient()
  const { can } = useRole()
  const editable = can('payroll.manage')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data: components = [], isLoading } = useQuery({
    queryKey: ['salary-components', branchId],
    queryFn: () => salaryApi.listComponents({ branch_id: branchId }).then((r) => r.data?.data ?? []),
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['salary-components'] })
  const toggleActive = useMutation({ mutationFn: (c) => salaryApi.updateComponent(c.id, { is_active: !c.is_active }), onSuccess: invalidate })
  const remove = useMutation({ mutationFn: (id) => salaryApi.deleteComponent(id), onSuccess: () => { invalidate(); setDeleting(null) } })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <p className="text-sm text-slate-500">{components.length} component(s)</p>
        {editable && <Button size="sm" icon={Plus} onClick={() => setEditing({})}>Add component</Button>}
      </div>
      <ErrorBanner error={remove.error ?? toggleActive.error} className="m-4" />
      <Table rows={components} empty={<EmptyState title="No pay components" description="Add Basic, HRA and allowances, or apply an industry template." />}
        columns={[
          { key: 'name', label: 'Component', render: (c) => (
            <div className={cn(!c.is_active && 'opacity-50')}>
              <p className="font-medium text-slate-800">{c.name} {c.code && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{c.code}</span>}</p>
              <p className="text-xs text-slate-400">{c.structures_count ?? 0} employee line(s)</p>
            </div>
          ) },
          { key: 'type', label: 'Type', render: (c) => <StatusPill dot={false} tone={c.type === 'earning' ? 'green' : 'red'} label={c.type === 'earning' ? 'Earning' : 'Deduction'} /> },
          { key: 'calc', label: 'Calculation', render: (c) => <span className="text-sm text-slate-600">{c.calculation_type === 'percentage' ? `% of ${c.percentage_of === 'gross' ? 'gross' : 'basic'}` : 'Fixed amount'}</span> },
          { key: 'flags', label: 'Behaviour', render: (c) => (
            <div className="flex flex-wrap gap-1">
              {FLAGS.filter(([k]) => c[k]).map(([k, label]) => <span key={k} className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">{label}</span>)}
            </div>
          ) },
          { key: 'status', label: 'Status', render: (c) => <StatusPill status={c.is_active ? 'active' : 'inactive'} /> },
          ...(editable ? [{ key: 'actions', label: '', align: 'right', render: (c) => (
            <div className="flex justify-end">
              <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(c)} />
              <IconButton icon={Power} label={c.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleActive.mutate(c)} />
              {!c.structures_count && <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => setDeleting(c)} />}
            </div>
          ) }] : []),
        ]} />
      {editing && <ComponentModal branchId={branchId} component={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={invalidate} />}
      {deleting && <ConfirmDialog danger title={`Delete ${deleting.name}?`} message="It isn't used in any salary structure." confirmLabel="Delete"
        isPending={remove.isPending} onConfirm={() => remove.mutate(deleting.id)} onCancel={() => setDeleting(null)} />}
    </Card>
  )
}

function ComponentModal({ branchId, component, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: component?.name ?? '', code: component?.code ?? '', type: component?.type ?? 'earning',
    calculation_type: component?.calculation_type ?? 'fixed', percentage_of: component?.percentage_of ?? 'basic',
    is_basic: component?.is_basic ?? false, pf_applicable: component?.pf_applicable ?? false, esi_applicable: component?.esi_applicable ?? true,
    taxable: component?.taxable ?? true, prorate: component?.prorate ?? true, is_variable: component?.is_variable ?? false,
    display_order: component?.display_order ?? 100,
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, code: form.code || null }
      return component ? salaryApi.updateComponent(component.id, payload) : salaryApi.createComponent({ ...payload, branch_id: branchId })
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  function setType(type) {
    // Deductions default to flat amounts outside wages and tax.
    set(type === 'deduction'
      ? { type, is_basic: false, pf_applicable: false, esi_applicable: false, taxable: false, prorate: false }
      : { type, esi_applicable: true, taxable: true, prorate: true })
  }

  return (
    <Modal size="lg" title={component ? `Edit ${component.name}` : 'New pay component'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!form.name} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={save.error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" required className="sm:col-span-2"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Washing Allowance" /></Field>
          <Field label="Code"><Input value={form.code} maxLength={20} className="font-mono uppercase" onChange={(e) => set({ code: e.target.value })} placeholder="WASH" /></Field>
          <Field label="Type"><Select value={form.type} onChange={(e) => setType(e.target.value)}><option value="earning">Earning</option><option value="deduction">Deduction</option></Select></Field>
          <Field label="Calculation"><Select value={form.calculation_type} onChange={(e) => set({ calculation_type: e.target.value })}><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option></Select></Field>
          {form.calculation_type === 'percentage' && (
            <Field label="Percentage of"><Select value={form.percentage_of} onChange={(e) => set({ percentage_of: e.target.value })}><option value="basic">Basic</option><option value="gross">Gross (fixed earnings)</option></Select></Field>
          )}
        </div>
        <div className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
          {FLAGS.map(([key, label, description]) => (
            <Toggle key={key} checked={!!form[key]} onChange={(v) => set({ [key]: v })} label={label} description={description}
              disabled={form.type === 'deduction' && ['is_basic', 'pf_applicable'].includes(key)} />
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ── Statutory rules ────────────────────────────────────────────────────────

const RULES = [
  { type: 'PF', title: 'Provident Fund', icon: Landmark, blurb: 'Employee 12% and employer 12% (EPS 8.33% + EPF) of PF wages, up to the wage ceiling.' },
  { type: 'ESI', title: 'Employees\' State Insurance', icon: HeartPulse, blurb: 'Employee 0.75% and employer 3.25% for gross wages up to ₹21,000.' },
  { type: 'PT', title: 'Professional Tax', icon: Receipt, blurb: 'State slabs — monthly or half-yearly depending on the state.' },
  { type: 'TAX', title: 'Income tax (TDS)', icon: Scale, blurb: 'Monthly TDS on projected annual income, per each employee\'s tax regime.' },
  { type: 'LWF', title: 'Labour Welfare Fund', icon: HandCoins, blurb: 'Fixed employee / employer contributions in the months your state specifies.' },
]

function StatutoryTab({ branchId }) {
  const qc = useQueryClient()
  const { can } = useRole()
  const editable = can('payroll.manage')
  const [editing, setEditing] = useState(null)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['statutory-rules', branchId],
    queryFn: () => salaryApi.listStatutory({ branch_id: branchId }).then((r) => r.data?.data ?? []),
  })
  const byType = Object.fromEntries(rules.map((r) => [r.rule_type, r]))
  const toggle = useMutation({
    mutationFn: (rule) => salaryApi.updateStatutory(rule.id, { is_active: !rule.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statutory-rules'] }),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {RULES.map(({ type, title, icon: Icon, blurb }) => {
        const rule = byType[type]
        return (
          <Card key={type} className="flex flex-col">
            <div className="flex items-start gap-3">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', rule?.is_active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400')}><Icon size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  {rule ? <StatusPill status={rule.is_active ? 'active' : 'inactive'} label={rule.is_active ? 'Applied' : 'Off'} /> : <StatusPill tone="slate" label="Not set up" />}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{blurb}</p>
                {rule && <p className="mt-2 text-xs text-slate-600">{summarize(type, rule.config_json ?? {})}</p>}
              </div>
            </div>
            {editable && (
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant={rule ? 'secondary' : 'primary'} icon={rule ? Pencil : Plus} onClick={() => setEditing({ type, rule })}>{rule ? 'Configure' : 'Set up'}</Button>
                {rule && <Button size="sm" variant="ghost" icon={ShieldCheck} onClick={() => toggle.mutate(rule)}>{rule.is_active ? 'Turn off' : 'Turn on'}</Button>}
              </div>
            )}
          </Card>
        )
      })}
      {editing && <RuleModal branchId={branchId} type={editing.type} rule={editing.rule} onClose={() => setEditing(null)} />}
    </div>
  )
}

function summarize(type, c) {
  switch (type) {
    case 'PF': return `${c.employee_rate ?? 12}% / ${c.employer_rate ?? 12}% · ceiling ${money(c.wage_ceiling ?? 15000)}${c.restrict_to_ceiling === false ? ' (contribute on full wage)' : ''}`
    case 'ESI': return `${c.employee_rate ?? 0.75}% / ${c.employer_rate ?? 3.25}% · up to ${money(c.wage_ceiling ?? 21000)}`
    case 'PT': return `${c.state ?? 'Custom'} · ${c.basis === 'half_yearly' ? `half-yearly (deducted ${(c.months ?? []).map((m) => MONTHS[m - 1]?.slice(0, 3)).join(' & ')})` : 'monthly'} · ${(c.slabs ?? []).length} slab(s)`
    case 'TAX': return c.slabs && c.mode !== 'income_tax' ? `Custom slabs (legacy) · ${c.slabs.length} slab(s)` : 'Income-tax rules for each employee\'s regime (new / old)'
    case 'LWF': return `Employee ${money(c.employee_amount ?? 0)} · employer ${money(c.employer_amount ?? 0)} · ${(c.months ?? []).map((m) => MONTHS[m - 1]?.slice(0, 3)).join(', ')}`
    default: return ''
  }
}

function RuleModal({ branchId, type, rule, onClose }) {
  const qc = useQueryClient()
  const [config, setConfig] = useState(rule?.config_json ?? null)

  const { data: defaults } = useQuery({
    queryKey: ['statutory-defaults', type],
    queryFn: () => salaryApi.statutoryDefaults({ type }).then((r) => r.data),
    enabled: !rule || type === 'PT',
  })
  const current = config ?? defaults?.data ?? {}
  const set = (patch) => setConfig({ ...current, ...patch })

  const save = useMutation({
    mutationFn: () => rule
      ? salaryApi.updateStatutory(rule.id, { config_json: current })
      : salaryApi.createStatutory({ branch_id: branchId, rule_type: type, config_json: current, is_active: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['statutory-rules'] }); onClose() },
  })

  async function pickState(state) {
    const res = await salaryApi.statutoryDefaults({ type: 'PT', state })
    setConfig(res.data.data)
  }

  const num = (key, label, hint) => (
    <Field label={label} hint={hint}><Input type="number" step="0.01" value={current[key] ?? ''} onChange={(e) => set({ [key]: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
  )

  return (
    <Modal size="lg" title={`${RULES.find((r) => r.type === type).title}`} subtitle="Applies to this branch's payroll from the next run you process." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save rule</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={save.error} />
        {type === 'PF' && (
          <div className="grid gap-4 sm:grid-cols-3">
            {num('wage_ceiling', 'Wage ceiling (₹)')}
            {num('employee_rate', 'Employee %')}
            {num('employer_rate', 'Employer %', 'Split into EPS + EPF')}
            {num('eps_rate', 'EPS %')}
            {num('edli_rate', 'EDLI %')}
            {num('admin_rate', 'Admin charges %')}
            <div className="sm:col-span-3"><Toggle checked={current.restrict_to_ceiling !== false} onChange={(v) => set({ restrict_to_ceiling: v })}
              label="Contribute on wages up to the ceiling" description="Turn off to contribute on the full PF wage (EPS always stays on the ceiling)." /></div>
          </div>
        )}
        {type === 'ESI' && (
          <div className="grid gap-4 sm:grid-cols-3">
            {num('wage_ceiling', 'Eligibility ceiling (₹)')}
            {num('employee_rate', 'Employee %')}
            {num('employer_rate', 'Employer %')}
          </div>
        )}
        {type === 'PT' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="State" hint="Loads that state's slabs; you can then adjust them.">
                <Select value={current.state ?? ''} onChange={(e) => pickState(e.target.value)}>
                  <option value="">Custom</option>
                  {(defaults?.pt_states ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Basis">
                <Select value={current.basis ?? 'monthly'} onChange={(e) => set({ basis: e.target.value })}>
                  <option value="monthly">Monthly (on the month's gross)</option>
                  <option value="half_yearly">Half-yearly (on six months' gross)</option>
                </Select>
              </Field>
            </div>
            {current.basis === 'half_yearly' && (
              <Field label="Deduct in months">
                <div className="flex flex-wrap gap-1.5">
                  {MONTHS.map((m, i) => {
                    const on = (current.months ?? []).includes(i + 1)
                    return <button type="button" key={m} onClick={() => set({ months: on ? current.months.filter((x) => x !== i + 1) : [...(current.months ?? []), i + 1] })}
                      className={cn('rounded-lg border px-2 py-1 text-xs', on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500')}>{m.slice(0, 3)}</button>
                  })}
                </div>
              </Field>
            )}
            <SlabEditor slabs={current.slabs ?? []} onChange={(slabs) => set({ slabs })} />
          </>
        )}
        {type === 'TAX' && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>TDS is computed each month from the employee's projected annual taxable income under their chosen regime (set on the employee profile), including standard deduction, the section 87A rebate and marginal relief, surcharge and 4% cess — less tax already deducted this financial year.</p>
            {current.slabs && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                This branch still uses custom slabs from the earlier setup (annualised gross, no deductions or cess).
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => setConfig({ mode: 'income_tax' })}>Switch to income-tax rules</Button>
              </div>
            )}
          </div>
        )}
        {type === 'LWF' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {num('employee_amount', 'Employee contribution (₹)')}
            {num('employer_amount', 'Employer contribution (₹)')}
            <Field label="Deduct in months" className="sm:col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {MONTHS.map((m, i) => {
                  const on = (current.months ?? []).includes(i + 1)
                  return <button type="button" key={m} onClick={() => set({ months: on ? current.months.filter((x) => x !== i + 1) : [...(current.months ?? []), i + 1] })}
                    className={cn('rounded-lg border px-2 py-1 text-xs', on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500')}>{m.slice(0, 3)}</button>
                })}
              </div>
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}

function SlabEditor({ slabs, onChange }) {
  const update = (i, idx, value) => onChange(slabs.map((s, j) => (j === i ? s.map((v, k) => (k === idx ? (value === '' ? null : Number(value)) : v)) : s)))
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Income from (₹)</span><span>Up to (₹, blank = no limit)</span><span>Tax (₹)</span><span />
      </div>
      {slabs.map((slab, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 border-t border-slate-100 px-3 py-1.5">
          <Input type="number" value={slab[0] ?? ''} onChange={(e) => update(i, 0, e.target.value)} />
          <Input type="number" value={slab[1] ?? ''} onChange={(e) => update(i, 1, e.target.value)} />
          <Input type="number" value={slab[2] ?? ''} onChange={(e) => update(i, 2, e.target.value)} />
          <IconButton icon={Trash2} label="Remove slab" tone="danger" onClick={() => onChange(slabs.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div className="border-t border-slate-100 px-3 py-2">
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => onChange([...slabs, [0, null, 0]])}>Add slab</Button>
      </div>
    </div>
  )
}

// ── Overtime ───────────────────────────────────────────────────────────────

const hours = (v) => (v == null || v === '' ? '—' : `${Number(v).toString()}h`)

/** The branch's overtime rule: when overtime starts and what it pays. Payroll reads it on every run. */
function OvertimeTab({ branchId, branchName }) {
  const qc = useQueryClient()
  const { can } = useRole()
  const editable = can('payroll.manage', 'shifts.manage')
  const [editing, setEditing] = useState(false)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['overtime-rules'],
    queryFn: () => overtimeApi.listRules().then((r) => r.data?.data ?? []),
  })
  const rule = rules.find((r) => r.branch_id === Number(branchId))

  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <Card padded={false} className="lg:col-span-2">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', rule ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400')}><Timer size={18} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">Overtime rule{branchName ? ` — ${branchName}` : ''}</h3>
              {rule ? <StatusPill status="active" label="Applied" /> : <StatusPill tone="slate" label="Not set up" />}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Hours beyond the day's threshold (or the shift length, if longer) count as overtime; approved overtime is paid at the multiplier.</p>
          </div>
          {editable && <Button size="sm" variant={rule ? 'secondary' : 'primary'} icon={rule ? Pencil : Plus} onClick={() => setEditing(true)}>{rule ? 'Edit' : 'Set up'}</Button>}
        </div>
        {rule ? (
          <dl className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              ['Daily threshold', hours(rule.daily_threshold_hours), 'Overtime starts after this in a day'],
              ['Weekly threshold', hours(rule.weekly_threshold_hours), 'For reference'],
              ['Pay multiplier', `${Number(rule.rate_multiplier ?? 1).toString()}×`, 'Of the hourly basic rate'],
            ].map(([label, value, hint]) => (
              <div key={label} className="px-5 py-4">
                <dt className="text-xs font-medium text-slate-500">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</dd>
                <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
              </div>
            ))}
          </dl>
        ) : (
          <EmptyState icon={Timer} title="No overtime rule for this branch"
            description="Without a rule, approved overtime claims are not paid in payroll."
            action={editable && <Button icon={Plus} onClick={() => setEditing(true)}>Set up overtime</Button>} />
        )}
      </Card>
      <Card>
        <h3 className="text-[13px] font-semibold text-slate-900">How it's paid</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">
          <li>Employees claim extra hours from <strong>Overtime</strong>; approvers decide in <strong>Approvals</strong>.</li>
          <li>Each payroll run adds an <strong>Overtime</strong> earning: approved hours × multiplier × hourly basic (monthly basic ÷ 208 hours).</li>
          <li>The Factories Act norm is double pay beyond 9 hours a day or 48 a week.</li>
        </ul>
      </Card>
      {editing && <OvertimeRuleModal branchId={branchId} rule={rule} onClose={() => setEditing(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['overtime-rules'] }); setEditing(false) }} />}
    </div>
  )
}

function OvertimeRuleModal({ branchId, rule, onClose, onSaved }) {
  const [form, setForm] = useState({
    daily_threshold_hours: rule?.daily_threshold_hours ?? 9,
    weekly_threshold_hours: rule?.weekly_threshold_hours ?? 48,
    rate_multiplier: rule?.rate_multiplier ?? 2,
  })
  const save = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' || v == null ? null : Number(v)]))
      return rule ? overtimeApi.updateRule(rule.id, body) : overtimeApi.createRule({ ...body, branch_id: Number(branchId) })
    },
    onSuccess: onSaved,
  })
  const field = (key, label, hint, step = '0.5') => (
    <Field label={label} hint={hint}>
      <Input type="number" min="0" step={step} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </Field>
  )

  return (
    <Modal size="sm" title={rule ? 'Edit overtime rule' : 'Set up overtime'} subtitle="Takes effect from the next payroll run." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save rule</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          {field('daily_threshold_hours', 'Daily threshold (hours)')}
          {field('weekly_threshold_hours', 'Weekly threshold (hours)', 'Optional')}
        </div>
        {field('rate_multiplier', 'Pay multiplier', 'e.g. 2 pays double the hourly rate. Minimum 1.', '0.25')}
      </div>
    </Modal>
  )
}
