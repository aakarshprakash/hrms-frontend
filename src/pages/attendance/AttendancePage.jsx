import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, FilePen } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { useAuthStore } from '@/store/authStore'
import { minutesLabel, WEEKDAYS } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { PageHeader, Card, CardHeader, Button, Table, StatusPill, EmptyState } from '@/components/ui/kit'
import PunchWidget from './PunchWidget'
import MarkAbsentAsLeaveModal from './MarkAbsentAsLeaveModal'

const CELL = {
  present: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  late: 'bg-amber-50 text-amber-700 ring-amber-200',
  half_day: 'bg-blue-50 text-blue-700 ring-blue-200',
  absent: 'bg-rose-50 text-rose-700 ring-rose-200',
  on_leave: 'bg-violet-50 text-violet-700 ring-violet-200',
  weekly_off: 'bg-slate-50 text-slate-500 ring-slate-200',
  holiday: 'bg-teal-50 text-teal-700 ring-teal-200',
}
const LABEL = { present: 'Present', late: 'Late', half_day: 'Half day', absent: 'Absent', on_leave: 'Leave', weekly_off: 'Off', holiday: 'Holiday' }

const time = (v) => (v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—')

function buildCalendar(year, month, records) {
  const byDate = Object.fromEntries(records.map((r) => [String(r.date).slice(0, 10), r]))
  const cells = Array.from({ length: new Date(year, month, 1).getDay() }, () => null)
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, date: key, record: byDate[key] ?? null })
  }
  return cells
}

/** My month at a glance: punch in/out, the calendar, and every day's record. */
export default function AttendancePage() {
  const user = useAuthStore((s) => s.user)
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() } })
  const [leaveFor, setLeaveFor] = useState(null)
  const { year, month } = cursor
  const todayKey = new Date().toLocaleDateString('en-CA')

  const shift = (n) => setCursor(({ year: y, month: m }) => { const d = new Date(y, m + n, 1); return { year: d.getFullYear(), month: d.getMonth() } })

  const { data = [], isLoading } = useQuery({
    queryKey: ['attendance', user?.employee_id, year, month + 1],
    queryFn: () => attendanceApi.list({ employee_id: user?.employee_id, month: month + 1, year, per_page: 62 }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  const cells = buildCalendar(year, month, data)
  const count = (...s) => data.filter((r) => s.includes(r.status)).length
  const worked = data.reduce((n, r) => n + (r.worked_minutes ?? 0), 0)
  const monthName = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div>
      <PageHeader icon={Clock} title="My attendance" subtitle="Your punches, days and hours — corrections go to your manager."
        actions={<Link to="/attendance/regularizations"><Button variant="secondary" icon={FilePen}>Request correction</Button></Link>} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <PunchWidget />
          <Card padded={false}>
            <CardHeader title={monthName} subtitle="This month so far" />
            <dl className="divide-y divide-slate-100 text-[13px]">
              {[
                ['Present', count('present', 'late'), 'bg-emerald-500'],
                ['Late arrivals', count('late'), 'bg-amber-500'],
                ['Half days', count('half_day'), 'bg-blue-500'],
                ['Absent', count('absent'), 'bg-rose-500'],
                ['On leave', count('on_leave'), 'bg-violet-500'],
              ].map(([label, value, dot]) => (
                <div key={label} className="flex items-center gap-2.5 px-5 py-2.5">
                  <span className={cn('h-2 w-2 rounded-full', dot)} />
                  <dt className="flex-1 text-slate-600">{label}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
                </div>
              ))}
              <div className="flex items-center gap-2.5 px-5 py-2.5">
                <span className="h-2 w-2" />
                <dt className="flex-1 text-slate-600">Hours worked</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{minutesLabel(worked)}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <Card padded={false} className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <p className="text-[15px] font-semibold text-slate-900">{monthName}</p>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => shift(-1)} aria-label="Previous month" />
              <Button variant="secondary" size="sm" onClick={() => setCursor({ year: new Date().getFullYear(), month: new Date().getMonth() })}>Today</Button>
              <Button variant="secondary" size="sm" icon={ChevronRight} onClick={() => shift(1)} aria-label="Next month" />
            </div>
          </div>
          {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
            <div className="p-4">
              <div className="mb-2 grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d) => <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((c, i) => {
                  if (!c) return <div key={`b${i}`} />
                  const r = c.record
                  const status = r?.is_holiday && r.status !== 'present' ? 'holiday' : r?.status
                  return (
                    <div key={c.date} title={r?.remarks ?? undefined}
                      className={cn('flex min-h-[72px] flex-col rounded-lg p-2 text-left ring-1 ring-inset',
                        status ? CELL[status] : 'bg-white ring-slate-100',
                        c.date === todayKey && 'ring-2 ring-blue-500')}>
                      <span className={cn('text-[13px] font-semibold', c.date === todayKey ? 'text-blue-700' : status ? '' : 'text-slate-700')}>{c.day}</span>
                      {r && (
                        <>
                          <span className="mt-auto text-[10.5px] font-medium">{LABEL[status] ?? status}</span>
                          {r.check_in && <span className="text-[10px] tabular-nums opacity-75">{time(r.check_in)}</span>}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
                {Object.entries(LABEL).map(([k, l]) => (
                  <span key={k} className="flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded ring-1 ring-inset', CELL[k])} />{l}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card padded={false} className="mt-6">
        <CardHeader title="Daily log" subtitle={`${data.length} day${data.length === 1 ? '' : 's'} recorded in ${monthName}`} />
        <Table rows={data}
          empty={<EmptyState title="No attendance for this month yet" />}
          columns={[
            { key: 'date', label: 'Date', render: (r) => {
              const d = new Date(String(r.date).slice(0, 10) + 'T00:00:00')
              return <span className="whitespace-nowrap font-medium text-slate-800">{d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            } },
            { key: 'in', label: 'In', render: (r) => <span className="tabular-nums">{time(r.check_in)}</span> },
            { key: 'out', label: 'Out', render: (r) => <span className="tabular-nums">{time(r.check_out)}</span> },
            { key: 'worked', label: 'Worked', render: (r) => <span className="tabular-nums">{r.worked_minutes ? minutesLabel(r.worked_minutes) : '—'}</span> },
            { key: 'status', label: 'Status', render: (r) => (
              <div className="flex items-center gap-2">
                <StatusPill status={r.status} />
                {r.late_by_minutes > 0 && <span className="text-[11px] font-medium text-amber-600">+{r.late_by_minutes}m</span>}
              </div>
            ) },
            { key: 'remarks', label: 'Remarks', render: (r) => <span className="text-xs text-slate-500">{r.remarks ?? r.holiday_name ?? ''}</span> },
            { key: 'action', label: '', align: 'right', render: (r) => r.status === 'absent' && String(r.date).slice(0, 10) < todayKey && (
              r.leave_conversion
                ? <span className="text-xs text-slate-500">Leave {r.leave_conversion.status}</span>
                : <Button size="sm" variant="soft" onClick={() => setLeaveFor(r)}>Apply leave</Button>
            ) },
          ]} />
      </Card>

      {leaveFor && <MarkAbsentAsLeaveModal record={leaveFor} onClose={() => setLeaveFor(null)} onSuccess={() => setLeaveFor(null)} />}
    </div>
  )
}
