import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import PunchWidget from './PunchWidget'
import { cn } from '@/lib/utils'

const STATUS_COLOR = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-600',
  late: 'bg-amber-100 text-amber-700',
  half_day: 'bg-blue-100 text-blue-700',
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function buildCalendar(year, month, records) {
  const byDate = {}
  for (const r of records) {
    const d = r.date?.slice(0, 10) ?? new Date(r.check_in ?? r.created_at).toISOString().slice(0, 10)
    byDate[d] = r
  }
  const days = getDaysInMonth(year, month)
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, date: key, record: byDate[key] ?? null })
  }
  return cells
}

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed

  function prev() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  function next() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', user?.employee_id, year, month + 1],
    queryFn: () =>
      attendanceApi
        .list({ employee_id: user?.employee_id, month: month + 1, year })
        .then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  const cells = buildCalendar(year, month, data ?? [])
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  const stats = (data ?? []).reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>

      {/* Punch widget */}
      <div className="max-w-sm">
        <PunchWidget />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Present', key: 'present', color: 'text-green-600' },
          { label: 'Absent', key: 'absent', color: 'text-red-500' },
          { label: 'Late', key: 'late', color: 'text-amber-600' },
          { label: 'Half Day', key: 'half_day', color: 'text-blue-600' },
        ].map(({ label, key, color }) => (
          <div key={key} className="rounded-xl border bg-white p-4 shadow-sm text-center">
            <p className={cn('text-2xl font-bold', color)}>{stats[key] ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <button onClick={prev} className="rounded p-1 hover:bg-slate-100"><ChevronLeft size={18} /></button>
          <h2 className="text-sm font-semibold text-slate-900">{monthName}</h2>
          <button onClick={next} className="rounded p-1 hover:bg-slate-100"><ChevronRight size={18} /></button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
        ) : (
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                if (!cell) return <div key={`blank-${i}`} />
                const isToday = cell.date === new Date().toISOString().slice(0, 10)
                return (
                  <div
                    key={cell.date}
                    title={cell.record?.is_holiday ? `Holiday: ${cell.record.holiday_name}` : undefined}
                    className={cn(
                      'aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors',
                      isToday && 'ring-2 ring-blue-500',
                      cell.record?.is_holiday ? 'bg-orange-100' :
                      cell.record ? STATUS_COLOR[cell.record.status] ?? 'bg-slate-100' : 'hover:bg-slate-50'
                    )}
                  >
                    <span className={cn('font-medium', isToday ? 'text-blue-700' : cell.record?.is_holiday ? 'text-orange-700' : 'text-slate-700')}>{cell.day}</span>
                    {cell.record?.is_holiday && (
                      <span className="text-[8px] text-orange-600 mt-0.5">holiday</span>
                    )}
                    {cell.record && !cell.record.is_holiday && (
                      <span className="text-[9px] mt-0.5 capitalize">{cell.record.status?.replace('_', ' ')}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* List view */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Attendance Log</h2>
        <div className="space-y-2">
          {(data ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No records for this month.</p>
          )}
          {(data ?? []).slice().reverse().map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{r.date?.slice(0, 10)}</p>
                  {r.is_holiday && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                      🏖 {r.holiday_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  {' → '}
                  {r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
              </div>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                r.is_holiday ? 'bg-orange-100 text-orange-700' : STATUS_COLOR[r.status]
              )}>
                {r.is_holiday ? 'Holiday' : r.status?.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
