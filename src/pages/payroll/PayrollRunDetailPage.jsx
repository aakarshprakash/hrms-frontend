import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Play, Download, Plus, Trash2, CheckCircle, Clock, AlertCircle, RefreshCw, ExternalLink,
  Eye, AlertTriangle, TrendingUp, TrendingDown, Pencil, Check, X, Search, ChevronDown, ChevronUp,
} from 'lucide-react'
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

function EmployeePicker({ employees, selectedIds, onToggle }) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const filtered = q
    ? employees.filter((e) => `${e.first_name} ${e.last_name} ${e.employee_code}`.toLowerCase().includes(q))
    : employees

  return (
    <div className="rounded-md border bg-white">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search size={13} className="text-slate-400 shrink-0" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees…"
          className="w-full text-sm text-slate-700 outline-none" />
      </div>
      <div className="max-h-40 overflow-y-auto divide-y">
        {filtered.length === 0 && <p className="px-3 py-3 text-xs text-slate-400">No employees match.</p>}
        {filtered.map((e) => (
          <label key={e.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => onToggle(e.id)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
            <span className="text-slate-800">{e.first_name} {e.last_name}</span>
            <span className="text-xs text-slate-400">({e.employee_code})</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function AdjustmentForm({ employees, components, editing, onCreate, onUpdate, onCancelEdit, isPending }) {
  const isEdit = !!editing
  const [type, setType] = useState('earning')
  const [componentId, setComponentId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [applyToAll, setApplyToAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    if (editing) {
      setType(editing.component?.type ?? 'earning')
      setComponentId(String(editing.component_id ?? ''))
      setAmount(String(editing.amount ?? ''))
      setNote(editing.note ?? '')
    } else {
      setType('earning')
      setComponentId('')
      setAmount('')
      setNote('')
      setApplyToAll(false)
      setSelectedIds([])
    }
  }, [editing])

  const filteredComponents = components.filter((c) => c.type === type)

  function toggleEmployee(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!componentId || !amount) return
    if (isEdit) {
      onUpdate(editing.id, { component_id: Number(componentId), amount: Number(amount), note: note || undefined })
      return
    }
    if (!applyToAll && selectedIds.length === 0) return
    onCreate({
      component_id: Number(componentId),
      amount: Number(amount),
      note: note || undefined,
      apply_to_all: applyToAll,
      employee_ids: applyToAll ? undefined : selectedIds,
    })
    setAmount('')
    setNote('')
    setSelectedIds([])
    setApplyToAll(false)
  }

  const accent = type === 'earning'
    ? { border: 'border-green-200', bg: 'bg-green-50/50', text: 'text-green-700', btn: 'bg-green-600 hover:bg-green-700' }
    : { border: 'border-red-200', bg: 'bg-red-50/50', text: 'text-red-700', btn: 'bg-red-600 hover:bg-red-700' }

  const submitDisabled = isPending || !componentId || !amount || (!isEdit && !applyToAll && selectedIds.length === 0)

  return (
    <form onSubmit={handleSubmit} className={cn('rounded-xl border p-4', accent.border, accent.bg)}>
      <div className="mb-3 flex items-center justify-between">
        <p className={cn('text-xs font-semibold uppercase tracking-wide', accent.text)}>
          {isEdit ? `Editing — ${editing.employee?.first_name ?? ''} ${editing.employee?.last_name ?? ''}` : 'Add Allowance / Deduction'}
        </p>
        {isEdit && (
          <button type="button" onClick={onCancelEdit} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <X size={12} /> Cancel
          </button>
        )}
      </div>

      {!isEdit && (
        <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button type="button" onClick={() => { setType('earning'); setComponentId('') }}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              type === 'earning' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-50')}>
            <TrendingUp size={13} /> Incentive / Allowance
          </button>
          <button type="button" onClick={() => { setType('deduction'); setComponentId('') }}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              type === 'deduction' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-50')}>
            <TrendingDown size={13} /> Deduction
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Component <span className="text-red-500">*</span></label>
          <select value={componentId} onChange={(e) => setComponentId(e.target.value)} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="">Select {type === 'earning' ? 'an earning' : 'a deduction'}</option>
            {filteredComponents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Amount <span className="text-red-500">*</span></label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
            placeholder="e.g. 5000"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. July sales incentive"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
      </div>

      {filteredComponents.length === 0 && (
        <p className="mt-2 text-xs text-amber-600">
          No {type} components found for this branch yet. Add one under Payroll → Settings first.
        </p>
      )}

      {!isEdit && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Apply to <span className="text-red-500">*</span></label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
              All active employees in this branch
            </label>
          </div>
          {!applyToAll && (
            <>
              <EmployeePicker employees={employees} selectedIds={selectedIds} onToggle={toggleEmployee} />
              {selectedIds.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">{selectedIds.length} employee{selectedIds.length !== 1 ? 's' : ''} selected</p>
              )}
            </>
          )}
        </div>
      )}

      <button type="submit" disabled={submitDisabled}
        className={cn('mt-3 flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60', accent.btn)}>
        {isPending
          ? <Spinner className="h-4 w-4 border-white border-t-transparent" />
          : isEdit ? <Check size={15} /> : <Plus size={15} />}
        {isEdit ? 'Save Changes' : `Add ${type === 'earning' ? 'Incentive' : 'Deduction'}`}
      </button>
    </form>
  )
}

function SalaryBreakdownModal({ row, onClose }) {
  const b = row.breakdown_json ?? {}
  const earnings = b.earnings ?? []
  const otPay = Number(b.ot_pay ?? 0)
  const deductions = b.deductions ?? []
  const statutory = b.statutory_deductions ?? []
  const lop = b.lop

  const Line = ({ label, amount, positive, muted }) => (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className={muted ? 'text-slate-500' : 'text-slate-700'}>{label}</span>
      <span className={cn('font-medium', positive ? 'text-green-700' : 'text-red-600')}>
        {positive ? '+' : '−'}{Number(amount).toLocaleString()}
      </span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{row.employee.name}</h2>
            <p className="text-xs text-slate-400">{row.employee.employee_code}{row.employee.department ? ` · ${row.employee.department}` : ''}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700">Earnings</p>
            <div className="divide-y">
              {earnings.map((e, i) => <Line key={i} label={e.name} amount={e.amount} positive />)}
              {otPay > 0 && <Line label="Overtime Pay" amount={otPay} positive />}
            </div>
            <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-semibold text-slate-900">
              <span>Gross Pay</span>
              <span>{Number(row.gross_pay).toLocaleString()}</span>
            </div>
          </div>

          {(deductions.length > 0 || statutory.length > 0 || lop?.amount > 0) && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Deductions</p>
              <div className="divide-y">
                {statutory.map((d, i) => <Line key={`s${i}`} label={d.rule_type} amount={d.amount} />)}
                {deductions.map((d, i) => <Line key={`d${i}`} label={d.name} amount={d.amount} />)}
                {lop?.amount > 0 && (
                  <Line label={`Loss of Pay (${lop.days} day${lop.days === 1 ? '' : 's'})`} amount={lop.amount} />
                )}
              </div>
              <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-semibold text-slate-900">
                <span>Total Deductions</span>
                <span>{Number(row.total_deductions).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
            <span className="text-sm font-semibold">Net Pay</span>
            <span className="text-lg font-bold">{Number(row.net_pay).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PayrollRunDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [toast, setToast] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingAdjustment, setEditingAdjustment] = useState(null)
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(true)
  const [showPreviewTable, setShowPreviewTable] = useState(true)
  const [previewDetailRow, setPreviewDetailRow] = useState(null)

  // Editing an adjustment should always bring the form into view, even if
  // it was previously collapsed.
  useEffect(() => {
    if (editingAdjustment) setShowAdjustmentForm(true)
  }, [editingAdjustment])

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

  const { data: preview, isLoading: previewLoading, isFetching: previewFetching, refetch: refetchPreview } = useQuery({
    queryKey: ['payroll-preview', id],
    queryFn: () => payrollApi.previewRun(id).then((r) => r.data?.data),
    enabled: run?.status === 'draft',
  })

  const addMutation = useMutation({
    mutationFn: (data) => payrollApi.bulkCreateAdjustment(id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payroll-adjustments', id] })
      qc.invalidateQueries({ queryKey: ['payroll-preview', id] })
      notify(res.data?.message ?? 'Adjustment added.')
    },
    onError: (e) => notify(e.response?.data?.message ?? 'Failed to add adjustment.', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ adjId, data }) => payrollApi.updateAdjustment(adjId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-adjustments', id] })
      qc.invalidateQueries({ queryKey: ['payroll-preview', id] })
      setEditingAdjustment(null)
      notify('Adjustment updated.')
    },
    onError: (e) => notify(e.response?.data?.message ?? 'Failed to update adjustment.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (adjId) => payrollApi.deleteAdjustment(adjId),
    onSuccess: (_res, adjId) => {
      qc.invalidateQueries({ queryKey: ['payroll-adjustments', id] })
      qc.invalidateQueries({ queryKey: ['payroll-preview', id] })
      setEditingAdjustment((prev) => (prev?.id === adjId ? null : prev))
      notify('Adjustment removed.')
    },
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Salary Adjustment</h2>
          {isDraft && (
            <button onClick={() => setShowAdjustmentForm((s) => !s)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
              {showAdjustmentForm ? <><ChevronUp size={14} /> Hide</> : <><ChevronDown size={14} /> Adjust Salary</>}
            </button>
          )}
        </div>

        {isDraft ? (
          showAdjustmentForm && (
            <AdjustmentForm
              employees={employees}
              components={components}
              editing={editingAdjustment}
              onCreate={(data) => addMutation.mutate(data)}
              onUpdate={(adjId, data) => updateMutation.mutate({ adjId, data })}
              onCancelEdit={() => setEditingAdjustment(null)}
              isPending={addMutation.isPending || updateMutation.isPending}
            />
          )
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
              {adjustments.map((adj) => {
                const isEarning = adj.component?.type === 'earning'
                return (
                  <tr key={adj.id} className={cn('hover:bg-slate-50', editingAdjustment?.id === adj.id && 'bg-blue-50/60')}>
                    <td className="px-4 py-3 text-slate-800">
                      {adj.employee ? `${adj.employee.first_name} ${adj.employee.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        isEarning ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      )}>
                        {isEarning ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {adj.component?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{adj.note ?? '—'}</td>
                    <td className={cn('px-4 py-3 text-right font-medium', isEarning ? 'text-green-700' : 'text-red-600')}>
                      {isEarning ? '+' : '−'}{Number(adj.amount).toLocaleString()}
                    </td>
                    {isDraft && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setEditingAdjustment(adj)} title="Edit" className="mr-3 text-slate-400 hover:text-blue-600">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteMutation.mutate(adj.id)} title="Delete" className="text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary preview — read-only, recomputed live, nothing persisted until Run Payroll */}
      {isDraft && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Eye size={16} className="text-blue-600" /> Salary Preview
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                What "Run Payroll" will generate for each employee, based on current attendance and salary setup — review and make any changes before finalizing.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => refetchPreview()} disabled={previewFetching}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                <RefreshCw size={12} className={previewFetching ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => setShowPreviewTable((s) => !s)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {showPreviewTable ? <><ChevronUp size={14} /> Hide</> : <><ChevronDown size={14} /> Show</>}
              </button>
            </div>
          </div>

          {showPreviewTable && (previewLoading ? (
            <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">Deductions</th>
                    <th className="px-4 py-3 text-right">Net Pay</th>
                    <th className="px-4 py-3 text-right">Split-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(preview?.rows ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No active employees found for this branch.</td></tr>
                  )}
                  {(preview?.rows ?? []).map((row) => {
                    const lop = row.breakdown_json?.lop
                    const noStructure = Number(row.gross_pay) === 0
                    return (
                      <tr key={row.employee.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="text-slate-800">{row.employee.name}</p>
                          <p className="text-xs text-slate-400">{row.employee.employee_code}</p>
                          {noStructure && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-600">
                              <AlertTriangle size={11} /> No salary structure set up
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.employee.department ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{Number(row.gross_pay).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {Number(row.total_deductions).toLocaleString()}
                          {lop?.amount > 0 && (
                            <p className="text-xs font-normal text-red-500">
                              incl. {lop.days} day{lop.days === 1 ? '' : 's'} LOP ({Number(lop.amount).toLocaleString()})
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{Number(row.net_pay).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setPreviewDetailRow(row)} title="View salary split-up"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {preview?.totals && preview.rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-slate-50 font-semibold text-slate-800">
                      <td className="px-4 py-3" colSpan={2}>{preview.totals.employee_count} employee{preview.totals.employee_count !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 text-right">{preview.totals.total_gross.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{preview.totals.total_deductions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{preview.totals.total_net.toLocaleString()}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ))}
        </div>
      )}

      {previewDetailRow && (
        <SalaryBreakdownModal row={previewDetailRow} onClose={() => setPreviewDetailRow(null)} />
      )}

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
