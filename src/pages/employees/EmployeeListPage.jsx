import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, LayoutGrid, List, Mail, Phone, Users, X, Building2 } from 'lucide-react'
import { employeeApi } from '@/lib/api/employees'
import { departmentApi, branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { PageHeader, Card, Button, Input, Select, Tabs, Table, StatusPill, EmptyState, ErrorBanner, Pagination, Avatar } from '@/components/ui/kit'

const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'terminated', label: 'Exited' },
  { key: '', label: 'All' },
]

const name = (e) => `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim()

/** The people directory: search, filter by branch and department, list or cards. */
export default function EmployeeListPage() {
  const navigate = useNavigate()
  const { canManageEmployees } = useRole()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)

  // Other screens deep-link here with ?department_id= / ?branch_id=.
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState(params.get('branch_id') ?? (params.get('department_id') ? '' : activeBranchId ?? ''))
  const [filterDept, setFilterDept] = useState(params.get('department_id') ?? '')
  const [filterStatus, setFilterStatus] = useState('active')
  const [page, setPage] = useState(1)
  const [view, setView] = useState('table')

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? []),
  })
  const { data: departments = [] } = useQuery({
    queryKey: ['departments', filterBranch],
    queryFn: () => departmentApi.list({ branch_id: filterBranch || undefined }).then((r) => r.data?.data ?? r.data ?? []),
  })
  const { data, isLoading, error } = useQuery({
    queryKey: ['employees', page, filterBranch, filterDept, filterStatus, search],
    queryFn: () => employeeApi.list({
      page, per_page: 25,
      branch_id: filterBranch || undefined,
      department_id: filterDept || undefined,
      status: filterStatus || undefined,
      search: search || undefined,
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const employees = data?.data ?? []
  const meta = data?.meta ?? {}
  const filtered = !!(filterBranch || filterDept || search)
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1) }

  return (
    <div>
      <PageHeader icon={Users} title="Employees"
        subtitle={meta.total != null ? `${meta.total} ${STATUS_TABS.find((t) => t.key === filterStatus)?.label.toLowerCase() ?? ''} employee${meta.total === 1 ? '' : 's'}` : 'Your people, in one place'}
        actions={canManageEmployees && <Link to="/employees/new"><Button icon={Plus}>Add employee</Button></Link>} />

      <Tabs className="mb-4" value={filterStatus} onChange={(k) => { setFilterStatus(k); setPage(1) }} tabs={STATUS_TABS} />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search by name, employee code or email" value={search} onChange={reset(setSearch)} />
          </div>
          {branches.length > 1 && (
            <Select className="w-auto min-w-44" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setFilterDept(''); setPage(1) }}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Select className="w-auto min-w-44" value={filterDept} onChange={reset(setFilterDept)}>
            <option value="">All departments</option>
            {(Array.isArray(departments) ? departments : []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          {filtered && (
            <Button variant="ghost" size="sm" icon={X} onClick={() => { setSearch(''); setFilterBranch(''); setFilterDept(''); setPage(1) }}>Clear</Button>
          )}
          <div className="ml-auto flex rounded-lg bg-slate-100 p-0.5">
            {[['table', List, 'List'], ['grid', LayoutGrid, 'Cards']].map(([key, Icon, label]) => (
              <button key={key} onClick={() => setView(key)} title={label}
                className={cn('rounded-md p-1.5', view === key ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600')}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        <ErrorBanner error={error} className="m-3" />

        {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
          : employees.length === 0 ? (
            <EmptyState icon={Users} title="No employees found"
              description={filtered ? 'Try a different search or filter.' : 'Add your first employee to get started.'}
              action={canManageEmployees && !filtered && <Link to="/employees/new"><Button icon={Plus}>Add employee</Button></Link>} />
          ) : view === 'table' ? (
            <Table rows={employees} onRowClick={(e) => navigate(`/employees/${e.id}`)}
              columns={[
                { key: 'name', label: 'Employee', render: (e) => (
                  <div className="flex items-center gap-3">
                    <Avatar name={name(e)} src={e.avatar_url} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{name(e)}</p>
                      <p className="text-xs text-slate-500">{e.employee_code}</p>
                    </div>
                  </div>
                ) },
                { key: 'designation', label: 'Designation', render: (e) => <span className="text-slate-700">{e.designation?.title ?? '—'}</span> },
                { key: 'department', label: 'Department', render: (e) => e.department?.name ?? '—' },
                { key: 'branch', label: 'Branch', render: (e) => <span className="whitespace-nowrap">{e.branch?.name ?? '—'}</span> },
                { key: 'contact', label: 'Contact', render: (e) => (
                  <div className="min-w-0">
                    <p className="truncate text-slate-700">{e.email}</p>
                    <p className="text-xs text-slate-500">{e.phone ?? '—'}</p>
                  </div>
                ) },
                { key: 'joined', label: 'Joined', render: (e) => <span className="whitespace-nowrap text-slate-500">{e.date_of_joining ? new Date(e.date_of_joining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span> },
                { key: 'status', label: 'Status', render: (e) => <StatusPill status={e.status} /> },
              ]} />
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {employees.map((e) => (
                <button key={e.id} onClick={() => navigate(`/employees/${e.id}`)}
                  className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-blue-300 hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <Avatar name={name(e)} src={e.avatar_url} size="lg" />
                    <StatusPill status={e.status} />
                  </div>
                  <p className="mt-3 truncate text-[15px] font-semibold text-slate-900 group-hover:text-blue-700">{name(e)}</p>
                  <p className="truncate text-[13px] text-slate-500">{e.designation?.title ?? 'No designation'}</p>
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <p className="flex items-center gap-2 truncate"><Building2 size={13} className="shrink-0 text-slate-400" />{e.department?.name ?? '—'} · {e.branch?.name ?? '—'}</p>
                    <p className="flex items-center gap-2 truncate"><Mail size={13} className="shrink-0 text-slate-400" />{e.email}</p>
                    <p className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><Phone size={13} className="shrink-0 text-slate-400" />{e.phone ?? '—'}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{e.employee_code}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        <div className="px-4 pb-3"><Pagination meta={meta} onPage={setPage} /></div>
      </Card>
    </div>
  )
}
