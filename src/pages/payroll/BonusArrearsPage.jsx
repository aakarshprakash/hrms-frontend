import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Gift, History, Calculator, CheckCircle2, Info } from 'lucide-react'
import { payrollApi, payrollExtrasApi } from '@/lib/api/payroll'
import { apiError } from '@/lib/api/axios'
import { useAuthStore } from '@/store/authStore'
import { money, MONTHS } from '@/lib/format'
import { PageHeader, Card, Button, Field, Input, Select, Table, StatusPill, EmptyState, ErrorBanner, Tabs } from '@/components/ui/kit'

function fyOptions() {
  const t = new Date()
  const start = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1
  return [start, start - 1, start - 2].map((y) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`)
}

/** Statutory bonus and arrears after back-dated revisions — previewed, then added to a payroll run. */
export default function BonusArrearsPage() {
  const branches = useAuthStore((s) => s.branches)
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [tab, setTab] = useState('bonus')
  const [branchId, setBranchId] = useState(String(activeBranchId ?? branches[0]?.id ?? ''))

  const { data: runs } = useQuery({
    queryKey: ['payroll-runs-open', branchId],
    queryFn: () => payrollApi.listRuns({ branch_id: branchId, per_page: 50 }).then((r) => r.data.data ?? r.data),
    enabled: !!branchId,
  })
  const openRuns = (runs ?? []).filter((r) => ['draft', 'processed'].includes(r.status))

  return (
    <div className="space-y-6">
      <PageHeader icon={Gift} title="Bonus & arrears" subtitle="Work out statutory bonus or salary-revision arrears, check them, then add them to a payroll run." />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'bonus', label: 'Statutory bonus' }, { key: 'arrears', label: 'Arrears' }]} />
        {branches.length > 1 && (
          <Select className="w-56" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
      </div>
      {tab === 'bonus' ? <Bonus branchId={branchId} openRuns={openRuns} /> : <Arrears openRuns={openRuns} />}
    </div>
  )
}

function RunSelect({ runs, value, onChange }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a draft / processed run…</option>
      {runs.map((r) => <option key={r.id} value={r.id}>{MONTHS[r.month - 1]} {r.year} · {r.status}</option>)}
    </Select>
  )
}

function Bonus({ branchId, openRuns }) {
  const fys = fyOptions()
  const [form, setForm] = useState({ financial_year: fys[1], rate: '8.33', eligibility_ceiling: '21000', calculation_ceiling: '7000' })
  const [runId, setRunId] = useState('')
  const [params, setParams] = useState(null)
  const set = (p) => setForm((f) => ({ ...f, ...p }))

  const { data, isFetching, error } = useQuery({
    queryKey: ['bonus', params],
    queryFn: () => payrollExtrasApi.bonus(params).then((r) => r.data.data),
    enabled: !!params,
  })
  const apply = useMutation({ mutationFn: () => payrollExtrasApi.applyBonus({ ...params, payroll_run_id: runId }).then((r) => r.data) })

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Financial year"><Select value={form.financial_year} onChange={(e) => set({ financial_year: e.target.value })}>{fys.map((f) => <option key={f}>{f}</option>)}</Select></Field>
          <Field label="Bonus rate (%)" hint="8.33 minimum, 20 maximum"><Input type="number" min={8.33} max={20} step="0.01" value={form.rate} onChange={(e) => set({ rate: e.target.value })} /></Field>
          <Field label="Eligible up to (₹/month)" hint="Basic + DA"><Input type="number" value={form.eligibility_ceiling} onChange={(e) => set({ eligibility_ceiling: e.target.value })} /></Field>
          <Field label="Calculate on up to (₹/month)" hint="₹7,000 or the minimum wage"><Input type="number" value={form.calculation_ceiling} onChange={(e) => set({ calculation_ceiling: e.target.value })} /></Field>
          <div className="flex items-end"><Button icon={Calculator} className="w-full" loading={isFetching} onClick={() => setParams({ ...form, branch_id: branchId })}>Calculate</Button></div>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500"><Info size={13} className="mt-0.5 shrink-0" />
          From the year’s processed payslips: salary = Basic + DA lines; eligible with at least 30 paid days; bonus = rate × each month’s salary up to the calculation ceiling, pro rata for days paid.</p>
      </Card>
      <ErrorBanner error={error} />
      {data && (
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{data.totals.eligible}</span> of {data.totals.employees} eligible · total <span className="font-semibold text-slate-900">{money(data.totals.bonus)}</span></p>
            <div className="flex items-center gap-2">
              <div className="w-64"><RunSelect runs={openRuns} value={runId} onChange={setRunId} /></div>
              <Button icon={CheckCircle2} disabled={!runId || !data.totals.bonus} loading={apply.isPending} onClick={() => apply.mutate()}>Add to run</Button>
            </div>
          </div>
          {apply.data && <p className="flex items-center gap-2 bg-emerald-50 px-5 py-2 text-sm text-emerald-800"><CheckCircle2 size={15} />{apply.data.message}</p>}
          <ErrorBanner error={apply.error} message={apply.error ? apiError(apply.error) : undefined} className="m-4" />
          <Table rows={data.rows} rowKey="employee_id" empty={<EmptyState icon={Gift} title="No payslips in this year" description="Bonus is worked out from processed payroll runs." />}
            columns={[
              { key: 'name', label: 'Employee', render: (r) => <div><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-400">{r.employee_code}</p></div> },
              { key: 'months', label: 'Months', align: 'right' },
              { key: 'payable_days', label: 'Days paid', align: 'right' },
              { key: 'avg_monthly_salary', label: 'Avg salary/mo', align: 'right', render: (r) => money(r.avg_monthly_salary) },
              { key: 'bonus_wages', label: 'Bonus wages', align: 'right', render: (r) => money(r.bonus_wages) },
              { key: 'eligible', label: 'Eligible', render: (r) => r.eligible ? <StatusPill tone="green" label="Yes" /> : <StatusPill tone="slate" label={r.reason} /> },
              { key: 'bonus', label: 'Bonus', align: 'right', render: (r) => <span className="font-semibold text-slate-900">{money(r.bonus)}</span> },
            ]} />
        </Card>
      )}
    </div>
  )
}

function Arrears({ openRuns }) {
  const [runId, setRunId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [params, setParams] = useState(null)

  const { data, isFetching, error } = useQuery({
    queryKey: ['arrears', params],
    queryFn: () => payrollExtrasApi.arrears(params).then((r) => r.data.data),
    enabled: !!params,
  })
  const apply = useMutation({ mutationFn: () => payrollExtrasApi.applyArrears(params).then((r) => r.data) })

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Pay arrears in"><RunSelect runs={openRuns} value={runId} onChange={setRunId} /></Field>
          <Field label="Revision effective from" hint="First month to recompute"><Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Up to" hint="Last month already paid"><Input type="month" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="flex items-end"><Button icon={Calculator} className="w-full" disabled={!runId || !from || !to} loading={isFetching}
            onClick={() => setParams({ payroll_run_id: runId, from, to })}>Calculate</Button></div>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500"><Info size={13} className="mt-0.5 shrink-0" />
          Update the salary structure with the back-dated effective date first. Each processed month in the range is then recomputed with the new salary — same attendance — and compared with what was paid. The basic part attracts PF.</p>
      </Card>
      <ErrorBanner error={error} message={error ? apiError(error) : undefined} />
      {data && (
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <p className="text-sm text-slate-600">{data.runs} month(s) recomputed · <span className="font-semibold text-slate-900">{data.totals.employees}</span> employee(s) · arrears <span className="font-semibold text-slate-900">{money(data.totals.arrears)}</span>
              {data.totals.recoveries < 0 && <> · <span className="text-rose-600">{money(data.totals.recoveries)} overpaid (not recovered automatically)</span></>}</p>
            <Button icon={CheckCircle2} disabled={!data.totals.arrears} loading={apply.isPending} onClick={() => apply.mutate()}>Add to run</Button>
          </div>
          {apply.data && <p className="flex items-center gap-2 bg-emerald-50 px-5 py-2 text-sm text-emerald-800"><CheckCircle2 size={15} />{apply.data.message}</p>}
          <ErrorBanner error={apply.error} message={apply.error ? apiError(apply.error) : undefined} className="m-4" />
          <Table rows={data.rows} rowKey="employee_id" empty={<EmptyState icon={History} title="No differences" description="Pay in these months already matches the current salary structure." />}
            columns={[
              { key: 'name', label: 'Employee', render: (r) => <div><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-400">{r.employee_code}</p></div> },
              { key: 'month_labels', label: 'Months', render: (r) => <span className="text-xs">{r.month_labels}</span> },
              { key: 'paid', label: 'Paid', align: 'right', render: (r) => money(r.paid) },
              { key: 'due', label: 'Due now', align: 'right', render: (r) => money(r.due) },
              { key: 'pf_part', label: 'On PF wages', align: 'right', render: (r) => money(r.pf_part) },
              { key: 'arrears', label: 'Arrears', align: 'right', render: (r) => <span className={r.arrears < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-slate-900'}>{money(r.arrears)}</span> },
            ]} />
        </Card>
      )}
    </div>
  )
}
