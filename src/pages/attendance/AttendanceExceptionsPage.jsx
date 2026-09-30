import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, LogOut, Hourglass, CalendarX2, CheckCircle2 } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { timeLabel, minutesLabel } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, CardHeader, Select, Tabs, Avatar, ErrorBanner, StatCard } from '@/components/ui/kit'
import ReportNav from '@/components/attendance/ReportNav'

const day = (d) => new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

function Section({ icon, title, subtitle, items, empty, render }) {
  return (
    <Card padded={false}>
      <CardHeader icon={icon} title={title} subtitle={subtitle}
        actions={<span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{items.length}</span>} />
      {items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 px-5 py-8 text-[13px] text-slate-500">
          <CheckCircle2 size={16} className="text-emerald-500" />{empty}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item, i) => {
            const [detail, meta] = render(item)
            return (
              <li key={item.attendance_id ?? i} className="flex items-center gap-3 px-5 py-2.5">
                <Avatar name={item.employee.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-900">{item.employee.name}</p>
                  <p className="text-xs text-slate-500">{item.employee.employee_code}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-medium text-slate-800">{detail}</p>
                  <p className="text-xs text-slate-500">{meta}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** Attendance worth a second look: missed checkouts, absence streaks and short days. */
export default function AttendanceExceptionsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [branchId, setBranchId] = useState(activeBranchId ?? '')
  const [days, setDays] = useState('14')

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? []),
  })
  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance-exceptions', branchId, days],
    queryFn: () => attendanceApi.exceptions({ branch_id: branchId || undefined, days: Number(days) }).then((r) => r.data?.data),
  })

  return (
    <div>
      <PageHeader icon={AlertTriangle} title="Attendance reports" subtitle="Summaries, the monthly register and anything that needs a second look." />
      <ReportNav />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {branches.length > 1 && (
          <Select className="w-auto min-w-44" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
        <Tabs variant="pills" value={days} onChange={setDays}
          tabs={[{ key: '7', label: 'Last 7 days' }, { key: '14', label: 'Last 14 days' }, { key: '30', label: 'Last 30 days' }]} />
      </div>

      <ErrorBanner error={error} className="mb-4" />
      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> : data && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Missed checkouts" value={data.missed_checkouts.length} icon={LogOut} tone="amber" hint="Checked in, never out" />
            <StatCard label="Absence streaks" value={data.consecutive_absences.length} icon={CalendarX2} tone="red" hint="3+ absent days in a row" />
            <StatCard label="Short days" value={data.short_days.length} icon={Hourglass} tone="blue" hint="Present with under 4 hours" />
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-3">
            <Section icon={LogOut} title="Missed checkouts" subtitle="Checked in but never checked out"
              items={data.missed_checkouts} empty="No missed checkouts"
              render={(m) => [day(m.date), `In at ${timeLabel(m.check_in)}`]} />
            <Section icon={CalendarX2} title="Absence streaks" subtitle="3 or more unbroken absent days"
              items={data.consecutive_absences} empty="No absence streaks"
              render={(c) => [<span className="text-rose-600">{c.days} days</span>, `${day(c.start_date)} – ${day(c.end_date)}`]} />
            <Section icon={Hourglass} title="Short days" subtitle='Marked present with under 4 hours worked'
              items={data.short_days} empty="No short days"
              render={(s) => [day(s.date), `${minutesLabel(s.worked_minutes)} worked`]} />
          </div>
        </>
      )}
    </div>
  )
}
