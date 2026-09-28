import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { leaveApi } from '@/lib/api/leaves'
import { MONTHS, WEEKDAYS } from '@/lib/format'
import { typeColor } from '@/lib/leave'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Card } from '@/components/ui/kit'

const iso = (d) => d.toLocaleDateString('en-CA')

/** Who is away when: approved leave (solid), pending (dashed), and holidays. */
export function LeaveCalendar({ branchId, onOpen }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const gridStart = new Date(month)
  gridStart.setDate(1 - month.getDay())
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
  const from = iso(cells[0])
  const to = iso(cells[41])

  const { data, isLoading } = useQuery({
    queryKey: ['leave-calendar', from, to, branchId ?? null],
    queryFn: () => leaveApi.calendar({ from, to, branch_id: branchId || undefined }).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  })

  const byDate = {}
  for (const leave of data?.leaves ?? []) {
    const d = new Date(leave.start_date + 'T00:00:00')
    const end = new Date(leave.end_date + 'T00:00:00')
    while (d <= end) {
      const key = iso(d)
      ;(byDate[key] ??= []).push(leave)
      d.setDate(d.getDate() + 1)
    }
  }
  const holidays = {}
  for (const h of data?.holidays ?? []) holidays[String(h.date).slice(0, 10)] ??= h.name

  const today = iso(new Date())
  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const lastRow = cells.slice(35).every((d) => d.getMonth() !== month.getMonth())

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <button onClick={() => shift(-1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
          {isLoading && <Spinner className="h-4 w-4" />}
        </div>
        <button onClick={() => shift(1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
        {WEEKDAYS.map((d) => <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {(lastRow ? cells.slice(0, 35) : cells).map((d) => {
          const key = iso(d)
          const inMonth = d.getMonth() === month.getMonth()
          const leaves = byDate[key] ?? []
          const holiday = holidays[key]
          return (
            <div key={key} className={cn('min-h-[92px] border-b border-r border-slate-100 p-1.5 text-left', !inMonth && 'bg-slate-50/60', holiday && 'bg-teal-50/60')}>
              <div className="flex items-center justify-between">
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  key === today ? 'bg-blue-600 font-bold text-white' : inMonth ? 'text-slate-700' : 'text-slate-300')}>
                  {d.getDate()}
                </span>
                {leaves.length > 0 && <span className="text-[10px] font-medium text-slate-400">{leaves.length} away</span>}
              </div>
              {holiday && <p className="mt-0.5 truncate text-[10px] font-semibold text-teal-700" title={holiday}>{holiday}</p>}
              <div className="mt-1 space-y-0.5">
                {leaves.slice(0, 3).map((l) => (
                  <button key={l.id} onClick={() => onOpen?.(l.id)} title={`${l.employee?.first_name} ${l.employee?.last_name} · ${l.leave_type?.name}${l.status === 'pending' ? ' (pending)' : ''}`}
                    className={cn('flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10.5px] font-medium',
                      l.status === 'pending' ? 'border border-dashed border-amber-400 bg-amber-50 text-amber-800' : 'text-white')}
                    style={l.status === 'pending' ? undefined : { backgroundColor: typeColor(l.leave_type) }}>
                    <span className="truncate">{l.employee?.first_name} {l.employee?.last_name?.[0]}.</span>
                    {l.half_day_session && <span className="opacity-80">½</span>}
                  </button>
                ))}
                {leaves.length > 3 && <p className="px-1 text-[10px] text-slate-400">+{leaves.length - 3} more</p>}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
