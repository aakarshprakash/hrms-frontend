import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wallet, Search, RefreshCw, Download, CheckCircle2 } from 'lucide-react'
import { leaveApi } from '@/lib/api/leaves'
import { saveBlob } from '@/lib/api/payroll'
import { useRole } from '@/hooks/useRole'
import { useAuthStore } from '@/store/authStore'
import { num, typeColor } from '@/lib/leave'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Input, Select, EmptyState, Pagination, Modal, Field, ErrorBanner, Avatar } from '@/components/ui/kit'
import { LedgerModal } from '@/components/leave/LedgerModal'

/** Everyone's leave balances by type, with the ledger (and adjustments) one click away. */
export default function LeaveBalancesPage() {
  const qc = useQueryClient()
  const { can } = useRole()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [year, setYear] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [ledger, setLedger] = useState(null)
  const [exporting, setExporting] = useState(false)
  const canManage = can('leaves.manage')

  const { data, isLoading } = useQuery({
    queryKey: ['leave-overview', year, search, activeBranchId, page],
    queryFn: () => leaveApi.overview({ year: year || undefined, search: search || undefined, branch_id: activeBranchId || undefined, page }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
  const types = data?.types ?? []
  const rows = data?.data ?? []
  const currentYear = data?.meta?.year ?? new Date().getFullYear()

  const recalc = useMutation({
    mutationFn: () => leaveApi.recalculate({ branch_id: activeBranchId || undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-overview'] }),
  })

  return (
    <div className="space-y-5">
      <PageHeader icon={Wallet} title="Leave balances"
        subtitle={`Leave year ${data?.meta?.year_label ?? currentYear} · what each person has available, by type. Click a balance for its history.`}
        actions={<>
          <Button variant="secondary" icon={Download} onClick={() => setExporting(true)}>Leave register</Button>
          {canManage && <Button variant="secondary" icon={RefreshCw} loading={recalc.isPending} onClick={() => recalc.mutate()}>Apply policies now</Button>}
        </>} />

      {recalc.isSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 size={16} /> {recalc.data.data.message}
        </div>
      )}
      <ErrorBanner error={recalc.error} />

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="w-64 pl-8" placeholder="Search employee…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select className="w-auto" value={year} onChange={(e) => { setYear(e.target.value); setPage(1) }}>
          <option value="">Current leave year</option>
          {[currentYear - 1, currentYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
      </div>

      <Card padded={false}>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : rows.length === 0 ? (
          <EmptyState icon={Wallet} title="No employees found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Employee</th>
                  {types.map((t) => (
                    <th key={t.key} className="px-3 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5" title={t.name}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: typeColor(t) }} />{t.code ?? t.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.employee.id} className="hover:bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={row.employee.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{row.employee.name}</p>
                          <p className="truncate text-xs text-slate-400">{row.employee.employee_code}{row.employee.branch && ` · ${row.employee.branch}`}</p>
                        </div>
                      </div>
                    </td>
                    {types.map((t) => {
                      const cell = row.balances?.[t.key]
                      if (!cell) return <td key={t.key} className="px-3 py-2.5 text-center text-slate-300">—</td>
                      return (
                        <td key={t.key} className="px-2 py-1.5 text-center">
                          <button onClick={() => setLedger({ id: cell.balance_id, title: `${row.employee.name} · ${t.name}` })}
                            className="w-full rounded-lg px-2 py-1 hover:bg-blue-50">
                            <span className={cn('block text-[15px] font-semibold tabular-nums', cell.balance < 0 ? 'text-rose-600' : 'text-slate-900')}>{num(cell.balance)}</span>
                            <span className="block text-[10.5px] text-slate-400">
                              {num(cell.used)} used{cell.pending > 0 && <span className="text-amber-600"> · {num(cell.pending)} pend.</span>}
                            </span>
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-3"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </Card>

      {ledger && <LedgerModal balanceId={ledger.id} title={ledger.title} canAdjust={canManage} onClose={() => setLedger(null)} />}
      {exporting && <RegisterModal branchId={activeBranchId} onClose={() => setExporting(false)} />}
    </div>
  )
}

function RegisterModal({ branchId, onClose }) {
  const [form, setForm] = useState(() => {
    const now = new Date()
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA'),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA'),
      status: 'approved',
    }
  })
  const download = useMutation({
    mutationFn: () => leaveApi.exportRegister({ ...form, status: form.status || undefined, branch_id: branchId || undefined })
      .then((res) => saveBlob(res.data, `leave-register-${form.from}-to-${form.to}.csv`, 'text/csv')),
    onSuccess: onClose,
  })

  return (
    <Modal size="sm" title="Download leave register" subtitle="Every leave overlapping the period, as CSV." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Download} loading={download.isPending} onClick={() => download.mutate()}>Download</Button></>}>
      <div className="space-y-3">
        <ErrorBanner error={download.error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><Input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={form.to} min={form.from} onChange={(e) => setForm({ ...form, to: e.target.value })} /></Field>
        </div>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="approved">Approved</option>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
