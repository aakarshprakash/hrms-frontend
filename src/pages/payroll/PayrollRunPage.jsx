import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Wallet, ChevronRight } from 'lucide-react'
import { payrollApi } from '@/lib/api/payroll'
import { branchApi } from '@/lib/api/departments'
import { useRole } from '@/hooks/useRole'
import { money, monthLabel, MONTHS } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Modal, Field, Select, Toggle, StatusPill, EmptyState, ErrorBanner } from '@/components/ui/kit'

export default function PayrollRunPage() {
  const navigate = useNavigate()
  const { can } = useRole()
  const [year, setYear] = useState(new Date().getFullYear())
  const [creating, setCreating] = useState(false)

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['payroll-runs', year],
    queryFn: () => payrollApi.listRuns({ year }).then((r) => r.data?.data ?? []),
  })

  // One group per month, one row per branch.
  const months = useMemo(() => {
    const groups = new Map()
    for (const run of runs) {
      const key = `${run.year}-${String(run.month).padStart(2, '0')}`
      if (!groups.has(key)) groups.set(key, { key, month: run.month, year: run.year, runs: [] })
      groups.get(key).runs.push(run)
    }
    return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [runs])

  const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div>
      <PageHeader icon={Wallet} title="Payroll runs"
        subtitle="Process, review, finalize and pay — one run per branch per month."
        actions={<>
          <Select className="w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          {can('payroll.manage') && <Button icon={CalendarPlus} onClick={() => setCreating(true)}>New payroll</Button>}
        </>} />

      {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : months.length === 0 ? (
        <Card><EmptyState icon={Wallet} title={`No payroll runs in ${year}`} description="Open a month to start preparing salaries."
          action={can('payroll.manage') && <Button icon={CalendarPlus} onClick={() => setCreating(true)}>New payroll</Button>} /></Card>
      ) : (
        <div className="space-y-4">
          {months.map((group) => {
            const net = group.runs.reduce((sum, r) => sum + Number(r.totals?.net ?? 0), 0)
            return (
              <Card key={group.key} padded={false}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                      <span className="text-[10px] font-bold uppercase leading-none">{MONTHS[group.month - 1].slice(0, 3)}</span>
                      <span className="text-sm font-bold leading-tight">{group.year}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{monthLabel(group.month, group.year)}</p>
                      <p className="text-xs text-slate-500">{group.runs.length} branch{group.runs.length === 1 ? '' : 'es'}{net > 0 ? ` · net pay ${money(net)}` : ''}</p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.runs.map((run) => (
                    <button key={run.id} onClick={() => navigate(`/payroll/runs/${run.id}`)}
                      className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{run.branch?.name ?? `Branch #${run.branch_id}`}</p>
                        <p className="text-xs text-slate-400">
                          {run.payslips_count} payslip{run.payslips_count === 1 ? '' : 's'}
                          {run.totals?.warnings ? ` · ${run.totals.warnings} warning(s)` : ''}
                        </p>
                      </div>
                      <span className="hidden w-32 text-right text-sm font-medium text-slate-700 sm:block">{run.totals?.net ? money(run.totals.net) : '—'}</span>
                      <StatusPill status={run.status} className="w-24 justify-center" />
                      <ChevronRight size={16} className="text-slate-300" />
                    </button>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {creating && <NewRunModal onClose={() => setCreating(false)} onCreated={(run) => navigate(Array.isArray(run) ? '/payroll/runs' : `/payroll/runs/${run.id}`)} />}
    </div>
  )
}

function NewRunModal({ onClose, onCreated }) {
  const qc = useQueryClient()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [allBranches, setAllBranches] = useState(true)
  const [branchId, setBranchId] = useState('')

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? []) })

  const create = useMutation({
    mutationFn: () => payrollApi.createRun({ month, year, ...(allBranches ? { all_branches: true } : { branch_id: branchId }) }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      onCreated(res.data?.data)
    },
  })

  return (
    <Modal size="sm" title="New payroll" subtitle="Opens the month as a draft; nothing is computed until you process it." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={create.isPending} disabled={!allBranches && !branchId} onClick={() => create.mutate()}>Create</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={create.error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Month"><Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select></Field>
          <Field label="Year"><Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}</Select></Field>
        </div>
        {branches.length > 1 && <Toggle checked={allBranches} onChange={setAllBranches} label="All my branches" description="One run per branch; months already opened are skipped." />}
        {branches.length > 1 && !allBranches && (
          <Field label="Branch" required>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select a branch…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  )
}
