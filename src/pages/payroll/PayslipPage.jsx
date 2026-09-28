import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, Eye, Receipt } from 'lucide-react'
import { payrollApi, openPayslipPdf } from '@/lib/api/payroll'
import { useRole } from '@/hooks/useRole'
import { money, monthLabel, days, MONTHS_SHORT } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import PayslipBreakdown from '@/components/payroll/PayslipBreakdown'
import { PageHeader, Card, Button, Modal, Select, Tabs, Table, EmptyState, StatusPill, Pagination } from '@/components/ui/kit'

export default function PayslipPage() {
  const { can, user } = useRole()
  const isPayroll = can('payroll.view', 'payroll.manage')
  const [tab, setTab] = useState(isPayroll ? 'all' : 'mine')
  const [selected, setSelected] = useState(null)

  return (
    <div>
      <PageHeader icon={Receipt} title={isPayroll ? 'Payslips' : 'My payslips'}
        subtitle={isPayroll ? 'Every payslip in your scope, and your own.' : 'Your monthly payslips, available once payroll is finalized.'} />

      {isPayroll && user?.employee_id && (
        <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All payslips' }, { key: 'mine', label: 'My payslips' }]} />
      )}

      {tab === 'mine' ? <MyPayslips onOpen={setSelected} /> : <AllPayslips onOpen={setSelected} />}

      {selected && (
        <Modal size="lg" title={selected.title} subtitle={selected.subtitle} onClose={() => setSelected(null)}
          footer={<Button variant="secondary" icon={Download} onClick={() => openPayslipPdf(selected.row.id, { download: true })}>Download PDF</Button>}>
          <PayslipBreakdown row={selected.row} />
        </Modal>
      )}
    </div>
  )
}

function MyPayslips({ onOpen }) {
  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['payslips', 'mine'],
    queryFn: () => payrollApi.listPayslips({ mine: 1, per_page: 36 }).then((r) => r.data?.data ?? []),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
  if (payslips.length === 0) {
    return <Card><EmptyState icon={FileText} title="No payslips yet" description="Your payslip appears here as soon as the month's payroll is finalized." /></Card>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {payslips.map((p) => {
        const run = p.payroll_run
        return (
          <Card key={p.id} className="flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <span className="text-[10px] font-bold uppercase leading-none">{MONTHS_SHORT[run.month - 1]}</span>
                  <span className="text-xs font-bold">{run.year}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{monthLabel(run.month, run.year)}</p>
                  <p className="text-xs text-slate-400">{days(p.payable_days)} payable day(s){Number(p.lop_days) > 0 ? ` · ${days(p.lop_days)} LOP` : ''}</p>
                </div>
              </div>
              <StatusPill status={run.status === 'paid' ? 'paid' : 'published'} label={run.status === 'paid' ? 'Paid' : 'Published'} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 py-2"><p className="text-[10px] uppercase text-slate-400">Gross</p><p className="text-sm font-semibold">{money(p.gross_pay)}</p></div>
              <div className="rounded-xl bg-slate-50 py-2"><p className="text-[10px] uppercase text-slate-400">Deductions</p><p className="text-sm font-semibold text-rose-600">{money(p.total_deductions)}</p></div>
              <div className="rounded-xl bg-blue-50 py-2"><p className="text-[10px] uppercase text-blue-500">Net pay</p><p className="text-sm font-bold text-blue-700">{money(p.net_pay)}</p></div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" size="sm" icon={Eye} className="flex-1"
                onClick={() => onOpen({ row: p, title: monthLabel(run.month, run.year), subtitle: 'Payslip breakdown' })}>View</Button>
              <Button size="sm" icon={Download} className="flex-1" onClick={() => openPayslipPdf(p.id, { download: true })}>PDF</Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function AllPayslips({ onOpen }) {
  const [runId, setRunId] = useState('')
  const [page, setPage] = useState(1)

  const { data: runs = [] } = useQuery({
    queryKey: ['payroll-runs', 'with-payslips'],
    queryFn: () => payrollApi.listRuns({ status: 'processed,finalized,paid' }).then((r) => r.data?.data ?? []),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['payslips', 'all', runId, page],
    queryFn: () => payrollApi.listPayslips({ payroll_run_id: runId || undefined, page, per_page: 50 }).then((r) => r.data),
    placeholderData: (p) => p,
  })

  return (
    <>
      <div className="mb-4">
        <Select className="w-auto" value={runId} onChange={(e) => { setRunId(e.target.value); setPage(1) }}>
          <option value="">All runs</option>
          {runs.map((r) => <option key={r.id} value={r.id}>{monthLabel(r.month, r.year)} — {r.branch?.name} ({r.status})</option>)}
        </Select>
      </div>
      <Card padded={false}>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
          <Table rows={data?.data ?? []} onRowClick={(p) => onOpen({ row: p, title: `${p.employee?.first_name} ${p.employee?.last_name}`, subtitle: `${p.employee?.employee_code} · ${monthLabel(p.payroll_run.month, p.payroll_run.year)}` })}
            empty={<EmptyState icon={FileText} title="No payslips" />}
            columns={[
              { key: 'employee', label: 'Employee', render: (p) => <div><p className="font-medium text-slate-800">{p.employee?.first_name} {p.employee?.last_name}</p><p className="text-xs text-slate-400">{p.employee?.employee_code}</p></div> },
              { key: 'period', label: 'Period', render: (p) => monthLabel(p.payroll_run.month, p.payroll_run.year) },
              { key: 'state', label: 'Status', render: (p) => <StatusPill status={p.published_at ? 'published' : 'draft'} label={p.published_at ? 'Published' : 'In review'} /> },
              { key: 'gross_pay', label: 'Gross', align: 'right', render: (p) => money(p.gross_pay) },
              { key: 'net_pay', label: 'Net', align: 'right', render: (p) => <b>{money(p.net_pay)}</b> },
              { key: 'pdf', label: '', align: 'right', render: (p) => (
                <Button size="sm" variant="ghost" icon={Download} onClick={(e) => { e.stopPropagation(); openPayslipPdf(p.id, { download: true }) }}>PDF</Button>
              ) },
            ]} />
        )}
      </Card>
      <Pagination meta={data?.meta} onPage={setPage} />
    </>
  )
}
