import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, Download, Plus, Trash2, CheckCircle, Clock, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { payrollApi, salaryApi, openPayslipPdf } from '@/lib/api/payroll'
import { employeeApi } from '@/lib/api/employees'
import { Spinner } from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_CONFIG = {
  draft: { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50', label: 'Draft' },
  processing: { icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Processing…' },
  completed: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Completed' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', cfg.color, cfg.bg)}>
      <Icon size={12} className={status === 'processing' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  )
}

function AddAdjustmentForm({ employees, components, onAdd, isPending }) {
  const [employeeId, setEmployeeId] = useState('')
  const [componentId, setComponentId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!employeeId || !componentId || !amount) return
    onAdd({ employee_id: Number(employeeId), component_id: Number(componentId), amount: Number(amount), note: note || undefined })
    setAmount('')
    setNote('')
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700">Add One-Off Allowance / Deduction</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Employee <span className="text-red-500">*</span></label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="">Select employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Component <span className="text-red-500">*</span></label>
          <select value={componentId} onChange={(e) => setComponentId(e.target.value)} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="">Select component</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.type === 'earning' ? 'Earning' : 'Deduction'})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Amount <span className="text-red-500">*</span></label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
            placeholder="e.g. 5000"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. July sales incentive"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
      </div>
      {components.length === 0 && (
        <p className="mt-2 text-xs text-amber-600">
          No salary components found for this branch yet. Add one under Payroll → Settings first (e.g. "Sales Incentive" as an Earning).
        </p>
      )}
      <button type="submit" disabled={isPending}
        className="mt-3 flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <Plus size={15} />}
        Add
      </button>
    </form>
  )
}

export default function PayrollRunDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [toast, setToast] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function notify(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ['payroll-run', id],
    queryFn: () => payrollApi.getRun(id).then((r) => r.data?.data),
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 2000 : false),
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['branch-employees', run?.branch_id],
    queryFn: () => employeeApi.list({ branch_id: run.branch_id, status: 'active', per_page: 200 }).then((r) => r.data?.data ?? []),
    enabled: !!run?.branch_id,
  })

  const { data: components = [] } = useQuery({
    queryKey: ['salary-components', run?.branch_id],
    queryFn: () => salaryApi.listComponents({ branch_id: run.branch_id }).then((r) => r.data?.data ?? []),
    enabled: !!run?.branch_id,
  })

  const { data: adjustments = [] } = useQuery({
    queryKey: ['payroll-adjustments', id],
    queryFn: () => payrollApi.listAdjustments(id).then((r) => r.data?.data ?? []),
    enabled: !!run,
  })

  const { data: payslips = [] } = useQuery({
    queryKey: ['payslips', id],
    queryFn: () => payrollApi.listPayslips({ payroll_run_id: id }).then((r) => r.data?.data ?? []),
    enabled: run?.status === 'completed',
  })

  const addMutation = useMutation({
    mutationFn: (data) => payrollApi.createAdjustment(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-adjustments', id] }); notify('Adjustment added.') },
    onError: (e) => notify(e.response?.data?.message ?? 'Failed to add adjustment.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (adjId) => payrollApi.deleteAdjustment(adjId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-adjustments', id] }); notify('Adjustment removed.') },
    onError: (e) => notify(e.response?.data?.message ?? 'Failed to remove adjustment.', 'error'),
  })

  const triggerMutation = useMutation({
    mutationFn: () => payrollApi.triggerRun(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-run', id] })
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      qc.invalidateQueries({ queryKey: ['payslips', id] })
      notify('Payroll run completed.')
    },
    onError: (e) => notify(e.response?.data?.message ?? 'Failed to run payroll.', 'error'),
  })

  const deleteRunMutation = useMutation({
    mutationFn: () => payrollApi.deleteRun(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      navigate('/payroll/runs')
    },
    onError: (e) => notify(e.response?.data?.message ?? 'Failed to delete run.', 'error'),
  })

  async function handleExport() {
    try {
      const res = await payrollApi.bankExport(id)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `bank-export-${id}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      notify('Export failed.', 'error')
    }
  }

  if (runLoading || !run) {
    return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
  }

  const isDraft = run.status === 'draft'

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/payroll/runs')} className="rounded p-1.5 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{MONTHS[run.month - 1]} {run.year}</h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-sm text-slate-500">{run.branch?.name ?? 'Branch'} · {payslips.length || run.payslips_count || 0} payslip{(payslips.length || run.payslips_count) !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <button onClick={() => triggerMutation.mutate()} disabled={triggerMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 disabled:opacity-60">
              {triggerMutation.isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <Play size={14} />}
              Run Payroll
            </button>
          )}
          {run.status !== 'processing' && (
            <button onClick={() => setConfirmDelete(true)} disabled={deleteRunMutation.isPending} title="Delete this payroll run"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60">
              <Trash2 size={14} />
            </button>
          )}
          {run.status === 'completed' && (
            <button onClick={handleExport}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Download size={14} /> Bank Export
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className={cn('rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.type === 'error' ? <AlertCircle size={15} className="shrink-0 mt-0.5" /> : <CheckCircle size={15} className="shrink-0 mt-0.5" />}
          {toast.msg}
        </div>
      )}

      {/* Adjustments */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Allowances & Deductions for this Run</h2>

        {isDraft ? (
          <AddAdjustmentForm
            employees={employees}
            components={components}
            onAdd={(data) => addMutation.mutate(data)}
            isPending={addMutation.isPending}
          />
        ) : (
          <p className="text-sm text-slate-500">Adjustments can only be edited while the run is in draft.</p>
        )}

        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Amount</th>
                {isDraft && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {adjustments.length === 0 && (
                <tr>
                  <td colSpan={isDraft ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                    No adjustments added for this run yet.
                  </td>
                </tr>
              )}
              {adjustments.map((adj) => (
                <tr key={adj.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">
                    {adj.employee ? `${adj.employee.first_name} ${adj.employee.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      adj.component?.type === 'earning' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    )}>
                      {adj.component?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{adj.note ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{Number(adj.amount).toLocaleString()}</td>
                  {isDraft && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteMutation.mutate(adj.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslips */}
      {run.status === 'completed' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Payslips</h2>
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Deductions</th>
                  <th className="px-4 py-3 text-right">Net Pay</th>
                  <th className="px-4 py-3 text-right">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payslips.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No payslips generated.</td></tr>
                )}
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">
                      {p.employee ? `${p.employee.first_name} ${p.employee.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{Number(p.gross_pay).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{Number(p.total_deductions).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{Number(p.net_pay).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openPayslipPdf(p.id).catch(() => notify('Failed to load payslip.', 'error'))}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                        View <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={run.status === 'completed' ? 'Delete completed payroll run?' : 'Delete draft payroll run?'}
          message={
            run.status === 'completed'
              ? `This will permanently delete ${MONTHS[run.month - 1]} ${run.year} for ${run.branch?.name ?? 'this branch'}, including all ${payslips.length || run.payslips_count || 0} generated payslips and their PDFs. This cannot be undone.`
              : `This will permanently delete the ${MONTHS[run.month - 1]} ${run.year} draft. This cannot be undone.`
          }
          confirmLabel={deleteRunMutation.isPending ? 'Deleting…' : 'Delete'}
          danger
          isPending={deleteRunMutation.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteRunMutation.mutate()}
        />
      )}
    </div>
  )
}
