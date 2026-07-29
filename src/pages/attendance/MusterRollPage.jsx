import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Grid3x3, BarChart3, AlertTriangle } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const CODE_STYLE = {
  P: 'bg-emerald-50 text-emerald-700',
  HD: 'bg-blue-50 text-blue-700',
  A: 'bg-rose-50 text-rose-600',
  H: 'bg-orange-50 text-orange-600',
  W: 'bg-slate-100 text-slate-400',
  L: 'bg-purple-50 text-purple-600',
  '-': 'bg-slate-50 text-slate-300',
  '': '',
}

export default function MusterRollPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [branchId, setBranchId] = useState(activeBranchId ?? '')

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data),
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['muster-roll', month, year, branchId],
    queryFn: () => attendanceApi.musterRoll({ month, year, branch_id: branchId }).then((r) => r.data?.data),
    enabled: !!branchId,
  })

  const field = 'rounded-xl border-0 bg-slate-100/80 px-3.5 py-2 text-sm text-slate-700 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/60'
  const today = now.getDate()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-lg">
            <Grid3x3 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Muster Roll</h1>
            <p className="text-[13px] text-slate-500">Daily attendance register — one row per employee, one column per day.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/attendance/reports"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <BarChart3 size={13} /> Reports
          </Link>
          <Link to="/attendance/exceptions"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <AlertTriangle size={13} /> Exceptions
          </Link>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={field}>
          {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={field}>
          {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={field}>
          <option value="">Select branch…</option>
          {(branchesData?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          {[['P', 'Present'], ['HD', 'Half Day'], ['A', 'Absent'], ['H', 'Holiday'], ['W', 'Week Off'], ['L', 'Leave']].map(([code, label]) => (
            <span key={code} className="flex items-center gap-1">
              <span className={cn('flex h-5 w-6 items-center justify-center rounded text-[10px] font-bold', CODE_STYLE[code])}>{code}</span>
              {label}
            </span>
          ))}
        </div>
      </div>

      {!branchId && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-16 text-center text-sm text-slate-400">
          Select a branch to view its muster roll.
        </div>
      )}

      {branchId && isLoading && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {branchId && isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">Failed to load the muster roll.</div>
      )}

      {branchId && !isLoading && !isError && data && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 text-left backdrop-blur">Employee</th>
                  {data.days.map((d) => (
                    <th key={d} className={cn('w-9 px-0.5 py-3 text-center', isCurrentMonth && d === today && 'text-blue-600')}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.rows.length === 0 && (
                  <tr><td colSpan={data.days.length + 1} className="px-4 py-10 text-center text-slate-400">No active employees in this branch.</td></tr>
                )}
                {data.rows.map((row) => (
                  <tr key={row.employee.id} className="hover:bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 text-left">
                      <p className="whitespace-nowrap font-semibold text-slate-800">{row.employee.name}</p>
                      <p className="text-[11px] text-slate-400">{row.employee.employee_code}</p>
                    </td>
                    {data.days.map((d) => {
                      const cell = row.cells[d]
                      return (
                        <td key={d} className={cn('px-0.5 py-2 text-center', isCurrentMonth && d === today && 'bg-blue-50/40')}>
                          <span className={cn(
                            'mx-auto flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold',
                            CODE_STYLE[cell.code] ?? '', cell.late && 'ring-1 ring-amber-400'
                          )} title={cell.late ? 'Late' : undefined}>
                            {cell.code}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
