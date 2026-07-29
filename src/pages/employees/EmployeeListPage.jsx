import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Search, LayoutGrid, List, Mail, Phone, Building2,
  ChevronLeft, ChevronRight, Users, SlidersHorizontal, X,
} from 'lucide-react'
import { employeeApi } from '@/lib/api/employees'
import { departmentApi, branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'terminated', label: 'Terminated' },
]

const STATUS_PILL = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  inactive: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  terminated: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}

const STATUS_DOT = {
  active: 'bg-emerald-500',
  inactive: 'bg-amber-500',
  terminated: 'bg-rose-500',
}

function StatusPill({ status }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset',
      STATUS_PILL[status] ?? 'bg-slate-50 text-slate-600 ring-slate-500/20'
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status] ?? 'bg-slate-400')} />
      {status}
    </span>
  )
}

function Avatar({ emp, size = 'md' }) {
  const sizes = {
    md: 'h-10 w-10 text-xs',
    lg: 'h-16 w-16 text-lg',
  }
  if (emp.avatar_url) {
    return <img src={emp.avatar_url} alt="" className={cn('rounded-full object-cover ring-2 ring-white shadow-sm shrink-0', sizes[size])} />
  }
  return (
    <div className={cn(
      'flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white ring-2 ring-white shadow-sm shrink-0',
      sizes[size]
    )}>
      {emp.first_name?.[0]}{emp.last_name?.[0]}
    </div>
  )
}

export default function EmployeeListPage() {
  const navigate = useNavigate()
  const { canManageEmployees } = useRole()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)

  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState(activeBranchId ?? '')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [page, setPage] = useState(1)
  const [view, setView] = useState('table') // 'grid' | 'table'
  const [showFilters, setShowFilters] = useState(false)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data),
  })

  const { data: deptsData } = useQuery({
    queryKey: ['departments', filterBranch],
    queryFn: () => departmentApi.list({ branch_id: filterBranch || undefined }).then((r) => r.data?.data ?? r.data ?? []),
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employees', page, filterBranch, filterDept, filterStatus, search],
    queryFn: () =>
      employeeApi.list({
        page,
        branch_id: filterBranch || undefined,
        department_id: filterDept || undefined,
        status: filterStatus || undefined,
        search: search || undefined,
      }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const employees = data?.data ?? []
  const meta = data?.meta ?? {}
  const activeFilterCount = (filterBranch ? 1 : 0) + (filterDept ? 1 : 0)

  return (
    <div className="mx-auto max-w-7xl">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Employees</h1>
            <p className="text-[13px] text-slate-500">
              {meta.total != null ? `${meta.total} ${filterStatus || 'total'} employee${meta.total === 1 ? '' : 's'}` : 'Your people, in one place'}
            </p>
          </div>
        </div>
        {canManageEmployees && (
          <Link
            to="/employees/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-blue-700/25 active:scale-[0.98]"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Employee
          </Link>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setFilterStatus(tab.key); setPage(1) }}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all',
                  filterStatus === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, code or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-xl border-0 bg-slate-100/80 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/60"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all',
              showFilters || activeFilterCount > 0
                ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View toggle */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button onClick={() => setView('grid')} title="Card view"
              className={cn('rounded-lg p-2 transition-all', view === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setView('table')} title="List view"
              className={cn('rounded-lg p-2 transition-all', view === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
              <List size={15} />
            </button>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <select
              value={filterBranch}
              onChange={(e) => { setFilterBranch(e.target.value); setFilterDept(''); setPage(1) }}
              className="rounded-xl border-0 bg-slate-100/80 px-3.5 py-2 text-[13px] font-medium text-slate-700 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/60"
            >
              <option value="">All Branches</option>
              {(branchesData?.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              value={filterDept}
              onChange={(e) => { setFilterDept(e.target.value); setPage(1) }}
              className="rounded-xl border-0 bg-slate-100/80 px-3.5 py-2 text-[13px] font-medium text-slate-700 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/60"
            >
              <option value="">All Departments</option>
              {(Array.isArray(deptsData) ? deptsData : []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilterBranch(''); setFilterDept(''); setPage(1) }}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      )}

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          Failed to load employees.
        </div>
      )}

      {!isLoading && !isError && employees.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-16 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
            <Users size={26} />
          </div>
          <p className="text-sm font-semibold text-slate-700">No employees found</p>
          <p className="mt-1 max-w-xs text-[13px] text-slate-400">
            Try a different search or filter{canManageEmployees && ', or add your first employee to get started'}.
          </p>
          {canManageEmployees && (
            <Link to="/employees/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700">
              <Plus size={14} /> Add Employee
            </Link>
          )}
        </div>
      )}

      {/* ── Card grid view ─────────────────────────────── */}
      {!isLoading && !isError && employees.length > 0 && view === 'grid' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((emp) => (
            <button
              key={emp.id}
              onClick={() => navigate(`/employees/${emp.id}`)}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-600/10"
            >
              {/* Top accent band */}
              <div className="h-14 bg-gradient-to-r from-slate-100 via-blue-50 to-indigo-100 transition-colors group-hover:from-blue-50 group-hover:to-indigo-100" />

              <div className="px-5 pb-5">
                <div className="-mt-8 mb-3 flex items-end justify-between">
                  <Avatar emp={emp} size="lg" />
                  <StatusPill status={emp.status} />
                </div>

                <p className="truncate text-[15px] font-bold text-slate-900 group-hover:text-blue-700">
                  {emp.first_name} {emp.last_name}
                </p>
                <p className="mt-0.5 truncate text-[13px] font-medium text-slate-500">
                  {emp.designation?.title ?? 'No designation'}
                </p>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3.5">
                  <div className="flex items-center gap-2 text-[12px] text-slate-500">
                    <Building2 size={13} className="shrink-0 text-slate-400" />
                    <span className="truncate">{emp.department?.name ?? '—'} · {emp.branch?.name ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-slate-500">
                    <Mail size={13} className="shrink-0 text-slate-400" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[12px] text-slate-500">
                      <Phone size={13} className="shrink-0 text-slate-400" />
                      <span>{emp.phone ?? 'Not added'}</span>
                    </div>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                      {emp.employee_code}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Table view ─────────────────────────────────── */}
      {!isLoading && !isError && employees.length > 0 && view === 'table' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Designation</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Branch</th>
                  <th className="px-5 py-3.5">Contact</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => navigate(`/employees/${emp.id}`)}
                    className="cursor-pointer transition-colors hover:bg-blue-50/40"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar emp={emp} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{emp.first_name} {emp.last_name}</p>
                          <p className="font-mono text-[11px] text-slate-400">{emp.employee_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{emp.designation?.title ?? '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600">{emp.department?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600">{emp.branch?.name ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] text-slate-600">{emp.email}</p>
                      <p className="text-[12px] text-slate-400">{emp.phone ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3.5"><StatusPill status={emp.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !isError && meta.last_page > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-[13px] text-slate-500">
            Page <span className="font-semibold text-slate-700">{meta.current_page}</span> of {meta.last_page}
            <span className="hidden sm:inline"> · {meta.total} employees</span>
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              disabled={page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
