import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Download, CheckCircle, Clock, AlertCircle, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import { payrollApi } from '@/lib/api/payroll'
import { useAuthStore } from '@/store/authStore'
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

function RunCard({ run, onTrigger, onExport, onManage, onDelete }) {
  const [polling, setPolling] = useState(run.status === 'processing')

  const { data: status } = useQuery({
    queryKey: ['payroll-run-status', run.id],
    queryFn: () => payrollApi.runStatus(run.id).then((r) => r.data?.data ?? r.data),
    enabled: polling,
    refetchInterval: polling ? 3000 : false,
  })

  useEffect(() => {
    if (status?.status && status.status !== 'processing') setPolling(false)
  }, [status?.status])

  const currentStatus = status?.status ?? run.status
  const payslipsCount = status?.payslips_count ?? run.payslips_count ?? 0

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <p className="text-base font-semibold text-slate-900">
            {MONTHS[run.month - 1]} {run.year}
          </p>
          <StatusBadge status={currentStatus} />
        </div>
        <p className="text-xs text-slate-500">
          {payslipsCount} payslip{payslipsCount !== 1 ? 's' : ''} generated
          {run.run_at ? ` · Run at ${new Date(run.run_at).toLocaleString()}` : ''}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onManage(run.id)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Settings2 size={14} /> {currentStatus === 'draft' ? 'Manage' : 'View'}
        </button>
        {currentStatus === 'draft' && (
          <button onClick={() => { onTrigger(run.id); setPolling(true) }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20">
            <Play size={14} /> Run Payroll
          </button>
        )}
        {currentStatus === 'completed' && (
          <button onClick={() => onExport(run.id)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download size={14} /> Bank Export
          </button>
        )}
        {currentStatus !== 'processing' && (
          <button onClick={() => onDelete(run)} title="Delete this payroll run"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function PayrollRunPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const [toast, setToast] = useState(null)
  const [runToDelete, setRunToDelete] = useState(null)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  function notify(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['payroll-runs', activeBranch?.id],
    queryFn: () => payrollApi.listRuns({
      ...(activeBranch ? { branch_id: activeBranch.id } : {}),
    }).then((r) => r.data?.data ?? []),
  })

  const createMutation = useMutation({
    mutationFn: () => payrollApi.createRun({
      branch_id: activeBranch?.id,
      month,
      year,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); notify('Payroll run created.') },
    onError: (e) => notify(e.response?.data?.message ?? 'Failed to create run.', 'error'),
  })

  const triggerMutation = useMutation({
    mutationFn: (id) => payrollApi.triggerRun(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); notify('Payroll processing started…') },
    onError: () => notify('Failed to trigger payroll.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => payrollApi.deleteRun(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      notify('Payroll run deleted.')
      setRunToDelete(null)
    },
    onError: (e) => notify(e.response?.data?.message ?? 'Failed to delete run.', 'error'),
  })

  async function handleExport(runId) {
    try {
      const res = await payrollApi.bankExport(runId)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `bank-export-${runId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      notify('Export failed.', 'error')
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Payroll Runs</h1>

      {toast && (
        <div className={cn('rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.type === 'error' ? <AlertCircle size={15} className="shrink-0 mt-0.5" /> : <CheckCircle size={15} className="shrink-0 mt-0.5" />}
          {toast.msg}
        </div>
      )}

      {/* Create new run */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Create New Payroll Run</h2>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !activeBranch}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 disabled:opacity-60">
            {createMutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            Create Draft
          </button>
          {!activeBranch && <p className="text-xs text-amber-600">Select a branch first</p>}
        </div>
      </div>

      {/* Existing runs */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">All Runs</h2>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-slate-400">
            No payroll runs yet. Create one above.
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                onTrigger={(id) => triggerMutation.mutate(id)}
                onExport={handleExport}
                onManage={(id) => navigate(`/payroll/runs/${id}`)}
                onDelete={setRunToDelete}
              />
            ))}
          </div>
        )}
      </div>

      {runToDelete && (
        <ConfirmDialog
          title={runToDelete.status === 'completed' ? 'Delete completed payroll run?' : 'Delete draft payroll run?'}
          message={
            runToDelete.status === 'completed'
              ? `This will permanently delete ${MONTHS[runToDelete.month - 1]} ${runToDelete.year} for this branch, including all ${runToDelete.payslips_count ?? ''} generated payslips and their PDFs. This cannot be undone.`
              : `This will permanently delete the ${MONTHS[runToDelete.month - 1]} ${runToDelete.year} draft. This cannot be undone.`
          }
          confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          danger
          isPending={deleteMutation.isPending}
          onCancel={() => setRunToDelete(null)}
          onConfirm={() => deleteMutation.mutate(runToDelete.id)}
        />
      )}
    </div>
  )
}
