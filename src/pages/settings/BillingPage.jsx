import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, Check, Download, AlertTriangle, Users, Building2, Save, CheckCircle2, Zap, KeyRound, RefreshCw } from 'lucide-react'
import { billingApi, FEATURE_LABELS, DEFAULT_CYCLES, CYCLE_NOUN } from '@/lib/api/billing'
import { apiError } from '@/lib/api/axios'
import { payInvoice } from '@/lib/razorpay'
import CycleToggle from '@/components/billing/CycleToggle'
import { saveBlob } from '@/lib/api/payroll'
import { refreshSession } from '@/lib/session'
import { money, dateLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, CardHeader, Button, StatusPill, Field, Input, ErrorBanner, Table, EmptyState, Toggle } from '@/components/ui/kit'

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
      <div className="grid gap-6 lg:grid-cols-2">
        <RedeemLicense />
        {data.subscription?.is_live && data.subscription?.billing_mode !== 'license' && <Autopay data={data} />}
      </div>
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
            {s.status === 'active' && s.current_period_end && s.billing_mode === 'license' && `Licence ${s.license?.key ?? ''} · valid until ${dateLabel(s.current_period_end)}. Redeem a new key before then to continue.`}
            {s.status === 'active' && s.current_period_end && s.billing_mode !== 'license' && `${(data.cycles ?? DEFAULT_CYCLES).find((c) => c.key === s.billing_cycle)?.label ?? 'Monthly'} · renews ${dateLabel(s.current_period_end)}`}
            {s.status === 'active' && !s.current_period_end && 'No renewal needed.'}
            {s.status === 'expired' && 'You’re on the free core (attendance, leave, self-service). Choose a plan to switch the other modules back on.'}
            {s.status === 'past_due' && (s.billing_mode === 'license' ? 'Your licence has run out — redeem a new key to avoid interruption.' : 'An invoice is overdue — please pay to avoid interruption.')}
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
      {s.plan?.features?.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Included in your plan</p>
          <div className="flex flex-wrap gap-1.5">
            {s.plan.features.filter((f) => FEATURE_LABELS[f]).map((f) => (
              <span key={f} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                <Check size={12} />{FEATURE_LABELS[f]}
              </span>
            ))}
          </div>
        </div>
      )}
      <ErrorBanner error={cancel.error ?? resume.error} className="mt-3" />
    </Card>
  )
}

/** A key from the platform team, for plans paid by bank transfer, UPI or cheque. */
function RedeemLicense() {
  const qc = useQueryClient()
  const [key, setKey] = useState('')
  const redeem = useMutation({
    mutationFn: () => billingApi.redeemLicense(key.trim()),
    onSuccess: async () => { setKey(''); await refreshSession().catch(() => {}); qc.invalidateQueries({ queryKey: ['billing'] }) },
  })

  return (
    <Card padded={false}>
      <CardHeader icon={KeyRound} title="Have a licence key?" subtitle="Paid by bank transfer, UPI or cheque? Enter the key we sent you to activate your plan." />
      <form className="space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); if (key.trim()) redeem.mutate() }}>
        <ErrorBanner error={redeem.error} />
        {redeem.isSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 size={15} /> {redeem.data?.data?.message}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="PNX-XXXXX-XXXXX-XXXXX-XXXXX"
            className="font-mono tracking-wide placeholder:font-sans placeholder:tracking-normal" aria-label="Licence key" />
          <Button type="submit" loading={redeem.isPending} disabled={!key.trim()}>Activate</Button>
        </div>
      </form>
    </Card>
  )
}

/** Automatic renewal by card / UPI mandate. Charging is switched on by the platform; the choice is kept until then. */
function Autopay({ data }) {
  const qc = useQueryClient()
  const s = data.subscription
  const save = useMutation({
    mutationFn: (on) => billingApi.setAutopay(on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  })

  return (
    <Card padded={false}>
      <CardHeader icon={RefreshCw} title="Autopay" subtitle="Renew automatically so modules never switch off." />
      <div className="space-y-3 p-5">
        <ErrorBanner error={save.error} />
        <Toggle checked={!!s.autopay} disabled={save.isPending} onChange={(on) => save.mutate(on)}
          label={s.autopay ? 'Autopay is on' : 'Autopay is off'}
          description={s.autopay ? 'Each renewal is charged to your saved card or UPI mandate.' : 'You’ll get an invoice at each renewal and pay it yourself.'} />
        {!data.autopay_available && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Automatic charging isn’t live yet. Your choice is saved; until it’s enabled, renewals are invoiced as usual.
          </p>
        )}
      </div>
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
  const cycles = data.cycles?.length ? data.cycles : DEFAULT_CYCLES
  const [cycle, setCycle] = useState(current?.billing_cycle ?? 'monthly')
  const [notice, setNotice] = useState(null)
  const trialing = current?.status === 'trialing'
  const refresh = async () => {
    await refreshSession().catch(() => {})
    qc.invalidateQueries({ queryKey: ['billing'] })
    qc.invalidateQueries({ queryKey: ['billing-invoices'] })
  }
  const choose = useMutation({
    mutationFn: ({ code, startNow }) => billingApi.choosePlan({ plan_code: code, billing_cycle: cycle, start_now: startNow }).then((r) => r.data),
    onSuccess: async (res, { startNow }) => {
      await refresh()
      setNotice(res.message)
      // Started a paid period: take the person straight to payment.
      if (startNow && res.invoice && data.online_payment) {
        try {
          const paid = await payInvoice(res.invoice)
          setNotice(paid.message)
          await refresh()
        } catch (err) {
          if (!err.cancelled) setNotice(apiError(err))
        }
      }
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold text-slate-900">Plans</p>
        <CycleToggle cycles={cycles} value={cycle} onChange={setCycle} />
      </div>
      <ErrorBanner error={choose.error} />
      {notice && <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800"><CheckCircle2 size={16} />{notice}</div>}
      <div className="grid gap-4 lg:grid-cols-3">
        {data.plans.map((p) => {
          const isCurrent = current?.plan?.code === p.code && current?.is_live
          const price = p.estimates?.[cycle] ?? (cycle === 'yearly' ? p.yearly_estimate : p.monthly_estimate)
          const busy = choose.isPending && choose.variables?.code === p.code
          return (
            <Card key={p.code} className={cn('flex flex-col', isCurrent && 'ring-2 ring-blue-500')}>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-slate-900">{p.name}</p>
                {isCurrent && <StatusPill tone="blue" label="Current" dot={false} />}
              </div>
              <p className="mt-1 min-h-[40px] text-sm text-slate-500">{p.description}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{money(price)}<span className="text-sm font-medium text-slate-400"> /{CYCLE_NOUN[cycle] ?? cycle}</span></p>
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
                disabled={(isCurrent && current?.billing_cycle === cycle) || choose.isPending} loading={busy && !choose.variables?.startNow}
                onClick={() => choose.mutate({ code: p.code, startNow: false })}>
                {isCurrent ? (current?.billing_cycle === cycle ? 'Your plan' : `Switch to ${cycles.find((c) => c.key === cycle)?.label.toLowerCase()}`) : `Choose ${p.name}`}
              </Button>
              {trialing && data.online_payment && (
                <Button className="mt-2 w-full" variant="ghost" size="sm" icon={Zap} disabled={choose.isPending} loading={busy && choose.variables?.startNow}
                  onClick={() => { if (confirm(`End your trial and start ${p.name} today? The first invoice is issued now.`)) choose.mutate({ code: p.code, startNow: true }) }}>
                  Skip trial & pay now
                </Button>
              )}
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
  const qc = useQueryClient()
  const pay = useMutation({
    mutationFn: (i) => payInvoice(i).catch((err) => { if (err.cancelled) return null; throw err }),
    onSuccess: async (res) => {
      if (!res) return
      await refreshSession().catch(() => {})
      qc.invalidateQueries({ queryKey: ['billing'] })
      qc.invalidateQueries({ queryKey: ['billing-invoices'] })
    },
  })

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
                {online && i.status === 'issued' && <Button size="sm" icon={CreditCard} loading={pay.isPending && pay.variables?.id === i.id} onClick={() => pay.mutate(i)}>Pay now</Button>}
                <Button size="sm" variant="secondary" icon={Download} loading={pdf.isPending && pdf.variables?.id === i.id} onClick={() => pdf.mutate(i)}>PDF</Button>
              </div>
            ) },
          ]} />
      )}
      <ErrorBanner error={pay.error ?? pdf.error} message={pay.error ? apiError(pay.error) : undefined} className="m-4" />
      {pay.data?.message && <p className="m-4 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} />{pay.data.message}</p>}
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
