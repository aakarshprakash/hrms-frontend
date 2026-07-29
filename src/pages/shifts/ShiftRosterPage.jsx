import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { shiftApi } from '@/lib/api/shifts'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SHIFT_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
]

function getWeekDates(anchor) {
  const start = new Date(anchor)
  start.setDate(start.getDate() - start.getDay()) // go to Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function fmt(date) {
  return date.toISOString().slice(0, 10)
}

export default function ShiftRosterPage() {
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const [anchor, setAnchor] = useState(new Date())
  const [view, setView] = useState('week') // 'week' | 'month'
  const [deptFilter, setDeptFilter] = useState('')

  const weekDates = getWeekDates(anchor)
  const startDate = fmt(weekDates[0])
  const endDate = fmt(weekDates[6])

  const { data: roster = [], isLoading } = useQuery({
    queryKey: ['roster', startDate, endDate, deptFilter],
    queryFn: () =>
      shiftApi.rosters({
        start_date: startDate,
        end_date: endDate,
        ...(deptFilter ? { department_id: deptFilter } : {}),
        ...(activeBranch ? { branch_id: activeBranch.id } : {}),
      }).then((r) => r.data?.data ?? []),
    staleTime: 60_000,
  })

  // Group roster entries: employee -> { date -> entry }
  const byEmployee = {}
  for (const entry of roster) {
    const key = entry.employee_id
    if (!byEmployee[key]) byEmployee[key] = { employee: entry.employee, dates: {} }
    byEmployee[key].dates[entry.date] = entry
  }
  const employees = Object.values(byEmployee)

  // Build a color map for shifts
  const shiftColorMap = {}
  let colorIdx = 0
  for (const entry of roster) {
    if (entry.shift_id && !shiftColorMap[entry.shift_id]) {
      shiftColorMap[entry.shift_id] = SHIFT_COLORS[colorIdx % SHIFT_COLORS.length]
      colorIdx++
    }
  }

  function prevWeek() {
    const d = new Date(anchor)
    d.setDate(d.getDate() - 7)
    setAnchor(d)
  }
  function nextWeek() {
    const d = new Date(anchor)
    d.setDate(d.getDate() + 7)
    setAnchor(d)
  }
  function goToday() { setAnchor(new Date()) }

  const weekLabel = `${weekDates[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Shift Roster</h1>
        <button onClick={goToday}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Today
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border bg-white px-1 py-1">
          <button onClick={prevWeek} className="rounded p-1 hover:bg-slate-100"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium text-slate-700 px-2">{weekLabel}</span>
          <button onClick={nextWeek} className="rounded p-1 hover:bg-slate-100"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Roster grid */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-700 w-40">Employee</th>
                {weekDates.map((d) => {
                  const isToday = fmt(d) === fmt(new Date())
                  return (
                    <th key={fmt(d)} className={cn('px-3 py-3 text-center font-medium text-slate-600 min-w-[80px]',
                      isToday && 'bg-blue-50')}>
                      <div className={cn('text-xs', isToday && 'text-blue-600 font-semibold')}>{DAYS[d.getDay()]}</div>
                      <div className={cn('text-sm font-semibold mt-0.5', isToday ? 'text-blue-700' : 'text-slate-800')}>{d.getDate()}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-12 text-sm">No roster data for this week.</td>
                </tr>
              )}
              {employees.map(({ employee, dates }) => (
                <tr key={employee?.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <p className="truncate max-w-[140px]">{employee?.first_name} {employee?.last_name}</p>
                    <p className="text-xs text-slate-400 truncate">{employee?.department?.name}</p>
                  </td>
                  {weekDates.map((d) => {
                    const entry = dates[fmt(d)]
                    const colorClass = entry?.shift_id ? (shiftColorMap[entry.shift_id] ?? 'bg-slate-100 text-slate-600') : ''
                    return (
                      <td key={fmt(d)} className={cn('px-2 py-3 text-center', fmt(d) === fmt(new Date()) && 'bg-blue-50/50')}>
                        {entry?.shift ? (
                          <span className={cn('inline-block rounded-md px-2 py-1 text-xs font-medium', colorClass)}>
                            {entry.shift.name}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
