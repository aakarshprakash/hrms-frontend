import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { CalendarDays, Plus, UserPlus, Search, Inbox, CalendarRange } from 'lucide-react'
import { leaveApi, approvalApi } from '@/lib/api/leaves'
import { useRole } from '@/hooks/useRole'
import { useAuthStore } from '@/store/authStore'
import { dateLabel } from '@/lib/format'
import { dayCount, leaveRange } from '@/lib/leave'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Tabs, Table, StatusPill, EmptyState, Pagination, Input, Select, Avatar } from '@/components/ui/kit'
import { BalanceCards, LeaveTypeChip } from '@/components/leave/BalanceCards'
import { ApplyLeaveModal } from '@/components/leave/ApplyLeaveModal'
import { LeaveDetailModal } from '@/components/leave/LeaveDetailModal'
import { LedgerModal } from '@/components/leave/LedgerModal'
import { LeaveCalendar } from '@/components/leave/LeaveCalendar'

export default function LeavePage() {
  const { can, dataScope, user } = useRole()
  const location = useLocation()
  const navigate = useNavigate()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)

  const isApprover = can('leaves.approve')
  const seesTeam = isApprover || can('leaves.view') || dataScope !== 'self'
  const [tab, setTab] = useState('mine')
  // /leaves/apply (older links) opens the form straight away.
  const [applying, setApplying] = useState(() => (location.pathname.endsWith('/apply') ? 'self' : null))
  const [openLeave, setOpenLeave] = useState(null)
  const [ledger, setLedger] = useState(null)

  const { data: summary = [], isLoading: loadingSummary } = useQuery({
    queryKey: ['leave-summary', 'me'],
    queryFn: () => leaveApi.summary().then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })
  const { data: counts } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: () => approvalApi.count().then((r) => r.data.data),
    enabled: isApprover,
  })

  const closeApply = () => {
    setApplying(null)
    if (location.pathname.endsWith('/apply')) navigate('/leaves', { replace: true })
  }

  const tabs = [
    { key: 'mine', label: 'My requests' },
    ...(seesTeam ? [{ key: 'calendar', label: 'Team calendar' }] : []),
    ...(seesTeam ? [{ key: 'all', label: 'All requests' }] : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarDays} title="Leave" subtitle="Balances, requests and who’s away."
        actions={<>
          {isApprover && counts?.leave > 0 && (
            <Link to="/approvals" className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">
              <Inbox size={16} /> {counts.leave} awaiting you
            </Link>
          )}
          {(isApprover || can('leaves.manage')) && <Button variant="secondary" icon={UserPlus} onClick={() => setApplying('behalf')}>Record leave</Button>}
          {user?.employee_id && <Button icon={Plus} onClick={() => setApplying('self')}>Apply leave</Button>}
        </>} />

      {user?.employee_id && (
        <BalanceCards rows={summary.filter((r) => r.leave_type.is_active || r.balance_id)} loading={loadingSummary}
          onOpen={(row) => setLedger({ id: row.balance_id, title: `${row.leave_type.name} — history` })} />
      )}

      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}

      {tab === 'mine' && <MyRequests onOpen={setOpenLeave} onApply={() => setApplying('self')} hasProfile={!!user?.employee_id} />}
      {tab === 'calendar' && <LeaveCalendar branchId={activeBranchId} onOpen={setOpenLeave} />}
      {tab === 'all' && <AllRequests branchId={activeBranchId} onOpen={setOpenLeave} />}

      {applying && <ApplyLeaveModal onBehalf={applying === 'behalf'} onClose={closeApply} />}
      {openLeave && <LeaveDetailModal leaveId={openLeave} onClose={() => setOpenLeave(null)} />}
      {ledger && <LedgerModal balanceId={ledger.id} title={ledger.title} onClose={() => setLedger(null)} />}
    </div>
  )
}

function MyRequests({ onOpen, onApply, hasProfile }) {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['leaves', 'mine', page],
    queryFn: () => leaveApi.list({ mine: 1, page, per_page: 15 }).then((r) => r.data),
    enabled: hasProfile,
    placeholderData: (prev) => prev,
  })

  if (!hasProfile) {
    return <Card><EmptyState icon={CalendarRange} title="No employee profile" description="Your account isn’t linked to an employee record, so there’s no leave to show." /></Card>
  }

  return (
    <Card padded={false}>
      {isLoading ? <div className="flex justify-center py-14"><Spinner className="h-7 w-7" /></div> : (
        <Table rows={data?.data ?? []} onRowClick={(l) => onOpen(l.id)}
          empty={<EmptyState icon={CalendarRange} title="No leave requests yet" description="Plan some time off — your balance is above."
            action={<Button icon={Plus} onClick={onApply}>Apply leave</Button>} />}
          columns={[
            { key: 'type', label: 'Type', render: (l) => <LeaveTypeChip type={l.leave_type} /> },
            { key: 'dates', label: 'Dates', render: (l) => <span className="font-medium text-slate-800">{leaveRange(l, { year: true })}</span> },
            { key: 'days', label: 'Days', render: (l) => <span className="text-slate-600">{dayCount(l.days)}</span> },
            { key: 'status', label: 'Status', render: (l) => <StatusPill status={l.status} /> },
            { key: 'applied', label: 'Applied', render: (l) => <span className="text-xs text-slate-500">{dateLabel(l.created_at)}</span> },
          ]} />
      )}
      <div className="px-4 pb-3"><Pagination meta={data?.meta} onPage={setPage} /></div>
    </Card>
  )
}

function AllRequests({ branchId, onOpen }) {
  const [filters, setFilters] = useState({ status: 'pending', search: '' })
  const [page, setPage] = useState(1)
  const set = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1) }

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', 'all', filters, branchId, page],
    queryFn: () => leaveApi.list({
      status: filters.status || undefined, search: filters.search || undefined, branch_id: branchId || undefined, page, per_page: 20,
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="w-60 pl-8" placeholder="Search employee…" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
        </div>
        <Select className="w-auto" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      <Card padded={false}>
        {isLoading ? <div className="flex justify-center py-14"><Spinner className="h-7 w-7" /></div> : (
          <Table rows={data?.data ?? []} onRowClick={(l) => onOpen(l.id)}
            empty={<EmptyState icon={Inbox} title="No requests match" />}
            columns={[
              { key: 'employee', label: 'Employee', render: (l) => (
                <div className="flex items-center gap-2.5">
                  <Avatar name={`${l.employee?.first_name} ${l.employee?.last_name}`} size="sm" />
                  <div>
                    <p className="font-medium text-slate-800">{l.employee?.first_name} {l.employee?.last_name}</p>
                    <p className="text-xs text-slate-400">{l.employee?.employee_code}{l.employee?.designation?.title && ` · ${l.employee.designation.title}`}</p>
                  </div>
                </div>
              ) },
              { key: 'type', label: 'Type', render: (l) => <LeaveTypeChip type={l.leave_type} /> },
              { key: 'dates', label: 'Dates', render: (l) => <span className="text-slate-800">{leaveRange(l, { year: true })}</span> },
              { key: 'days', label: 'Days', render: (l) => dayCount(l.days) },
              { key: 'status', label: 'Status', render: (l) => <StatusPill status={l.status} /> },
            ]} />
        )}
        <div className="px-4 pb-3"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </Card>
    </div>
  )
}
