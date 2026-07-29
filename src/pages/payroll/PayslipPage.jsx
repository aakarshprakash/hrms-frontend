import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FileText, Download, Eye, IndianRupee } from 'lucide-react'
import { payrollApi, openPayslipPdf } from '@/lib/api/payroll'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtMoney(v) {
  return Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function PayslipCard({ payslip }) {
  const run = payslip.payroll_run
  const [busy, setBusy] = useState(false)

  async function handleOpen(download) {
    setBusy(true)
    try {
      await openPayslipPdf(payslip.id, { download })
    } catch {
      alert('Failed to load payslip PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-blue-50 p-3">
          <FileText size={20} className="text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {run ? `${MONTHS[run.month - 1]} ${run.year}` : `Payslip #${payslip.id}`}
          </p>
          {payslip.employee && (
            <p className="text-xs text-slate-500">{payslip.employee.first_name} {payslip.employee.last_name}</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">
            Gross: <span className="text-slate-600 font-medium">₹{fmtMoney(payslip.gross_pay)}</span>
            {' · '}
            Net: <span className="text-emerald-600 font-semibold">₹{fmtMoney(payslip.net_pay)}</span>
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => handleOpen(false)} disabled={busy}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60">
          <Eye size={13} /> View
        </button>
        <button onClick={() => handleOpen(true)} disabled={busy}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-colors disabled:opacity-60">
          <Download size={13} /> Download
        </button>
      </div>
    </div>
  )
}

export default function PayslipPage() {
  const user = useAuthStore((s) => s.user)
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const { hasRole } = useRole()
  const isHR = hasRole('hr') || hasRole('branch_admin') || hasRole('super_admin')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [runFilter, setRunFilter] = useState('')

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['payslips', user?.employee_id, activeBranch?.id, employeeFilter, runFilter],
    queryFn: () => payrollApi.listPayslips({
      ...(!isHR ? { employee_id: user?.employee_id } : {}),
      ...(employeeFilter ? { employee_id: employeeFilter } : {}),
      ...(runFilter ? { payroll_run_id: runFilter } : {}),
    }).then((r) => r.data?.data ?? []),
  })

  const { data: runs = [] } = useQuery({
    queryKey: ['payroll-runs', activeBranch?.id],
    queryFn: () => payrollApi.listRuns({ branch_id: activeBranch?.id, status: 'completed' }).then((r) => r.data?.data ?? []),
    enabled: isHR,
  })

  // Summary stats
  const totalGross = payslips.reduce((s, p) => s + Number(p.gross_pay), 0)
  const totalNet = payslips.reduce((s, p) => s + Number(p.net_pay), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">
        {isHR ? 'Payslips' : 'My Payslips'}
      </h1>

      {/* Summary row for HR */}
      {isHR && payslips.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
            <p className="text-xs text-slate-500 mb-1">Payslips</p>
            <p className="text-2xl font-bold text-slate-900">{payslips.length}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
            <p className="text-xs text-slate-500 mb-1">Total Gross</p>
            <p className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-0.5">
              <IndianRupee size={18} />{fmtMoney(totalGross)}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm text-center">
            <p className="text-xs text-slate-500 mb-1">Total Net Pay</p>
            <p className="text-2xl font-bold text-emerald-600 flex items-center justify-center gap-0.5">
              <IndianRupee size={18} />{fmtMoney(totalNet)}
            </p>
          </div>
        </div>
      )}

      {/* Filters for HR */}
      {isHR && (
        <div className="flex gap-3 flex-wrap">
          <select value={runFilter} onChange={(e) => setRunFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="">All Runs</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>{MONTHS[r.month - 1]} {r.year}</option>
            ))}
          </select>
        </div>
      )}

      {/* Payslip list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
      ) : payslips.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <FileText size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">No payslips found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map((p) => <PayslipCard key={p.id} payslip={p} />)}
        </div>
      )}
    </div>
  )
}
