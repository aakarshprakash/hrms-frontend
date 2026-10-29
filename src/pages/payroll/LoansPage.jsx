import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HandCoins, Plus, Wallet, CircleDollarSign, Users, Ban, Banknote } from 'lucide-react'
import { loanApi } from '@/lib/api/payroll'
import { apiError } from '@/lib/api/axios'
import { useRole } from '@/hooks/useRole'
import { money, dateLabel, MONTHS } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import {
  PageHeader, Card, Button, StatCard, Table, StatusPill, EmptyState, Modal, Field, Input, Select, Textarea, ErrorBanner, Tabs,
} from '@/components/ui/kit'
import EmployeePicker from '@/components/ui/EmployeePicker'

const STATE = { active: ['blue', 'Recovering'], settled: ['green', 'Settled'], cancelled: ['slate', 'Cancelled'] }
const METHOD = { payroll: 'Payroll', cash: 'Cash', bank_transfer: 'Bank transfer', waiver: 'Waived' }

/** Loans and salary advances, recovered through payroll. */
export default function LoansPage() {
  const { can } = useRole()
  const manage = can('payroll.manage')
  const [state, setState] = useState('active')
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['loans', manage ? state : 'mine'],
    queryFn: () => loanApi.list(manage && state !== 'all' ? { state } : {}).then((r) => r.data),
  })
  const rows = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader icon={HandCoins} title={manage ? 'Loans & advances' : 'My loans & advances'}
        subtitle="Instalments are deducted automatically in each month’s payroll until the balance is cleared."
        actions={manage && <Button icon={Plus} onClick={() => setCreating(true)}>New loan / advance</Button>} />

      {manage && data?.totals && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Recovering now" value={data.totals.active} icon={Users} tone="blue" />
          <StatCard label="Outstanding" value={money(data.totals.outstanding)} icon={Wallet} tone="amber" />
          <StatCard label="Disbursed (listed)" value={money(data.totals.disbursed)} icon={CircleDollarSign} tone="green" />
        </div>
      )}

      <Card padded={false}>
        {manage && (
          <div className="border-b border-slate-100 px-5 pt-2">
            <Tabs value={state} onChange={setState} tabs={[{ key: 'active', label: 'Recovering' }, { key: 'settled', label: 'Settled' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'all', label: 'All' }]} />
          </div>
        )}
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div> : (
          <Table rows={rows} onRowClick={(r) => setOpenId(r.id)}
            empty={<EmptyState icon={HandCoins} title="No loans here" description={manage ? 'Record a loan or salary advance to start recovering it through payroll.' : 'You have no loans or advances.'} />}
            columns={[
              ...(manage ? [{ key: 'employee', label: 'Employee', render: (r) => <div><p className="font-medium text-slate-900">{r.employee?.name}</p><p className="text-xs text-slate-400">{r.employee?.employee_code}</p></div> }] : []),
              { key: 'type', label: 'Type', render: (r) => <span className="capitalize">{r.type === 'advance' ? 'Salary advance' : 'Loan'}</span> },
              { key: 'principal', label: 'Amount', align: 'right', render: (r) => money(r.principal) },
              { key: 'emi', label: 'Instalment', align: 'right', render: (r) => <span>{money(r.emi)} <span className="text-xs text-slate-400">× {r.tenure_months}</span></span> },
              { key: 'start', label: 'From', render: (r) => `${MONTHS[r.start_month - 1].slice(0, 3)} ${r.start_year}` },
              { key: 'recovered', label: 'Recovered', align: 'right', render: (r) => money(r.recovered) },
              { key: 'outstanding', label: 'Balance', align: 'right', render: (r) => <span className="font-semibold text-slate-900">{money(r.outstanding)}</span> },
              { key: 'state', label: 'Status', render: (r) => <StatusPill tone={STATE[r.state][0]} label={STATE[r.state][1]} /> },
            ]} />
        )}
      </Card>

      {creating && <NewLoanModal onClose={() => setCreating(false)} />}
      {openId && <LoanDetail id={openId} manage={manage} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function NewLoanModal({ onClose }) {
  const qc = useQueryClient()
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const [employee, setEmployee] = useState(null)
  const [form, setForm] = useState({ type: 'advance', principal: '', interest_rate: '0', tenure_months: '3', start_month: String(next.getMonth() + 1), start_year: String(next.getFullYear()), reason: '' })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const [fetchedQuote, setQuote] = useState(null)
  const valid = Number(form.principal) > 0 && Number(form.tenure_months) > 0
  const quote = valid ? fetchedQuote : null

  useEffect(() => {
    if (!valid) return undefined
    const t = setTimeout(() => {
      loanApi.quote({ principal: form.principal, interest_rate: form.interest_rate || 0, tenure_months: form.tenure_months })
        .then((r) => setQuote(r.data.data)).catch(() => setQuote(null))
    }, 300)
    return () => clearTimeout(t)
  }, [valid, form.principal, form.interest_rate, form.tenure_months])

  const save = useMutation({
    mutationFn: () => loanApi.create({ ...form, employee_id: employee?.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); onClose() },
  })

  return (
    <Modal title="New loan or salary advance" onClose={onClose} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={HandCoins} loading={save.isPending} disabled={!employee || !quote} onClick={() => save.mutate()}>Record</Button></>}>
      <div className="space-y-4">
        <Field label="Employee" required><EmployeePicker value={employee} onChange={setEmployee} placeholder="Search by name or code…" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => set({ type: e.target.value, interest_rate: e.target.value === 'advance' ? '0' : form.interest_rate })}>
              <option value="advance">Salary advance (interest-free)</option>
              <option value="loan">Loan</option>
            </Select>
          </Field>
          <Field label="Amount (₹)" required><Input type="number" min={1} value={form.principal} onChange={(e) => set({ principal: e.target.value })} /></Field>
          {form.type === 'loan' && <Field label="Interest (% a year, flat)"><Input type="number" min={0} max={36} step="0.25" value={form.interest_rate} onChange={(e) => set({ interest_rate: e.target.value })} /></Field>}
          <Field label="Instalments (months)" required><Input type="number" min={1} max={120} value={form.tenure_months} onChange={(e) => set({ tenure_months: e.target.value })} /></Field>
          <Field label="First recovery in payroll of">
            <div className="flex gap-2">
              <Select value={form.start_month} onChange={(e) => set({ start_month: e.target.value })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>
              <Input type="number" className="w-24" value={form.start_year} onChange={(e) => set({ start_year: e.target.value })} />
            </div>
          </Field>
        </div>
        <Field label="Reason"><Textarea rows={2} value={form.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
        {quote && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-blue-50 p-4 text-sm">
            <div><p className="text-xs text-blue-700">Monthly instalment</p><p className="text-xl font-semibold text-slate-900">{money(quote.emi, { paise: true })}</p></div>
            <div><p className="text-xs text-blue-700">Total to recover</p><p className="text-xl font-semibold text-slate-900">{money(quote.total_payable, { paise: true })}</p></div>
          </div>
        )}
        <ErrorBanner error={save.error} message={save.error ? apiError(save.error) : undefined} />
      </div>
    </Modal>
  )
}

function LoanDetail({ id, manage, onClose }) {
  const qc = useQueryClient()
  const { data: loan, isLoading } = useQuery({ queryKey: ['loan', id], queryFn: () => loanApi.get(id).then((r) => r.data.data) })
  const [repay, setRepay] = useState({ amount: '', method: 'cash', note: '' })
  const [emi, setEmi] = useState('')
  const done = () => { qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['loan', id] }) }
  const pay = useMutation({ mutationFn: () => loanApi.repay(id, repay), onSuccess: () => { setRepay({ amount: '', method: 'cash', note: '' }); done() } })
  const update = useMutation({ mutationFn: (data) => loanApi.update(id, data), onSuccess: () => { setEmi(''); done() } })

  return (
    <Modal title={loan ? `${loan.type === 'advance' ? 'Salary advance' : 'Loan'} · ${loan.employee?.name}` : 'Loan'} onClose={onClose} size="xl">
      {isLoading || !loan ? <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            {[['Amount', money(loan.principal)], ['To recover', money(loan.total_payable)], ['Recovered', money(loan.recovered)], ['Balance', money(loan.outstanding)]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-slate-50 px-3 py-2.5"><p className="text-xs text-slate-500">{l}</p><p className="text-lg font-semibold text-slate-900">{v}</p></div>
            ))}
          </div>
          {loan.reason && <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">Reason:</span> {loan.reason}</p>}

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Recovered</p>
              <Table rows={loan.recoveries} empty={<p className="px-4 py-6 text-center text-xs text-slate-400">Nothing recovered yet.</p>}
                columns={[
                  { key: 'recovered_on', label: 'Date', render: (r) => dateLabel(r.recovered_on) },
                  { key: 'method', label: 'How', render: (r) => METHOD[r.method] ?? r.method },
                  { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount, { paise: true }) },
                ]} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Upcoming instalments</p>
              <Table rows={loan.schedule.map((s) => ({ ...s, id: s.month }))} empty={<p className="px-4 py-6 text-center text-xs text-slate-400">Nothing left to recover.</p>}
                columns={[
                  { key: 'label', label: 'Payroll month' },
                  { key: 'amount', label: 'Instalment', align: 'right', render: (r) => money(r.amount, { paise: true }) },
                  { key: 'balance_after', label: 'Balance after', align: 'right', render: (r) => money(r.balance_after, { paise: true }) },
                ]} />
            </div>
          </div>

          {manage && loan.state === 'active' && (
            <div className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Banknote size={15} /> Record a repayment</p>
                <div className="flex flex-wrap gap-2">
                  <Input type="number" className="w-32" placeholder="Amount" value={repay.amount} onChange={(e) => setRepay({ ...repay, amount: e.target.value })} />
                  <Select className="w-40" value={repay.method} onChange={(e) => setRepay({ ...repay, method: e.target.value })}>
                    <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="waiver">Waive</option>
                  </Select>
                  <Button size="sm" variant="secondary" onClick={() => setRepay({ ...repay, amount: String(loan.outstanding) })}>Full balance</Button>
                </div>
                <Input placeholder="Note (optional)" value={repay.note} onChange={(e) => setRepay({ ...repay, note: e.target.value })} />
                <Button size="sm" loading={pay.isPending} disabled={!(Number(repay.amount) > 0)} onClick={() => pay.mutate()}>Record</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Change instalment</p>
                <div className="flex gap-2">
                  <Input type="number" className="w-32" placeholder={String(loan.emi)} value={emi} onChange={(e) => setEmi(e.target.value)} />
                  <Button size="sm" variant="secondary" loading={update.isPending && update.variables?.emi} disabled={!(Number(emi) > 0)} onClick={() => update.mutate({ emi })}>Update</Button>
                </div>
                {loan.recovered === 0 && (
                  <Button size="sm" variant="ghost" icon={Ban} loading={update.isPending && update.variables?.status}
                    onClick={() => { if (confirm('Cancel this loan? Nothing has been recovered yet.')) update.mutate({ status: 'cancelled' }) }}>Cancel loan</Button>
                )}
              </div>
              <ErrorBanner error={pay.error ?? update.error} message={(pay.error ?? update.error) ? apiError(pay.error ?? update.error) : undefined} className="lg:col-span-2" />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
