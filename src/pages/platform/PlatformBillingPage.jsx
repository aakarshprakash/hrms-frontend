import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import {
  Wallet, TrendingUp, Receipt, AlertTriangle, Hourglass, Search, Download, CheckCircle2, Ban, CreditCard, ArrowRight, Info,
} from 'lucide-react'
import { billingApi } from '@/lib/api/billing'
import PlatformLicenses from './PlatformLicenses'
import { saveBlob } from '@/lib/api/payroll'
import { money, moneyShort, dateLabel } from '@/lib/format'
import { SERIES, GRID, TICK } from '@/lib/chart'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import {
  PageHeader, Card, CardHeader, StatCard, Tabs, Table, StatusPill, EmptyState, Pagination, Button, Input, Select, Field, Modal,
  ErrorBanner, ChartTooltip,
} from '@/components/ui/kit'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'licenses', label: 'Licence keys' },
]

const SUB_STATUS = {
  trialing: ['blue', 'Trial'], active: ['green', 'Active'], past_due: ['amber', 'Past due'], expired: ['red', 'Expired'], cancelled: ['slate', 'Cancelled'],
}
const CYCLE_LABEL = { monthly: 'Monthly', half_yearly: '6 months', yearly: 'Yearly' }

/**
 * The platform operator's billing desk: recurring revenue and collections,
 * every client's subscription, and the invoice and payment ledgers.
 */
export default function PlatformBillingPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'overview'

  return (
    <div className="space-y-6">
      <PageHeader icon={Wallet} title="Billing & revenue" subtitle="Subscriptions, invoices and online payments across every client organisation." />
      <Tabs tabs={TABS} value={tab} onChange={(key) => setParams(key === 'overview' ? {} : { tab: key })} />
      {tab === 'overview' && <Overview onTab={(key) => setParams({ tab: key })} />}
      {tab === 'subscriptions' && <Subscriptions />}
      {tab === 'invoices' && <Invoices />}
      {tab === 'payments' && <Payments />}
      {tab === 'licenses' && <PlatformLicenses />}
    </div>
  )
}

function Overview({ onTab }) {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-revenue'],
    queryFn: () => billingApi.revenueOverview().then((r) => r.data.data),
  })
  if (isLoading || !data) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>

  const change = data.collected_last_month > 0 ? ((data.collected_this_month - data.collected_last_month) / data.collected_last_month) * 100 : null
  const status = data.by_status ?? {}

  return (
    <div className="space-y-6">
      {!data.online_payment && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>Online payment is off — clients can only pay by bank transfer. Add <code className="font-mono">RAZORPAY_KEY_ID</code>, <code className="font-mono">RAZORPAY_KEY_SECRET</code> and <code className="font-mono">RAZORPAY_WEBHOOK_SECRET</code> to the backend <code className="font-mono">.env</code> to switch on Razorpay Checkout.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monthly recurring revenue" value={money(data.mrr)} icon={TrendingUp} tone="blue" hint={`${money(data.arr)} annual run rate`} />
        <StatCard label="Collected this month" value={money(data.collected_this_month)} icon={Wallet} tone="green"
          trend={change !== null ? { value: `${Math.abs(change).toFixed(0)}%`, up: change >= 0, good: change >= 0, label: 'vs last month' } : undefined}
          hint={change === null ? `${money(data.collected_last_month)} last month` : undefined} />
        <StatCard label="Outstanding" value={money(data.outstanding)} icon={Receipt} tone="amber" hint={`${data.open_invoices} open invoice${data.open_invoices === 1 ? '' : 's'}`} onClick={() => onTab('invoices')} />
        <StatCard label="Overdue (past grace)" value={money(data.overdue)} icon={AlertTriangle} tone={data.overdue > 0 ? 'red' : 'slate'} hint="Subscriptions here go past due" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card padded={false} className="xl:col-span-2">
          <CardHeader title="Collections" subtitle="Paid invoices by month, last 12 months (incl. GST)" icon={TrendingUp} />
          {data.series.every((m) => !m.collected) ? (
            <EmptyState icon={TrendingUp} title="No collections yet" description="Paid invoices — online or marked paid — build this chart month by month." />
          ) : (
          <div className="h-72 px-3 py-4" role="img" aria-label="Bar chart of amounts collected per month over the last 12 months">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} />
                <YAxis tickLine={false} axisLine={false} tick={TICK} width={52} tickFormatter={(v) => moneyShort(v).replace('₹', '')} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ChartTooltip format={(v) => money(v)} />} />
                <Bar dataKey="collected" name="Collected" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
        </Card>

        <Card padded={false}>
          <CardHeader title="Clients by status" subtitle={`${Object.values(status).reduce((a, b) => a + b, 0)} organisations`} />
          <div className="divide-y divide-slate-100">
            {Object.entries(SUB_STATUS).map(([key, [tone, label]]) => (
              <div key={key} className="flex items-center justify-between px-5 py-2.5 text-[14px]">
                <StatusPill tone={tone} label={label} />
                <span className="font-semibold tabular-nums text-slate-900">{status[key] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Live plans</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(data.by_plan ?? {}).map(([plan, n]) => (
                <span key={plan} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{plan} <span className="font-semibold">{n}</span></span>
              ))}
            </div>
            {data.trial_pipeline_mrr > 0 && (
              <p className="mt-3 text-xs text-slate-500"><span className="font-semibold text-slate-800">{money(data.trial_pipeline_mrr)}</span>/month more once confirmed trials convert.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card padded={false}>
          <CardHeader title="Trials ending in 7 days" icon={Hourglass} subtitle="Follow up before they lapse" />
          <Table rows={data.trials_ending} rowKey="company_id"
            empty={<EmptyState icon={Hourglass} title="No trials ending this week" />}
            columns={[
              { key: 'company', label: 'Organisation', render: (r) => <Link to={`/platform/companies/${r.company_id}`} className="font-medium text-slate-900 hover:text-blue-700">{r.company}</Link> },
              { key: 'plan', label: 'Plan', render: (r) => <span>{r.plan} <span className="text-xs text-slate-400">· {CYCLE_LABEL[r.billing_cycle] ?? r.billing_cycle}</span></span> },
              { key: 'ends', label: 'Ends', render: (r) => <span className="text-xs">{dateLabel(r.trial_ends_at)}</span> },
              { key: 'confirmed', label: 'Plan chosen', render: (r) => <StatusPill tone={r.plan_confirmed ? 'green' : 'amber'} label={r.plan_confirmed ? 'Yes — will bill' : 'No'} /> },
            ]} />
        </Card>

        <Card padded={false}>
          <CardHeader title="Recent payments" icon={CreditCard}
            actions={<Button variant="ghost" size="sm" onClick={() => onTab('payments')}>All payments <ArrowRight size={14} /></Button>} />
          <Table rows={data.recent_payments}
            empty={<EmptyState icon={CreditCard} title="No online payments yet" description="Razorpay payments appear here as clients pay." />}
            columns={[
              { key: 'company', label: 'Organisation', render: (p) => <span className="font-medium text-slate-900">{p.company}</span> },
              { key: 'invoice', label: 'Invoice', render: (p) => <span className="font-mono text-xs">{p.invoice_number ?? '—'}</span> },
              { key: 'paid_at', label: 'Paid', render: (p) => <span className="text-xs">{dateLabel(p.paid_at)}</span> },
              { key: 'amount', label: 'Amount', align: 'right', render: (p) => money(p.amount, { paise: true }) },
            ]} />
        </Card>
      </div>
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input className="pl-9" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function Subscriptions() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ search: '', status: '', plan: '' })
  const { data, isLoading } = useQuery({
    queryKey: ['platform-subscriptions', filters],
    queryFn: () => billingApi.allSubscriptions(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).then((r) => r.data),
    placeholderData: keepPreviousData,
  })
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
        <SearchBox value={filters.search} onChange={(search) => set({ search })} placeholder="Search organisation or email…" />
        <Select className="w-auto" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          {Object.entries(SUB_STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select className="w-auto" value={filters.plan} onChange={(e) => set({ plan: e.target.value })}>
          <option value="">All plans</option>
          {(data?.plans ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </Select>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div> : (
        <Table rows={data?.data ?? []} onRowClick={(r) => navigate(`/platform/companies/${r.company_id}`)}
          empty={<EmptyState title="No subscriptions match" />}
          columns={[
            { key: 'company', label: 'Organisation', render: (r) => (
              <div><p className="font-medium text-slate-900">{r.company}</p><p className="text-xs text-slate-400">{r.company_email}</p></div>
            ) },
            { key: 'plan', label: 'Plan', render: (r) => <span>{r.plan?.name ?? '—'} <span className="text-xs text-slate-400">· {CYCLE_LABEL[r.billing_cycle] ?? r.billing_cycle}</span></span> },
            { key: 'status', label: 'Status', render: (r) => {
              const [tone, label] = SUB_STATUS[r.status] ?? ['slate', r.status]
              return <div className="flex flex-wrap gap-1"><StatusPill tone={tone} label={label} />{r.cancel_at_period_end && <StatusPill tone="amber" label="Cancelling" />}</div>
            } },
            { key: 'renews', label: 'Trial end / renewal', render: (r) => <span className="text-xs">{r.status === 'trialing' ? dateLabel(r.trial_ends_at) : r.current_period_end ? dateLabel(r.current_period_end) : '—'}</span> },
            { key: 'employees', label: 'Employees', align: 'right' },
            { key: 'monthly_value', label: 'MRR', align: 'right', render: (r) => money(r.monthly_value) },
            { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => <span className={cn(r.outstanding > 0 && 'font-semibold text-amber-700')}>{money(r.outstanding)}</span> },
          ]} />
      )}
    </Card>
  )
}

function Invoices() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 })
  const [settling, setSettling] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['platform-invoices', filters],
    queryFn: () => billingApi.allInvoices(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).then((r) => r.data),
    placeholderData: keepPreviousData,
  })
  const set = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }))
  const refresh = () => { qc.invalidateQueries({ queryKey: ['platform-invoices'] }); qc.invalidateQueries({ queryKey: ['platform-revenue'] }); qc.invalidateQueries({ queryKey: ['platform-subscriptions'] }) }
  const pdf = useMutation({ mutationFn: (i) => billingApi.platformInvoicePdf(i.id).then((res) => saveBlob(res.data, `${i.number}.pdf`, 'application/pdf')) })
  const voidInvoice = useMutation({ mutationFn: (i) => billingApi.voidInvoice(i.id), onSuccess: refresh })

  return (
    <>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
          <SearchBox value={filters.search} onChange={(search) => set({ search })} placeholder="Invoice number or organisation…" />
          <Tabs variant="pills" value={filters.status} onChange={(status) => set({ status })}
            tabs={[{ key: '', label: 'All' }, { key: 'open', label: 'Open' }, { key: 'overdue', label: 'Overdue' }, { key: 'paid', label: 'Paid' }, { key: 'void', label: 'Void' }]} />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div> : (
          <Table rows={data?.data ?? []} empty={<EmptyState icon={Receipt} title="No invoices" />}
            columns={[
              { key: 'number', label: 'Invoice', render: (i) => <span className="font-mono text-xs font-semibold text-slate-800">{i.number}</span> },
              { key: 'company', label: 'Organisation', render: (i) => <Link to={`/platform/companies/${i.company_id}`} className="font-medium text-slate-900 hover:text-blue-700">{i.company_name}</Link> },
              { key: 'period', label: 'Period', render: (i) => <span className="text-xs text-slate-500">{dateLabel(i.period_start)} – {dateLabel(i.period_end)}</span> },
              { key: 'total', label: 'Amount', align: 'right', render: (i) => money(i.total, { paise: true }) },
              { key: 'status', label: 'Status', render: (i) => (
                i.status === 'issued'
                  ? <StatusPill tone={i.overdue ? 'red' : 'amber'} label={i.overdue ? `Overdue · ${dateLabel(i.due_on)}` : `Due ${dateLabel(i.due_on)}`} />
                  : <StatusPill status={i.status} label={i.status === 'paid' ? `Paid${i.payment_method ? ` · ${i.payment_method.replace('_', ' ')}` : ''}` : undefined} />
              ) },
              { key: 'actions', label: '', align: 'right', render: (i) => (
                <div className="flex justify-end gap-1.5">
                  {i.status === 'issued' && <Button size="sm" variant="soft" icon={CheckCircle2} onClick={() => setSettling(i)}>Mark paid</Button>}
                  {i.status === 'issued' && (
                    <Button size="sm" variant="ghost" icon={Ban} loading={voidInvoice.isPending && voidInvoice.variables?.id === i.id}
                      onClick={() => { if (confirm(`Void ${i.number}? It will no longer be payable.`)) voidInvoice.mutate(i) }}>Void</Button>
                  )}
                  <Button size="sm" variant="secondary" icon={Download} loading={pdf.isPending && pdf.variables?.id === i.id} onClick={() => pdf.mutate(i)}>PDF</Button>
                </div>
              ) },
            ]} />
        )}
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} /></div>
        <ErrorBanner error={pdf.error ?? voidInvoice.error} className="m-4" />
      </Card>
      {settling && <MarkPaidModal invoice={settling} onClose={() => setSettling(null)} onDone={() => { setSettling(null); refresh() }} />}
    </>
  )
}

function MarkPaidModal({ invoice, onClose, onDone }) {
  const [form, setForm] = useState({ payment_method: 'bank_transfer', payment_reference: '', paid_at: new Date().toISOString().slice(0, 10) })
  const save = useMutation({ mutationFn: () => billingApi.markInvoicePaid(invoice.id, form), onSuccess: onDone })
  return (
    <Modal title={`Record payment · ${invoice.number}`} subtitle={`${invoice.company_name} · ${money(invoice.total, { paise: true })}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={CheckCircle2} loading={save.isPending} onClick={() => save.mutate()}>Mark paid</Button></>}>
      <div className="space-y-4">
        <Field label="Method">
          <Select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
            <option value="bank_transfer">Bank transfer (NEFT / RTGS / IMPS)</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="razorpay">Razorpay (manual match)</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Reference" hint="UTR, cheque number or transaction ID.">
          <Input value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} />
        </Field>
        <Field label="Received on"><Input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} /></Field>
        <ErrorBanner error={save.error} />
      </div>
    </Modal>
  )
}

function Payments() {
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 })
  const { data, isLoading } = useQuery({
    queryKey: ['platform-payments', filters],
    queryFn: () => billingApi.allPayments(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).then((r) => r.data),
    placeholderData: keepPreviousData,
  })
  const set = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Captured online, all time" value={money(data?.totals?.captured)} icon={Wallet} tone="green" />
        <StatCard label="Failed attempts" value={data?.totals?.failed ?? '—'} icon={AlertTriangle} tone={data?.totals?.failed ? 'amber' : 'slate'} hint="The client can retry from Plan & Billing" />
      </div>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
          <SearchBox value={filters.search} onChange={(search) => set({ search })} placeholder="Payment / order ID, invoice, organisation…" />
          <Tabs variant="pills" value={filters.status} onChange={(status) => set({ status })}
            tabs={[{ key: '', label: 'All' }, { key: 'captured', label: 'Captured' }, { key: 'created', label: 'Started' }, { key: 'failed', label: 'Failed' }]} />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div> : (
          <Table rows={data?.data ?? []} empty={<EmptyState icon={CreditCard} title="No payments yet" description="Every Razorpay Checkout attempt is recorded here." />}
            columns={[
              { key: 'created_at', label: 'Date', render: (p) => <span className="text-xs">{dateLabel(p.paid_at ?? p.created_at)}</span> },
              { key: 'company', label: 'Organisation', render: (p) => <span className="font-medium text-slate-900">{p.company?.name ?? '—'}</span> },
              { key: 'invoice', label: 'Invoice', render: (p) => <span className="font-mono text-xs">{p.invoice?.number ?? '—'}</span> },
              { key: 'ids', label: 'Razorpay', render: (p) => (
                <div className="font-mono text-[12px] text-slate-500"><p>{p.gateway_payment_id ?? '—'}</p><p className="text-slate-400">{p.gateway_order_id}</p></div>
              ) },
              { key: 'method', label: 'Method', render: (p) => <span className="text-xs uppercase">{p.method ?? '—'}</span> },
              { key: 'status', label: 'Status', render: (p) => (
                <div>
                  <StatusPill tone={{ captured: 'green', created: 'slate', failed: 'red' }[p.status]} label={{ captured: 'Captured', created: 'Started', failed: 'Failed' }[p.status] ?? p.status} />
                  {p.error && <p className="mt-0.5 max-w-[220px] truncate text-[12px] text-rose-600" title={p.error}>{p.error}</p>}
                </div>
              ) },
              { key: 'amount', label: 'Amount', align: 'right', render: (p) => money(p.amount, { paise: true }) },
            ]} />
        )}
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} /></div>
      </Card>
    </div>
  )
}
