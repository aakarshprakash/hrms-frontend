import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { KeyRound, Plus, Copy, Check, Ban, Search, RefreshCw } from 'lucide-react'
import { billingApi } from '@/lib/api/billing'
import { platformApi } from '@/lib/api/platform'
import { money, dateLabel } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import {
  Card, CardHeader, StatCard, Table, StatusPill, EmptyState, Pagination, Button, IconButton, Input, Select, Field, Modal, Textarea, Toggle, Tabs, ErrorBanner,
} from '@/components/ui/kit'

const METHODS = { bank_transfer: 'Bank transfer (NEFT / RTGS / IMPS)', upi: 'UPI', cheque: 'Cheque', cash: 'Cash', other: 'Other' }
const CYCLES = { monthly: ['Monthly', 1], half_yearly: ['6 months', 6], yearly: ['Yearly', 12] }
const STATUS_TONE = { available: 'blue', redeemed: 'green', revoked: 'slate' }

/**
 * Offline sales: record the payment received in the account, generate a
 * licence key and send it to the customer, who redeems it on Plan & billing.
 */
export default function PlatformLicenses() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })
  const [creating, setCreating] = useState(false)
  const [issued, setIssued] = useState(null)
  const set = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }))

  const { data, isLoading } = useQuery({
    queryKey: ['platform-licenses', filters],
    queryFn: () => billingApi.licenses({ ...filters, status: filters.status || undefined, search: filters.search || undefined }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })
  const revoke = useMutation({
    mutationFn: billingApi.revokeLicense,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-licenses'] }),
  })

  const stats = data?.stats ?? {}

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Keys waiting to be used" value={stats.available ?? 0} icon={KeyRound} tone="blue" />
        <StatCard label="Keys redeemed" value={stats.redeemed ?? 0} icon={Check} tone="green" />
        <StatCard label="Collected offline" value={money(stats.collected ?? 0)} icon={RefreshCw} tone="indigo" />
      </div>

      <AutopaySetting />

      <Card padded={false}>
        <CardHeader icon={KeyRound} title="Licence keys" subtitle="Generate a key once the payment is in the account; the customer enters it under Plan & billing."
          actions={<Button icon={Plus} onClick={() => setCreating(true)}>Generate key</Button>} />
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search by key" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
          </div>
          <Tabs variant="pills" value={filters.status} onChange={(status) => set({ status })}
            tabs={[{ key: '', label: 'All' }, { key: 'available', label: 'Unused' }, { key: 'redeemed', label: 'Redeemed' }, { key: 'revoked', label: 'Revoked' }]} />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div> : (
          <>
            <Table rows={data?.data ?? []} empty={<EmptyState icon={KeyRound} title="No licence keys yet" description="Generate one after a customer pays by bank transfer, UPI or cheque." />}
              columns={[
                { key: 'key', label: 'Key', render: (k) => <KeyCell value={k.key} /> },
                { key: 'plan', label: 'Plan', render: (k) => <span>{k.plan?.name} <span className="text-xs text-slate-400">· {k.months} mo</span></span> },
                { key: 'org', label: 'Organisation', render: (k) => k.redeemed_company?.name ?? k.company?.name ?? <span className="text-slate-400">Any</span> },
                { key: 'amount', label: 'Received', align: 'right', render: (k) => (
                  <div>{money(k.amount)}<p className="text-xs text-slate-400">{METHODS[k.payment_method]?.split(' (')[0] ?? ''}{k.payment_reference ? ` · ${k.payment_reference}` : ''}</p></div>
                ) },
                { key: 'status', label: 'Status', render: (k) => (
                  <div>
                    <StatusPill tone={k.expired ? 'red' : STATUS_TONE[k.status]} label={k.expired ? 'Expired' : k.status === 'available' ? 'Unused' : k.status[0].toUpperCase() + k.status.slice(1)} />
                    <p className="mt-0.5 text-xs text-slate-400">{k.status === 'redeemed' ? `on ${dateLabel(k.redeemed_at)}` : k.status === 'available' && k.valid_until ? `use by ${dateLabel(k.valid_until)}` : ''}</p>
                  </div>
                ) },
                { key: 'actions', label: '', align: 'right', render: (k) => k.status === 'available' && (
                  <IconButton icon={Ban} label="Revoke" tone="danger"
                    onClick={() => { if (confirm(`Revoke ${k.key}? It can no longer be redeemed.`)) revoke.mutate(k.id) }} />
                ) },
              ]} />
            <Pagination meta={data} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
        <ErrorBanner error={revoke.error} className="m-3" />
      </Card>

      {creating && <GenerateModal onClose={() => setCreating(false)} onIssued={(keys) => { setCreating(false); setIssued(keys) }} />}
      {issued && (
        <Modal title={issued.length === 1 ? 'Licence key ready' : `${issued.length} licence keys ready`} subtitle="Send this to the customer. They enter it under Settings → Plan & billing." size="sm"
          onClose={() => setIssued(null)} footer={<Button onClick={() => setIssued(null)}>Done</Button>}>
          <div className="space-y-2">{issued.map((k) => <KeyCell key={k.id} value={k.key} large />)}</div>
        </Modal>
      )}
    </div>
  )
}

function KeyCell({ value, large }) {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button" title="Copy" onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className={`group inline-flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 font-mono text-slate-800 hover:bg-blue-50 ${large ? 'w-full justify-between text-[15px]' : 'text-xs'}`}>
      {value}
      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} className="text-slate-400 group-hover:text-blue-600" />}
    </button>
  )
}

function AutopaySetting() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['platform-billing-settings'], queryFn: () => billingApi.platformBillingSettings().then((r) => r.data.data) })
  const save = useMutation({
    mutationFn: (v) => billingApi.updatePlatformBillingSettings({ autopay_available: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-billing-settings'] }),
  })
  if (!data) return null

  return (
    <Card>
      <Toggle checked={data.autopay_available} disabled={save.isPending} onChange={(v) => save.mutate(v)}
        label="Autopay for customers"
        description={data.autopay_available
          ? 'Customers who switched autopay on are charged automatically at renewal.'
          : 'Off: customers can still set their preference, but renewals are invoiced until you turn this on (once card / UPI mandates are set up).'} />
      <ErrorBanner error={save.error} className="mt-3" />
    </Card>
  )
}

function GenerateModal({ onClose, onIssued }) {
  const { data: plans = [] } = useQuery({ queryKey: ['platform-plans'], queryFn: () => billingApi.plans().then((r) => r.data.data ?? r.data) })
  const { data: companies = [] } = useQuery({
    queryKey: ['platform-companies', 'all'],
    queryFn: () => platformApi.companies({ per_page: 100 }).then((r) => r.data.data ?? []),
  })
  const today = new Date().toLocaleDateString('en-CA')
  const [form, setForm] = useState({
    plan_id: '', billing_cycle: 'yearly', months: 12, company_id: '', amount: '', payment_method: 'bank_transfer',
    payment_reference: '', paid_on: today, valid_until: '', notes: '', count: 1,
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const create = useMutation({ mutationFn: billingApi.createLicenses, onSuccess: (r) => onIssued(r.data.data) })

  function submit(e) {
    e.preventDefault()
    const payload = { ...form, amount: Number(form.amount || 0), months: Number(form.months), count: Number(form.count) }
    for (const k of ['company_id', 'payment_reference', 'valid_until', 'notes', 'paid_on']) if (payload[k] === '') payload[k] = null
    create.mutate(payload)
  }

  const activePlans = (Array.isArray(plans) ? plans : []).filter((p) => p.is_active !== false)

  return (
    <Modal title="Generate licence key" subtitle="Record the payment you received, then send the key to the customer." size="lg" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="license-form" icon={KeyRound} loading={create.isPending}>Generate</Button>
      </>}>
      <form id="license-form" className="space-y-4" onSubmit={submit}>
        <ErrorBanner error={create.error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Plan" required>
            <Select required value={form.plan_id} onChange={(e) => set({ plan_id: e.target.value })}>
              <option value="">Select plan</option>
              {activePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Billing cycle">
            <Select value={form.billing_cycle} onChange={(e) => set({ billing_cycle: e.target.value, months: CYCLES[e.target.value][1] })}>
              {Object.entries(CYCLES).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Months of access" required>
            <Input type="number" min={1} max={60} required value={form.months} onChange={(e) => set({ months: e.target.value })} />
          </Field>
        </div>
        <Field label="Organisation" hint="Lock the key to one customer, or leave it open for a new signup.">
          <Select value={form.company_id} onChange={(e) => set({ company_id: e.target.value })}>
            <option value="">Any organisation</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Amount received (₹, incl. GST)" required>
            <Input type="number" min={0} step="0.01" required value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0 for a free / trial key" />
          </Field>
          <Field label="Paid by">
            <Select value={form.payment_method} onChange={(e) => set({ payment_method: e.target.value })}>
              {Object.entries(METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Received on"><Input type="date" value={form.paid_on} onChange={(e) => set({ paid_on: e.target.value })} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="UTR / cheque no." className="sm:col-span-2">
            <Input value={form.payment_reference} onChange={(e) => set({ payment_reference: e.target.value })} placeholder="Bank reference for your records" />
          </Field>
          <Field label="Redeem by" hint="Default: 90 days"><Input type="date" min={today} value={form.valid_until} onChange={(e) => set({ valid_until: e.target.value })} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Notes" className="sm:col-span-3"><Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          <Field label="How many keys"><Input type="number" min={1} max={50} value={form.count} onChange={(e) => set({ count: e.target.value })} /></Field>
        </div>
      </form>
    </Modal>
  )
}
