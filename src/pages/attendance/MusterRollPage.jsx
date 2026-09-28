import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Grid3x3, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { PageHeader, Card, Button, Input, Select, EmptyState, ErrorBanner } from '@/components/ui/kit'
import ReportNav from '@/components/attendance/ReportNav'

const CODES = {
  P: { label: 'Present', cls: 'bg-emerald-50 text-emerald-700' },
  HD: { label: 'Half day', cls: 'bg-blue-50 text-blue-700' },
  A: { label: 'Absent', cls: 'bg-rose-50 text-rose-600' },
  L: { label: 'Leave', cls: 'bg-violet-50 text-violet-700' },
  H: { label: 'Holiday', cls: 'bg-teal-50 text-teal-700' },
  W: { label: 'Week off', cls: 'bg-slate-100 text-slate-400' },
  '-': { label: 'Not marked', cls: 'bg-slate-50 text-slate-300' },
}

function totals(cells) {
  const t = { present: 0, absent: 0, leave: 0 }
  for (const c of Object.values(cells)) {
    if (c.code === 'P') t.present += 1
    else if (c.code === 'HD') t.present += 0.5
    else if (c.code === 'A') t.absent += 1
    else if (c.code === 'L') t.leave += 1
  }
  return t
}

function downloadCsv(data, label) {
  const head = ['Code', 'Employee', ...data.days, 'Present', 'Absent', 'Leave']
  const lines = data.rows.map((r) => {
    const t = totals(r.cells)
    return [r.employee.employee_code, r.employee.name, ...data.days.map((d) => r.cells[d]?.code ?? ''), t.present, t.absent, t.leave]
  })
  const csv = [head, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  Object.assign(document.createElement('a'), { href: url, download: `muster-roll-${label}.csv` }).click()
  URL.revokeObjectURL(url)
}

/** The statutory attendance register: one row per person, one column per day. */
export default function MusterRollPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [branchId, setBranchId] = useState(activeBranchId ?? '')
  const [search, setSearch] = useState('')
  const { year, month } = cursor
  const shift = (n) => setCursor(({ year: y, month: m }) => { const d = new Date(y, m - 1 + n, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 } })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? []),
  })
  const effectiveBranch = branchId || branches[0]?.id || ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['muster-roll', month, year, effectiveBranch],
    queryFn: () => attendanceApi.musterRoll({ month, year, branch_id: effectiveBranch }).then((r) => r.data?.data),
    enabled: !!effectiveBranch,
  })

  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const rows = (data?.rows ?? []).filter((r) => !search || `${r.employee.name} ${r.employee.employee_code}`.toLowerCase().includes(search.toLowerCase()))
  const weekday = (d) => new Date(year, month - 1, d).toLocaleDateString('en-IN', { weekday: 'narrow' })
  const isWeekend = (d) => [0, 6].includes(new Date(year, month - 1, d).getDay())

  return (
    <div>
      <PageHeader icon={Grid3x3} title="Attendance reports" subtitle="Summaries, the monthly register and anything that needs a second look."
        actions={data?.rows?.length > 0 && <Button variant="secondary" icon={Download} onClick={() => downloadCsv(data, `${year}-${String(month).padStart(2, '0')}`)}>Export CSV</Button>} />
      <ReportNav />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => shift(-1)} aria-label="Previous month" />
            <span className="min-w-36 text-center text-[13px] font-semibold text-slate-800">{monthName}</span>
            <Button variant="secondary" size="sm" icon={ChevronRight} onClick={() => shift(1)} aria-label="Next month" />
          </div>
          {branches.length > 1 && (
            <Select className="w-auto min-w-44" value={effectiveBranch} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Find an employee" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
            {Object.entries(CODES).map(([code, { label, cls }]) => (
              <span key={code} className="flex items-center gap-1">
                <span className={cn('flex h-5 min-w-6 items-center justify-center rounded px-1 text-[10px] font-bold', cls)}>{code}</span>{label}
              </span>
            ))}
            <span className="flex items-center gap-1"><span className="h-5 w-6 rounded ring-1 ring-inset ring-amber-400" />Late</span>
          </div>
        </div>

        <ErrorBanner error={error} className="m-3" />
        {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
          : !data ? null
          : rows.length === 0 ? <EmptyState icon={Grid3x3} title={search ? 'No one matches that search' : 'No active employees in this branch'} />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                    <th className="sticky left-0 z-10 min-w-48 bg-slate-50 px-4 py-2 text-left uppercase tracking-wider">Employee</th>
                    {data.days.map((d) => (
                      <th key={d} className={cn('w-8 px-0.5 py-2 text-center font-medium', isWeekend(d) && 'text-slate-400', isCurrentMonth && d === now.getDate() && 'text-blue-600')}>
                        <span className="block text-[10px] font-normal">{weekday(d)}</span>{d}
                      </th>
                    ))}
                    {['P', 'A', 'L'].map((h) => <th key={h} className="w-10 bg-slate-100/80 px-1 py-2 text-center uppercase">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const t = totals(row.cells)
                    return (
                      <tr key={row.employee.id} className="hover:bg-slate-50/60">
                        <td className="sticky left-0 z-10 bg-white px-4 py-1.5">
                          <p className="whitespace-nowrap font-medium text-slate-800">{row.employee.name}</p>
                          <p className="text-[11px] text-slate-400">{row.employee.employee_code}</p>
                        </td>
                        {data.days.map((d) => {
                          const cell = row.cells[d] ?? { code: '' }
                          return (
                            <td key={d} className={cn('px-0.5 py-1.5 text-center', isCurrentMonth && d === now.getDate() && 'bg-blue-50/50')}>
                              <span title={cell.late ? 'Late' : CODES[cell.code]?.label}
                                className={cn('mx-auto flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold', CODES[cell.code]?.cls, cell.late && 'ring-1 ring-inset ring-amber-400')}>
                                {cell.code}
                              </span>
                            </td>
                          )
                        })}
                        <td className="bg-slate-50/60 px-1 text-center font-semibold tabular-nums text-emerald-700">{t.present}</td>
                        <td className="bg-slate-50/60 px-1 text-center font-semibold tabular-nums text-rose-600">{t.absent}</td>
                        <td className="bg-slate-50/60 px-1 text-center font-semibold tabular-nums text-violet-700">{t.leave}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        {data && rows.length > 0 && (
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{rows.length} employee{rows.length === 1 ? '' : 's'} · half days count as ½ present</p>
        )}
      </Card>
    </div>
  )
}
