import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Play, RefreshCw, CheckCircle2, Lock, Unlock, Banknote, Download, Trash2, AlertTriangle, FileText, Users,
  IndianRupee, Wallet, Building2, Search,
} from 'lucide-react'
import { payrollApi, openPayslipPdf, saveBlob } from '@/lib/api/payroll'
import { apiError } from '@/lib/api/axios'
import { useRole } from '@/hooks/useRole'
import { money, days, monthLabel, dateLabel } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import PayslipBreakdown from '@/components/payroll/PayslipBreakdown'
import AdjustmentsPanel from '@/components/payroll/AdjustmentsPanel'
import { Card, Button, Modal, Field, Input, StatusPill, StatCard, Table, Tabs, EmptyState, ErrorBanner } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

const STEPS = [
  { key: 'draft', label: 'Draft', hint: 'Inputs & adjustments' },
  { key: 'processed', label: 'Processed', hint: 'Review payslips' },
  { key: 'finalized', label: 'Finalized', hint: 'Published, attendance locked' },
  { key: 'paid', label: 'Paid', hint: 'Salaries disbursed' },
]

function Stepper({ status }) {
  const current = Math.max(0, STEPS.findIndex((s) => s.key === (status === 'processing' ? 'draft' : status)))
  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((s, i) => (
        <li key={s.key} className={cn('rounded-xl border px-3 py-2.5', i < current ? 'border-emerald-200 bg-emerald-50/60' : i === current ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white')}>
          <div className="flex items-center gap-2">
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
              i < current ? 'bg-emerald-500 text-white' : i === current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500')}>
              {i < current ? '✓' : i + 1}
            </span>
            <span className={cn('text-sm font-semibold', i <= current ? 'text-slate-900' : 'text-slate-400')}>{s.label}</span>
          </div>
          <p className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{s.hint}</p>
        </li>
      ))}
    </ol>
  )
}

export default function PayrollRunDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { can } = useRole()
  const [tab, setTab] = useState('payslips')
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [paidOpen, setPaidOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState(null)

  const canManage = can('payroll.manage')
  const canFinalize = can('payroll.finalize')

  const { data: run, isLoading } = useQuery({
    queryKey: ['payroll-run', id],
    queryFn: () => payrollApi.getRun(id).then((r) => r.data?.data),
  })
  const isDraft = run?.status === 'draft'
  const hasPayslips = ['processed', 'finalized', 'paid'].includes(run?.status)

  const { data: preview, isFetching: previewing } = useQuery({
    queryKey: ['payroll-preview', id],
    queryFn: () => payrollApi.previewRun(id).then((r) => r.data?.data),
    enabled: !!run && isDraft && canManage,
  })
  const { data: payslips = [] } = useQuery({
    queryKey: ['payroll-payslips', id, run?.status],
    queryFn: () => payrollApi.listPayslips({ payroll_run_id: id, per_page: 200 }).then((r) => r.data?.data ?? []),
    enabled: hasPayslips,
  })

  const refresh = (message) => {
    qc.invalidateQueries({ queryKey: ['payroll-run', id] })
    qc.invalidateQueries({ queryKey: ['payroll-payslips', id] })
    qc.invalidateQueries({ queryKey: ['payroll-preview', id] })
    qc.invalidateQueries({ queryKey: ['payroll-runs'] })
    setNotice(message)
  }

  const action = useMutation({
    mutationFn: ({ fn }) => fn(),
    onSuccess: (res) => { refresh(res?.data?.message); setConfirm(null) },
  })

  const rows = useMemo(() => {
    const source = hasPayslips ? payslips : (preview?.rows ?? [])
    return source.map((r) => ({
      ...r,
      key: r.id ?? `p-${r.employee.id}`,
      name: r.employee?.name ?? `${r.employee?.first_name ?? ''} ${r.employee?.last_name ?? ''}`.trim(),
      code: r.employee?.employee_code,
      warnings: r.warnings ?? r.breakdown_json?.warnings ?? [],
    }))
  }, [hasPayslips, payslips, preview])

  const filtered = search ? rows.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(search.toLowerCase())) : rows
  const totals = hasPayslips ? run?.totals : preview?.totals

  if (isLoading || !run) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>

  async function downloadBank() {
    try {
      const res = await payrollApi.bankExport(run.id)
      saveBlob(res.data, `salary-transfer-${run.year}-${String(run.month).padStart(2, '0')}-${run.branch?.name ?? run.branch_id}.csv`, 'text/csv')
    } catch (err) {
      setNotice(apiError(err))
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/payroll/runs" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Payroll runs</Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{monthLabel(run.month, run.year)}</h1>
            <StatusPill status={run.status} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {run.branch?.name} · {run.branch?.payroll_days_in_month ? `${run.branch.payroll_days_in_month}-day pay basis` : 'Calendar-day pay basis'}
            {run.processed_at && ` · processed ${dateLabel(run.processed_at)}${run.run_by ? ` by ${run.run_by.name}` : ''}`}
            {run.finalized_at && ` · finalized ${dateLabel(run.finalized_at)}${run.finalized_by ? ` by ${run.finalized_by.name}` : ''}`}
            {run.paid_at && ` · paid ${dateLabel(run.paid_at)}${run.payment_reference ? ` (${run.payment_reference})` : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && ['draft', 'processed'].includes(run.status) && (
            <Button icon={run.status === 'draft' ? Play : RefreshCw} loading={action.isPending && confirm === null}
              onClick={() => action.mutate({ fn: () => payrollApi.triggerRun(run.id) })}>
              {run.status === 'draft' ? 'Process payroll' : 'Re-process'}
            </Button>
          )}
          {canFinalize && run.status === 'processed' && (
            <Button variant="success" icon={Lock} onClick={() => setConfirm('finalize')}>Finalize &amp; publish</Button>
          )}
          {canFinalize && run.status === 'finalized' && (
            <>
              <Button variant="success" icon={Banknote} onClick={() => setPaidOpen(true)}>Mark as paid</Button>
              <Button variant="secondary" icon={Unlock} onClick={() => setConfirm('reopen')}>Reopen</Button>
            </>
          )}
          {canManage && ['finalized', 'paid'].includes(run.status) && (
            <Button variant="secondary" icon={Download} onClick={downloadBank}>Bank transfer file</Button>
          )}
          {canManage && ['draft', 'processed'].includes(run.status) && (
            <Button variant="ghost" icon={Trash2} onClick={() => setConfirm('delete')}>Delete</Button>
          )}
        </div>
      </div>

      <Stepper status={run.status} />

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {notice}
        </div>
      )}
      <ErrorBanner error={action.error} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Employees" value={totals?.employees ?? totals?.employee_count ?? '—'} icon={Users} />
        <StatCard label="Gross pay" value={money(totals?.gross ?? totals?.total_gross)} icon={IndianRupee} tone="green" />
        <StatCard label="Deductions" value={money(totals?.deductions ?? totals?.total_deductions)} icon={Wallet} tone="red" />
        <StatCard label="Net pay" value={money(totals?.net ?? totals?.total_net)} icon={Banknote} tone="blue" />
        <StatCard label="Cost to company" value={money(totals?.employer_cost)} icon={Building2} tone="purple" />
      </div>

      {totals && (
        <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 py-3 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Statutory</span>
          <span>PF <b>{money(Number(totals.pf_employee ?? 0) + Number(totals.pf_employer ?? 0))}</b> <span className="text-xs text-slate-400">(emp {money(totals.pf_employee)} + er {money(totals.pf_employer)})</span></span>
          <span>ESI <b>{money(Number(totals.esi_employee ?? 0) + Number(totals.esi_employer ?? 0))}</b></span>
          <span>Prof. tax <b>{money(totals.professional_tax)}</b></span>
          <span>TDS <b>{money(totals.tds)}</b></span>
          <span>LOP days <b>{days(totals.lop_days)}</b></span>
          {Number(totals.warnings) > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={14} /> {totals.warnings} warning(s)</span>}
        </Card>
      )}

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'payslips', label: hasPayslips ? 'Payslips' : 'Preview', count: rows.length },
        { key: 'adjustments', label: 'Adjustments' },
      ]} />

      {tab === 'payslips' && (
        <Card padded={false}>
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {hasPayslips
                ? (run.status === 'processed' ? 'Under review — employees can\'t see these yet.' : 'Published to employees.')
                : 'Live preview — nothing is saved until you process the run.'}
              {previewing && <Spinner className="ml-2 inline-block h-3.5 w-3.5 align-middle" />}
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input className="pl-8" placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <Table rows={filtered} rowKey="key" onRowClick={setSelected}
            empty={<EmptyState icon={FileText} title={isDraft && !canManage ? 'Not processed yet' : 'No employees in this run'} />}
            columns={[
              { key: 'name', label: 'Employee', render: (r) => (
                <div className="flex items-center gap-2">
                  {r.warnings.length > 0 && <AlertTriangle size={14} className="shrink-0 text-amber-500" title={r.warnings.join(' ')} />}
                  <div><p className="font-medium text-slate-800">{r.name}</p><p className="text-xs text-slate-400">{r.code}</p></div>
                </div>
              ) },
              { key: 'payable_days', label: 'Payable days', align: 'right', render: (r) => days(r.payable_days) },
              { key: 'lop_days', label: 'LOP', align: 'right', render: (r) => <span className={Number(r.lop_days) > 0 ? 'font-medium text-rose-600' : 'text-slate-400'}>{days(r.lop_days)}</span> },
              { key: 'gross_pay', label: 'Gross', align: 'right', render: (r) => money(r.gross_pay) },
              { key: 'total_deductions', label: 'Deductions', align: 'right', render: (r) => <span className="text-rose-700">{money(r.total_deductions)}</span> },
              { key: 'net_pay', label: 'Net pay', align: 'right', render: (r) => <span className="font-semibold text-slate-900">{money(r.net_pay)}</span> },
            ]} />
        </Card>
      )}

      {tab === 'adjustments' && <AdjustmentsPanel run={run} editable={canManage && ['draft', 'processed'].includes(run.status)} />}

      {selected && (
        <Modal size="lg" title={selected.name} subtitle={`${selected.code} · ${monthLabel(run.month, run.year)}`} onClose={() => setSelected(null)}
          footer={selected.id && <Button variant="secondary" icon={Download} onClick={() => openPayslipPdf(selected.id, { download: true })}>Download PDF</Button>}>
          <PayslipBreakdown row={selected} />
        </Modal>
      )}

      {confirm === 'finalize' && (
        <ConfirmDialog title="Finalize and publish payslips?"
          message="Employees will be able to see and download their payslips, and this month's attendance will be locked. You can reopen the run until it is marked paid."
          confirmLabel="Finalize" isPending={action.isPending}
          onConfirm={() => action.mutate({ fn: () => payrollApi.finalizeRun(run.id) })} onCancel={() => setConfirm(null)} />
      )}
      {confirm === 'reopen' && (
        <ConfirmDialog title="Reopen this payroll run?" message="Payslips will be hidden from employees and attendance unlocked until you finalize again."
          confirmLabel="Reopen" isPending={action.isPending}
          onConfirm={() => action.mutate({ fn: () => payrollApi.reopenRun(run.id) })} onCancel={() => setConfirm(null)} />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog danger title="Delete this payroll run?" message="Its payslips and adjustments are removed. Attendance is not affected."
          confirmLabel="Delete run" isPending={action.isPending}
          onConfirm={() => payrollApi.deleteRun(run.id).then(() => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); navigate('/payroll/runs') })}
          onCancel={() => setConfirm(null)} />
      )}
      {paidOpen && <MarkPaidModal run={run} onClose={() => setPaidOpen(false)} onDone={(m) => { setPaidOpen(false); refresh(m) }} />}
    </div>
  )
}

function MarkPaidModal({ run, onClose, onDone }) {
  const [reference, setReference] = useState('')
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10))
  const save = useMutation({
    mutationFn: () => payrollApi.markPaid(run.id, { payment_reference: reference || undefined, paid_on: paidOn }),
    onSuccess: (res) => onDone(res.data?.message),
  })
  return (
    <Modal size="sm" title="Mark salaries as paid" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="success" loading={save.isPending} onClick={() => save.mutate()}>Mark paid</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={save.error} />
        <Field label="Payment reference" hint="e.g. the bank's bulk NEFT batch number"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label="Paid on"><Input type="date" value={paidOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidOn(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

