import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Receipt, Save, CheckCircle2, Ban, FilePlus2 } from 'lucide-react'
import { billingApi } from '@/lib/api/billing'
import { money, dateLabel } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { Card, CardHeader, Button, Field, Input, Select, Modal, StatusPill, ErrorBanner, Table, EmptyState } from '@/components/ui/kit'

/** The platform operator's view of one organisation's subscription and invoices. */
export default function SubscriptionPanel({ companyId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-subscription', companyId],
    queryFn: () => billingApi.companySubscription(companyId).then((r) => r.data),
  })

  if (isLoading || !data) return <Card className="mt-6 flex justify-center py-10"><Spinner className="h-6 w-6" /></Card>

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <SubscriptionForm key={data.data.subscription?.id ?? 'none'} companyId={companyId} data={data} />
      <InvoiceList companyId={companyId} invoices={data.data.invoices} />
    </div>
  )
}

function SubscriptionForm({ companyId, data }) {
  const qc = useQueryClient()
  const s = data.data.subscription
  const [form, setForm] = useState(() => ({
    plan_code: s?.plan?.code ?? 'legacy',
    status: s?.status ?? 'active',
    billing_cycle: s?.billing_cycle ?? 'monthly',
    trial_ends_at: s?.trial_ends_at ? s.trial_ends_at.slice(0, 10) : '',
    current_period_end: s?.current_period_end ?? '',
    custom_monthly_price: s?.custom_monthly_price ?? '',
    notes: s?.notes ?? '',
  }))
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const refresh = () => qc.invalidateQueries({ queryKey: ['platform-subscription', companyId] })

  const save = useMutation({
    mutationFn: () => billingApi.updateCompanySubscription(companyId, {
      ...form,
      trial_ends_at: form.trial_ends_at || null,
      current_period_end: form.current_period_end || null,
      custom_monthly_price: form.custom_monthly_price === '' ? null : Number(form.custom_monthly_price),
    }),
    onSuccess: refresh,
  })
  const issue = useMutation({ mutationFn: () => billingApi.issueInvoice(companyId), onSuccess: refresh })

  return (
    <Card padded={false}>
      <CardHeader title="Subscription" icon={CreditCard}
        subtitle={s ? `${s.plan?.name} · ${data.data.employees} active employees · ${data.data.features.length} modules` : 'No subscription: every module on'}
        actions={s && <StatusPill status={s.status === 'trialing' ? 'processing' : s.status} label={s.status.replace('_', ' ')} />} />
      <div className="space-y-3 p-5">
        <ErrorBanner error={save.error ?? issue.error} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Plan">
            <Select value={form.plan_code} onChange={(e) => set({ plan_code: e.target.value })}>
              {data.plans.map((p) => <option key={p.code} value={p.code}>{p.name}{!p.is_public ? ' (private)' : ''}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set({ status: e.target.value })}>
              {['trialing', 'active', 'past_due', 'expired', 'cancelled'].map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Billing">
            <Select value={form.billing_cycle} onChange={(e) => set({ billing_cycle: e.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
          <Field label="Trial ends"><Input type="date" value={form.trial_ends_at} onChange={(e) => set({ trial_ends_at: e.target.value })} /></Field>
          <Field label="Period ends"><Input type="date" value={form.current_period_end} onChange={(e) => set({ current_period_end: e.target.value })} /></Field>
          <Field label="Agreed price / month" hint="Blank = plan price"><Input type="number" min="0" value={form.custom_monthly_price} onChange={(e) => set({ custom_monthly_price: e.target.value })} /></Field>
        </div>
        <Field label="Notes (internal)"><Input value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <Button variant="secondary" icon={FilePlus2} loading={issue.isPending} disabled={!s?.current_period_end} onClick={() => issue.mutate()}>Issue invoice for this period</Button>
          <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save subscription</Button>
        </div>
      </div>
    </Card>
  )
}

function InvoiceList({ companyId, invoices }) {
  const qc = useQueryClient()
  const [paying, setPaying] = useState(null)
  const [payment, setPayment] = useState({ payment_method: 'bank_transfer', payment_reference: '', paid_at: '' })
  const refresh = () => qc.invalidateQueries({ queryKey: ['platform-subscription', companyId] })
  const markPaid = useMutation({
    mutationFn: () => billingApi.markInvoicePaid(paying.id, { ...payment, paid_at: payment.paid_at || undefined }),
    onSuccess: () => { refresh(); setPaying(null) },
  })
  const voidInvoice = useMutation({ mutationFn: (id) => billingApi.voidInvoice(id), onSuccess: refresh })

  return (
    <Card padded={false}>
      <CardHeader title="Invoices" icon={Receipt} />
      <Table rows={invoices} empty={<EmptyState title="No invoices" />}
        columns={[
          { key: 'number', label: 'Invoice', render: (i) => <div><p className="font-mono text-xs font-semibold">{i.number}</p><p className="text-[11px] text-slate-400">{dateLabel(i.period_start)} – {dateLabel(i.period_end)}</p></div> },
          { key: 'total', label: 'Total', align: 'right', render: (i) => money(i.total, { paise: true }) },
          { key: 'status', label: 'Status', render: (i) => <StatusPill status={i.status === 'issued' ? 'pending' : i.status} label={i.status === 'issued' ? `Due ${dateLabel(i.due_on)}` : undefined} /> },
          { key: 'actions', label: '', align: 'right', render: (i) => i.status === 'issued' && (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => setPaying(i)}>Paid</Button>
              <Button size="sm" variant="ghost" icon={Ban} onClick={() => { if (confirm(`Void ${i.number}?`)) voidInvoice.mutate(i.id) }}>Void</Button>
            </div>
          ) },
        ]} />
      {paying && (
        <Modal size="sm" title={`Record payment · ${paying.number}`} subtitle={money(paying.total, { paise: true })} onClose={() => setPaying(null)}
          footer={<><Button variant="secondary" onClick={() => setPaying(null)}>Cancel</Button><Button loading={markPaid.isPending} onClick={() => markPaid.mutate()}>Mark paid</Button></>}>
          <div className="space-y-3">
            <ErrorBanner error={markPaid.error} />
            <Field label="Method">
              <Select value={payment.payment_method} onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })}>
                <option value="bank_transfer">Bank transfer (NEFT/RTGS/IMPS)</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Reference (UTR / cheque no.)"><Input value={payment.payment_reference} onChange={(e) => setPayment({ ...payment, payment_reference: e.target.value })} /></Field>
            <Field label="Paid on"><Input type="date" value={payment.paid_at} onChange={(e) => setPayment({ ...payment, paid_at: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </Card>
  )
}
