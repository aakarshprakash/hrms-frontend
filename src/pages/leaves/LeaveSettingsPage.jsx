import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal, Plus, Pencil, Trash2, ArrowRight, ArrowUp, ArrowDown, X, Save, GitBranch } from 'lucide-react'
import { leaveApi, approvalApi } from '@/lib/api/leaves'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { ACCRUAL_LABELS, typeColor, FALLBACK_COLORS } from '@/lib/leave'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, IconButton, Tabs, Modal, Field, Input, Select, Toggle, StatusPill, EmptyState, ErrorBanner } from '@/components/ui/kit'

export default function LeaveSettingsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [tab, setTab] = useState('policies')
  const [branchId, setBranchId] = useState(activeBranchId ?? '')

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? []),
  })
  const branch = branchId || branches[0]?.id || ''

  return (
    <div className="space-y-5">
      <PageHeader icon={SlidersHorizontal} title="Leave settings"
        subtitle="Leave types and their rules, and who approves requests — per branch."
        actions={branches.length > 1 && (
          <Select className="w-auto" value={branch} onChange={(e) => setBranchId(Number(e.target.value))}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )} />

      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'policies', label: 'Leave policies' }, { key: 'flows', label: 'Approval flows' }]} />

      {!branch ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        : tab === 'policies' ? <Policies branchId={branch} /> : <Flows branchId={branch} />}
    </div>
  )
}

// ── Leave policies ─────────────────────────────────────────────────────────

function policyFacts(t) {
  const facts = []
  facts.push(t.accrual === 'none' ? 'Credited manually' : `${t.days_per_year} days/yr · ${ACCRUAL_LABELS[t.accrual]?.toLowerCase()}`)
  if (t.carry_forward) facts.push(t.max_carry_forward !== null ? `Carry forward up to ${Number(t.max_carry_forward)}` : 'Carry forward')
  if (t.allow_half_day) facts.push('Half days')
  if (t.sandwich_rule) facts.push('Sandwich rule')
  if (t.min_notice_days > 0) facts.push(`${t.min_notice_days}d notice`)
  if (t.max_consecutive_days) facts.push(`Max ${t.max_consecutive_days} at a time`)
  if (t.requires_document_after_days !== null && t.requires_document_after_days !== undefined) facts.push(`Document if > ${t.requires_document_after_days}d`)
  if (t.min_service_days > 0) facts.push(`After ${t.min_service_days}d service`)
  if (t.applicable_gender) facts.push(`${t.applicable_gender === 'female' ? 'Women' : 'Men'} only`)
  if (t.allow_negative) facts.push('Can go negative')
  return facts
}

function Policies({ branchId }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null) // type | 'new'

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['leave-types', 'settings', branchId],
    queryFn: () => leaveApi.listTypes({ branch_id: branchId }).then((r) => r.data?.data ?? []),
  })
  const remove = useMutation({
    mutationFn: (id) => leaveApi.deleteType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  })
  const toggle = useMutation({
    mutationFn: (t) => leaveApi.updateType(t.id, { is_active: !t.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{types.length} leave type(s)</p>
        <Button icon={Plus} onClick={() => setEditing('new')}>Add leave type</Button>
      </div>
      <ErrorBanner error={remove.error ?? toggle.error} />

      {isLoading ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div> : types.length === 0 ? (
        <Card><EmptyState title="No leave types yet" description="Add the leave your organisation offers — casual, sick, earned…" /></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {types.map((t) => (
            <Card key={t.id} className={cn('relative overflow-hidden', !t.is_active && 'opacity-70')}>
              <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: typeColor(t) }} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    {t.code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{t.code}</span>}
                    {!t.paid && <StatusPill tone="red" dot={false} label="Unpaid" />}
                    {!t.is_active && <StatusPill status="inactive" label="Switched off" />}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {policyFacts(t).map((f) => <span key={f} className="rounded-lg bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">{f}</span>)}
                  </div>
                  {t.leaves_count > 0 && <p className="mt-2 text-xs text-slate-400">{t.leaves_count} request(s) on record</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(t)} />
                  {t.leaves_count > 0
                    ? <Toggle checked={t.is_active} onChange={() => toggle.mutate(t)} />
                    : <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => { if (confirm(`Delete ${t.name}?`)) remove.mutate(t.id) }} />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <PolicyModal type={editing === 'new' ? null : editing} branchId={branchId} onClose={() => setEditing(null)} />}
    </div>
  )
}

const BLANK = {
  name: '', code: '', color: '', paid: true, is_active: true,
  days_per_year: 12, accrual: 'annual', prorate_on_joining: true, min_service_days: 0,
  carry_forward: false, max_carry_forward: '', encashable: false,
  allow_half_day: true, allow_negative: false, sandwich_rule: false,
  min_notice_days: 0, max_consecutive_days: '', requires_document_after_days: '', applicable_gender: '',
}

function PolicyModal({ type, branchId, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(() => type ? {
    ...BLANK, ...type,
    code: type.code ?? '', color: type.color ?? '', applicable_gender: type.applicable_gender ?? '',
    max_carry_forward: type.max_carry_forward ?? '', max_consecutive_days: type.max_consecutive_days ?? '',
    requires_document_after_days: type.requires_document_after_days ?? '',
  } : BLANK)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const save = useMutation({
    mutationFn: () => {
      const blankToNull = (v) => (v === '' || v === undefined ? null : Number(v))
      const payload = {
        name: form.name.trim(), code: form.code.trim() || null, color: form.color || null, paid: form.paid, is_active: form.is_active,
        days_per_year: Number(form.days_per_year) || 0, accrual: form.accrual, prorate_on_joining: form.prorate_on_joining,
        min_service_days: Number(form.min_service_days) || 0,
        carry_forward: form.carry_forward, max_carry_forward: form.carry_forward ? blankToNull(form.max_carry_forward) : null, encashable: form.encashable,
        allow_half_day: form.allow_half_day, allow_negative: form.allow_negative, sandwich_rule: form.sandwich_rule,
        min_notice_days: Number(form.min_notice_days) || 0, max_consecutive_days: blankToNull(form.max_consecutive_days),
        requires_document_after_days: blankToNull(form.requires_document_after_days), applicable_gender: form.applicable_gender || null,
      }
      return type ? leaveApi.updateType(type.id, payload) : leaveApi.createType({ ...payload, branch_id: branchId })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); onClose() },
  })

  const section = 'space-y-3 rounded-xl border border-slate-200 p-4'
  const heading = 'text-xs font-semibold uppercase tracking-wide text-slate-500'

  return (
    <Modal size="xl" onClose={onClose} title={type ? `Edit ${type.name}` : 'New leave type'}
      subtitle="Changes apply to new requests and future credits; past leave stays as it was."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Save} loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={save.error} />

        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <Field label="Name" required><Input value={form.name} placeholder="e.g. Earned Leave" onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Code"><Input value={form.code} maxLength={10} placeholder="EL" onChange={(e) => set({ code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Colour">
            <div className="flex gap-1.5 pt-1.5">
              {FALLBACK_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => set({ color: c })} aria-label={c}
                  className={cn('h-6 w-6 rounded-full ring-offset-2', (form.color || typeColor(form)) === c && 'ring-2 ring-slate-400')} style={{ backgroundColor: c }} />
              ))}
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={form.paid} onChange={(v) => set({ paid: v })} label="Paid leave" description="Unpaid leave is deducted from salary." />
          <Toggle checked={form.is_active} onChange={(v) => set({ is_active: v })} label="Available" description="Switched off: no new requests or credits." />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={section}>
            <p className={heading}>Entitlement</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="How it’s credited">
                <Select value={form.accrual} onChange={(e) => set({ accrual: e.target.value })}>
                  <option value="annual">Yearly, at the start of the leave year</option>
                  <option value="monthly">Monthly, 1/12 each month</option>
                  <option value="none">Not automatically (by adjustment)</option>
                </Select>
              </Field>
              <Field label="Days per year">
                <Input type="number" min="0" max="366" value={form.days_per_year} disabled={form.accrual === 'none'} onChange={(e) => set({ days_per_year: e.target.value })} />
              </Field>
            </div>
            <Field label="Eligible after (days of service)" hint="0 = from the joining date.">
              <Input type="number" min="0" value={form.min_service_days} onChange={(e) => set({ min_service_days: e.target.value })} />
            </Field>
            <Toggle checked={form.prorate_on_joining} onChange={(v) => set({ prorate_on_joining: v })} disabled={form.accrual !== 'annual'}
              label="Pro-rate for joiners" description="Someone joining mid-year gets the share for the months left." />
          </div>

          <div className={section}>
            <p className={heading}>Year end</p>
            <Toggle checked={form.carry_forward} onChange={(v) => set({ carry_forward: v })} label="Carry forward unused leave" description="Otherwise the balance lapses when the leave year ends." />
            {form.carry_forward && (
              <Field label="Carry forward at most (days)" hint="Leave empty for no limit.">
                <Input type="number" min="0" value={form.max_carry_forward} onChange={(e) => set({ max_carry_forward: e.target.value })} />
              </Field>
            )}
            <Toggle checked={form.encashable} onChange={(v) => set({ encashable: v })} label="Encashable" description="Marks the balance as payable on exit / encashment." />
          </div>

          <div className={cn(section, 'lg:col-span-2')}>
            <p className={heading}>Rules when applying</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Notice (days ahead)"><Input type="number" min="0" value={form.min_notice_days} onChange={(e) => set({ min_notice_days: e.target.value })} /></Field>
              <Field label="Max days at a time" hint="Empty = no limit"><Input type="number" min="1" value={form.max_consecutive_days} onChange={(e) => set({ max_consecutive_days: e.target.value })} /></Field>
              <Field label="Document needed above (days)" hint="Empty = never"><Input type="number" min="0" value={form.requires_document_after_days} onChange={(e) => set({ requires_document_after_days: e.target.value })} /></Field>
              <Field label="Who can take it">
                <Select value={form.applicable_gender} onChange={(e) => set({ applicable_gender: e.target.value })}>
                  <option value="">Everyone</option>
                  <option value="female">Women only</option>
                  <option value="male">Men only</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Toggle checked={form.allow_half_day} onChange={(v) => set({ allow_half_day: v })} label="Half days allowed" />
              <Toggle checked={form.sandwich_rule} onChange={(v) => set({ sandwich_rule: v })} label="Sandwich rule" description="Weekly offs / holidays between leave days count as leave." />
              <Toggle checked={form.allow_negative} onChange={(v) => set({ allow_negative: v })} label="Allow negative balance" description="Leave beyond the balance (advance leave / LOP)." />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Approval flows ─────────────────────────────────────────────────────────

function Flows({ branchId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['approval-flows', branchId],
    queryFn: () => approvalApi.flows({ branch_id: branchId }).then((r) => r.data),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Each request goes through these steps in order. Branch and tenant admins can always step in; nobody approves their own request or two steps of the same one.</p>
      {(data?.data ?? []).map((flow) => (
        <FlowCard key={`${branchId}-${flow.module}`} flow={flow} branchId={branchId} types={data?.approver_types ?? []} />
      ))}
    </div>
  )
}

function FlowCard({ flow, branchId, types }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [steps, setSteps] = useState(() => flow.steps.map((s) => s.approver_type))
  const [allBranches, setAllBranches] = useState(false)

  const save = useMutation({
    mutationFn: () => approvalApi.saveFlow(branchId, flow.module, { steps: steps.map((t) => ({ approver_type: t })), apply_to_all_branches: allBranches }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval-flows'] }); setEditing(false) },
  })
  const move = (i, d) => setSteps((s) => { const n = [...s]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n })

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><GitBranch size={17} /></div>
          <div>
            <p className="font-semibold text-slate-900">{flow.label}</p>
            {!editing && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {flow.steps.length === 0 ? <span className="text-sm text-slate-500">Approved automatically</span> : flow.steps.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    {i > 0 && <ArrowRight size={13} className="text-slate-300" />}
                    <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{s.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {!editing && <Button variant="secondary" size="sm" icon={Pencil} onClick={() => { setSteps(flow.steps.map((s) => s.approver_type)); setEditing(true) }}>Edit</Button>}
      </div>

      {editing && (
        <div className="mt-4 space-y-3">
          <ErrorBanner error={save.error} />
          {steps.length === 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">No steps: requests are approved as soon as they’re submitted.</p>}
          {steps.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs font-semibold text-slate-400">Step {i + 1}</span>
              <Select value={t} onChange={(e) => setSteps((s) => s.map((x, j) => (j === i ? e.target.value : x)))}>
                {types.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
              <IconButton icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon={ArrowDown} label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon={X} label="Remove" tone="danger" onClick={() => setSteps((s) => s.filter((_, j) => j !== i))} />
            </div>
          ))}
          {steps.length < 4 && (
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => setSteps((s) => [...s, s.length === 0 ? 'manager' : 'hr'])}>Add step</Button>
          )}
          <p className="text-xs text-slate-400">{types.find((x) => x.value === steps[0])?.hint}</p>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={allBranches} onChange={(e) => setAllBranches(e.target.checked)} className="rounded border-slate-300" />
              Use for all my branches
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
