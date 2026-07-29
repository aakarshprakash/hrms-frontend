import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays, Cake, Award, Umbrella, X } from 'lucide-react'
import { calendarApi } from '@/lib/api/calendar'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const todayKey = new Date().toISOString().slice(0, 10)

function buildGrid(year, month, daysByDate) {
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, date: key, ...(daysByDate[key] ?? {}) })
  }
  return cells
}

export default function HrCalendar({ branchId }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(todayKey)

  const { data, isLoading } = useQuery({
    queryKey: ['hr-calendar', year, month, branchId],
    queryFn: () => calendarApi.events({ year, month: month + 1, branch_id: branchId || undefined }).then((r) => r.data?.data),
    placeholderData: (prev) => prev,
  })

  const daysByDate = useMemo(() => {
    const map = {}
    for (const d of data?.days ?? []) map[d.date] = d
    return map
  }, [data])

  const cells = useMemo(() => buildGrid(year, month, daysByDate), [year, month, daysByDate])
  const yearOptions = useMemo(() => {
    const years = []
    for (let y = now.getFullYear() - 5; y <= now.getFullYear() + 5; y++) years.push(y)
    if (!years.includes(year)) years.unshift(year)
    return years.sort((a, b) => a - b)
  }, [year])

  function prev() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) } else setMonth((m) => m - 1)
    setSelected(null)
  }
  function next() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) } else setMonth((m) => m + 1)
    setSelected(null)
  }
  function goToday() {
    setYear(now.getFullYear()); setMonth(now.getMonth()); setSelected(todayKey)
  }

  const selectedDay = selected ? daysByDate[selected] : null

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarDays size={16} />
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={month}
              onChange={(e) => { setMonth(Number(e.target.value)); setSelected(null) }}
              className="rounded-lg border-0 bg-transparent py-1 pl-1.5 pr-6 text-[15px] font-bold tracking-tight text-slate-900 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-blue-500/40"
            >
              {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setSelected(null) }}
              className="rounded-lg border-0 bg-transparent py-1 pl-1.5 pr-6 text-[15px] font-bold tracking-tight text-slate-900 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-blue-500/40"
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={goToday}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-blue-600 transition-colors hover:bg-blue-50">
            Today
          </button>
          <button onClick={prev} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100">
            <ChevronLeft size={16} />
          </button>
          <button onClick={next} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="p-4">
          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`b${i}`} />
              const isToday = cell.date === todayKey
              const isSelected = cell.date === selected
              const hasHoliday = (cell.holidays?.length ?? 0) > 0
              const hasBirthday = (cell.birthdays?.length ?? 0) > 0
              const hasAnniv = (cell.anniversaries?.length ?? 0) > 0
              const leaveCount = cell.on_leave?.length ?? 0
              const hasAny = hasHoliday || hasBirthday || hasAnniv || leaveCount > 0

              return (
                <button
                  key={cell.date}
                  onClick={() => setSelected(cell.date)}
                  className={cn(
                    'group relative flex aspect-square flex-col items-center justify-start rounded-xl border pt-1.5 transition-all',
                    isSelected ? 'border-blue-400 bg-blue-50/70 shadow-sm' :
                    hasHoliday ? 'border-orange-100 bg-orange-50/50 hover:border-orange-200' :
                    cell.is_weekend ? 'border-transparent bg-slate-50/70 hover:bg-slate-100' :
                    'border-transparent hover:bg-slate-50',
                  )}
                >
                  <span className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold',
                    isToday ? 'bg-blue-600 text-white' : 'text-slate-700',
                    cell.is_weekend && !isToday && 'text-slate-400'
                  )}>
                    {cell.day}
                  </span>

                  {hasAny && (
                    <div className="mt-1 flex items-center gap-0.5">
                      {hasHoliday && <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />}
                      {hasBirthday && <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />}
                      {hasAnniv && <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />}
                      {leaveCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                    </div>
                  )}

                  {hasHoliday && (
                    <span className="mt-0.5 max-w-full truncate px-1 text-[9px] font-medium leading-tight text-orange-600">
                      {cell.holidays[0].name}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <LegendItem color="bg-orange-400" label="Holiday" />
            <LegendItem color="bg-pink-400" label="Birthday" />
            <LegendItem color="bg-purple-400" label="Anniversary" />
            <LegendItem color="bg-blue-400" label="On Leave" />
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[13px] font-bold text-slate-800">
                  {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <button onClick={() => setSelected(null)} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>

              {!selectedDay.holidays?.length && !selectedDay.birthdays?.length && !selectedDay.anniversaries?.length && !selectedDay.on_leave?.length ? (
                <p className="text-[12.5px] text-slate-400">No events on this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDay.holidays?.map((h) => (
                    <DayEventRow key={`h${h.id}`} icon={CalendarDays} color="text-orange-500 bg-orange-50" text={<><span className="font-semibold">{h.name}</span> — company holiday</>} />
                  ))}
                  {selectedDay.birthdays?.map((b) => (
                    <DayEventRow key={`b${b.employee_id}`} icon={Cake} color="text-pink-500 bg-pink-50" text={<><span className="font-semibold">{b.name}</span>'s birthday 🎂</>} />
                  ))}
                  {selectedDay.anniversaries?.map((a) => (
                    <DayEventRow key={`a${a.employee_id}`} icon={Award} color="text-purple-500 bg-purple-50" text={<><span className="font-semibold">{a.name}</span> — {a.years} year{a.years === 1 ? '' : 's'} work anniversary</>} />
                  ))}
                  {selectedDay.on_leave?.length > 0 && (
                    <DayEventRow icon={Umbrella} color="text-blue-500 bg-blue-50"
                      text={<><span className="font-semibold">{selectedDay.on_leave.length}</span> on approved leave: {selectedDay.on_leave.map((l) => l.name).join(', ')}</>} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', color)} />
      {label}
    </span>
  )
}

function DayEventRow({ icon: Icon, color, text }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', color)}>
        <Icon size={12} />
      </div>
      <p className="text-[12.5px] leading-snug text-slate-600">{text}</p>
    </div>
  )
}
