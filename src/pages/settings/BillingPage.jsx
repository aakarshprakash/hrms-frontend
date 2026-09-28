import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, Check, Download, ExternalLink, AlertTriangle, Users, Building2, Save, CheckCircle2 } from 'lucide-react'
import { billingApi, FEATURE_LABELS } from '@/lib/api/billing'
import { saveBlob } from '@/lib/api/payroll'
import { refreshSession } from '@/lib/session'
import { money, dateLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, StatusPill, Field, Input, ErrorBanner, Table, EmptyState } from '@/components/ui/kit'

const STATUS = {
  trialing: ['blue', 'Free trial'], active: ['green', 'Active'], past_due: ['amber', 'Payment overdue'],
  expired: ['red', 'Trial ended'], cancelled: ['slate', 'Cancelled'],
}

/** The organisation's plan, usage, invoices and billing details. */
export default function BillingPage() {
  const [params] = useSearchParams()
  const { data, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.get().then((r) => r.data.data),
  })

  if (isLoading || !data) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>

  return (
    <div className="space-y-6">
      <PageHeader icon={CreditCard} title="Plan & billing" subtitle="Your subscription, what it includes, and invoices." />
      {params.get('paid') && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} /> Thanks — payment for {params.get('paid')} received. It can take a minute to show as paid.
        </div>
      )}
      <CurrentPlan data={data} />
      {data.unpaid.length > 0 && <Unpaid data={data} />}
      <Plans data={data} />
      <Invoices online={data.online_payment} />
      <BillingDetails details={data.billing_details} />
    </div>
  )
}

function CurrentPlan({ data }) {
  const qc = useQueryClient()
  const s = data.subscription
  const done = async () => { await refreshSession().catch(() => {}); qc.invalidateQueries({ queryKey: ['billing'] }) }
  const cancel = useMutation({ mutationFn: billingApi.cancel, onSuccess: done })
  const resume = useMutation({ mutationFn: billingApi.resume, onSuccess: done })

  if (!s) {
    return <Card><p className="text-sm text-slate-600">Your organisation has every module included. No subscription is needed.</p></Card>
  }

  const [tone, label] = STATUS[s.status] ?? ['slate', s.status]
  const limits = s.plan?.limits ?? {}

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold text-slate-900">{s.plan?.name}</p>
            <StatusPill tone={tone} label={label} />
            {s.cancel_at_period_end && <StatusPill tone="amber" label="Ends at period end" />}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {s.status === 'trialing' && `${s.trial_days_left} day(s) left in your trial${s.plan_confirmed_at ? ' — billing starts when it ends.' : '. Choose a plan to keep every module.'}`}
            {s.status === 'active' && s.current_period_end && `${s.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'} · renews ${dateLabel(s.current_period_end)}`}
            {s.status === 'active' && !s.current_period_end && 'No renewal needed.'}
            {s.status === 'expired' && 'You’re on the free core (attendance, leave, self-service). Choose a plan to switch the other modules back on.'}
            {s.status === 'past_due' && 'An invoice is overdue — please pay to avoid interruption.'}
          </p>
        </div>
        <div className="flex gap-2">
          {s.is_live && !s.cancel_at_period_end && s.plan?.code !== 'legacy' && (
            <Button variant="ghost" size="sm" loading={cancel.isPending}
              onClick={() => { if (confirm('Cancel your subscription? Modules stay on until the end of the paid period.')) cancel.mutate() }}>Cancel plan</Button>
          )}
          {s.cancel_at_period_end && <Button variant="secondary" size="sm" loading={resume.isPending} onClick={() => resume.mutate()}>Keep my plan</Button>}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Usage icon={Users} label="Active employees" used={data.usage.employees} limit={limits.employees} />
        <Usage icon={Building2} label="Branches" used={data.usage.branches} limit={limits.branches} />
        {data.next_invoice && (
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Next invoice · {dateLabel(data.next_invoice.date)}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{money(data.next_invoice.total)}</p>
            <p className="text-xs text-slate-500">{money(data.next_invoice.subtotal)} + GST · {data.next_invoice.employees} employees</p>
          </div>
        )}
      </div>
      <ErrorBanner error={cancel.error ?? resume.error} className="mt-3" />
    </Card>
  )
}

function Usage({ icon: Icon, label, used, limit }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500"><Icon size={13} />{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{used}<span className="text-sm font-medium text-slate-400"> / {limit ?? '∞'}</span></p>
      {limit && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={cn('h-full rounded-full', pct > 90 ? 'bg-rose-500' : 'bg-blue-600')} style={{ width: `${pct}%` }} /></div>}
    </div>
  )
}

function Unpaid({ data }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {data.unpaid.length} unpaid invoice(s)</p>
      <ul className="mt-1.5 space-y-0.5">
        {data.unpaid.map((i) => <li key={i.id}>{i.number} · {money(i.total)} · due {dateLabel(i.due_on)}</li>)}
      </ul>
      {!data.online_payment && data.bank_details && <p className="mt-2">Pay by bank transfer: {data.bank_details}. Quote the invoice number.</p>}
    </div>
  )
}

function Plans({ data }) {
  const qc = useQueryClient()
  const current = data.subscription
  const [cycle, setCycle] = useState(current?.billing_cycle ?? 'monthly')
  const choose = useMutation({
    mutationFn: (code) => billingApi.choosePlan({ plan_code: code, billing_cycle: cycle }),
    onSuccess: async () => { await refreshSession().catch(() => {}); qc.invalidateQueries({ queryKey: ['billing'] }); qc.invalidateQueries({ queryKey: ['billing-invoices'] }) },
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold text-slate-900">Plans</p>
        <div className="flex rounded-xl bg-slate-100 p-1 text-[13px] font-medium">
          {[['monthly', 'Monthly'], ['yearly', `Yearly · ${12 - data.yearly_months_charged} months free`]].map(([key, label]) => (
            <button key={key} onClick={() => setCycle(key)} className={cn('rounded-lg px-3 py-1.5', cycle === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{label}</button>
          ))}
        </div>
      </div>
      <ErrorBanner error={choose.error} />
      <div className="grid gap-4 lg:grid-cols-3">
        {data.plans.map((p) => {
          const isCurrent = current?.plan?.code === p.code && current?.is_live
          const price = cycle === 'yearly' ? p.yearly_estimate : p.monthly_estimate
          return (
            <Card key={p.code} className={cn('flex flex-col', isCurrent && 'ring-2 ring-blue-500')}>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-slate-900">{p.name}</p>
                {isCurrent && <StatusPill tone="blue" label="Current" dot={false} />}
              </div>
              <p className="mt-1 min-h-[40px] text-sm text-slate-500">{p.description}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{money(price)}<span className="text-sm font-medium text-slate-400"> /{cycle === 'yearly' ? 'year' : 'month'}</span></p>
              <p className="text-xs text-slate-500">
                for your {data.usage.employees} employees · {money(p.base_price)} incl. {p.included_employees}, then {money(p.per_employee_price)}/employee · + GST
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {p.features.filter((f) => FEATURE_LABELS[f]).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-slate-700"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />{FEATURE_LABELS[f]}</li>
                ))}
                <li className="flex items-start gap-2 text-slate-500"><Check size={15} className="mt-0.5 shrink-0 text-slate-300" />
                  {p.limits?.branches ? `Up to ${p.limits.branches} branch${p.limits.branches > 1 ? 'es' : ''}` : 'Unlimited branches'} · {p.limits?.employees ? `${p.limits.employees} employees` : 'unlimited employees'}
                </li>
              </ul>
              <Button className="mt-5 w-full" variant={isCurrent ? 'secondary' : 'primary'}
                disabled={isCurrent && current?.billing_cycle === cycle} loading={choose.isPending && choose.variables === p.code}
                onClick={() => choose.mutate(p.code)}>
                {isCurrent ? (current?.billing_cycle === cycle ? 'Your plan' : `Switch to ${cycle}`) : `Choose ${p.name}`}
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Invoices({ online }) {
  const { data, isLoading } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => billingApi.invoices().then((r) => r.data),
  })
  const pdf = useMutation({ mutationFn: (i) => billingApi.invoicePdf(i.id).then((res) => saveBlob(res.data, `${i.number}.pdf`, 'application/pdf')) })
  const pay = useMutation({ mutationFn: (i) => billingApi.pay(i.id).then((r) => { window.location.href = r.data.data.url }) })

  return (
    <Card padded={false}>
      <div className="border-b border-slate-100 px-5 py-3.5"><p className="font-semibold text-slate-900">Invoices</p></div>
      {isLoading ? <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div> : (
        <Table rows={data?.data ?? []} empty={<EmptyState title="No invoices yet" description="Invoices appear here when a paid period starts." />}
          columns={[
            { key: 'number', label: 'Invoice', render: (i) => <span className="font-mono text-xs font-semibold text-slate-800">{i.number}</span> },
            { key: 'period', label: 'Period', render: (i) => <span className="text-xs text-slate-500">{dateLabel(i.period_start)} – {dateLabel(i.period_end)}</span> },
            { key: 'total', label: 'Amount', align: 'right', render: (i) => money(i.total, { paise: true }) },
            { key: 'status', label: 'Status', render: (i) => <StatusPill status={i.status === 'issued' ? (i.overdue ? 'expired' : 'pending') : i.status} label={i.status === 'issued' ? (i.overdue ? 'Overdue' : `Due ${dateLabel(i.due_on)}`) : undefined} /> },
            { key: 'actions', label: '', align: 'right', render: (i) => (
              <div className="flex justify-end gap-2">
                {online && i.status === 'issued' && <Button size="sm" icon={ExternalLink} loading={pay.isPending && pay.variables?.id === i.id} onClick={() => pay.mutate(i)}>Pay now</Button>}
                <Button size="sm" variant="secondary" icon={Download} loading={pdf.isPending && pdf.variables?.id === i.id} onClick={() => pdf.mutate(i)}>PDF</Button>
              </div>
            ) },
          ]} />
      )}
      <ErrorBanner error={pay.error ?? pdf.error} className="m-4" />
    </Card>
  )
}

function BillingDetails({ details }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(() => ({
    legal_name: details.legal_name ?? '', gstin: details.gstin ?? '', email: details.email ?? '',
    address_line1: details.address_line1 ?? '', city: details.city ?? '', state: details.state ?? '', postal_code: details.postal_code ?? '',
  }))
  const save = useMutation({
    mutationFn: () => billingApi.saveDetails(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null]))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  return (
    <Card>
      <p className="font-semibold text-slate-900">Billing details</p>
      <p className="text-sm text-slate-500">Printed on your invoices. Add your GSTIN to claim input tax credit.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Legal name"><Input value={form.legal_name} placeholder={details.name} onChange={(e) => set({ legal_name: e.target.value })} /></Field>
        <Field label="GSTIN"><Input value={form.gstin} maxLength={15} placeholder="32ABCDE1234F1Z5" onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} /></Field>
        <Field label="Billing email"><Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="Address"><Input value={form.address_line1} onChange={(e) => set({ address_line1: e.target.value })} /></Field>
        <Field label="City"><Input value={form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State" hint="Decides CGST+SGST vs IGST"><Input value={form.state} onChange={(e) => set({ state: e.target.value })} /></Field>
          <Field label="PIN code"><Input value={form.postal_code} onChange={(e) => set({ postal_code: e.target.value })} /></Field>
        </div>
      </div>
      <ErrorBanner error={save.error} className="mt-3" />
      <div className="mt-4 flex items-center justify-end gap-3">
        {save.isSuccess && <span className="text-sm text-emerald-700">Saved</span>}
        <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save details</Button>
      </div>
    </Card>
  )
}
