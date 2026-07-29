import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, BarChart3, Grid3x3, LogOut, Hourglass, CalendarX2, CheckCircle2,
} from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ExceptionSection({ icon: Icon, title, subtitle, color, count, children, empty }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
            <Icon size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-slate-900">{title}</h2>
            <p className="text-[11px] text-slate-400">{subtitle}</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-600">{count}</span>
      </div>
      <div className="p-2">
        {count === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 size={22} className="mb-1.5 text-emerald-400" />
            <p className="text-[12.5px] text-slate-400">{empty}</p>
          </div>
        ) : children}
      </div>
    </div>
  )
}

export default function AttendanceExceptionsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [branchId, setBranchId] = useState(activeBranchId ?? '')
  const [days, setDays] = useState(14)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data),
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance-exceptions', branchId, days],
    queryFn: () => attendanceApi.exceptions({ branch_id: branchId || undefined, days }).then((r) => r.data?.data),
  })

  const field = 'rounded-xl border-0 bg-slate-100/80 px-3.5 py-2 text-sm text-slate-700 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/60'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-lg shadow-rose-500/20">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Attendance Exceptions</h1>
            <p className="text-[13px] text-slate-500">Things worth a second look — missed checkouts, short days, and absence streaks.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/attendance/reports"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <BarChart3 size={13} /> Reports
          </Link>
          <Link to="/attendance/muster-roll"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Grid3x3 size={13} /> Muster Roll
          </Link>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={field}>
          <option value="">All Branches</option>
          {(branchesData?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={field}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">Failed to load exceptions.</div>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-5">
          <ExceptionSection
            icon={LogOut} color="bg-amber-500" title="Missed Checkouts"
            subtitle="Checked in but never checked out" count={data.missed_checkouts.length}
            empty="No missed checkouts in this window.">
            <div className="space-y-1">
              {data.missed_checkouts.map((m) => (
                <div key={m.attendance_id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-50">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{m.employee.name}</p>
                    <p className="text-[11px] text-slate-400">{m.employee.employee_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] text-slate-600">{fmtDate(m.date)}</p>
                    <p className="text-[11px] text-slate-400">Checked in {new Date(m.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </ExceptionSection>

          <ExceptionSection
            icon={CalendarX2} color="bg-rose-500" title="Consecutive Absences"
            subtitle="3 or more unbroken absent days" count={data.consecutive_absences.length}
            empty="No absence streaks in this window.">
            <div className="space-y-1">
              {data.consecutive_absences.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-50">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{c.employee.name}</p>
                    <p className="text-[11px] text-slate-400">{c.employee.employee_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] font-semibold text-rose-600">{c.days} days</p>
                    <p className="text-[11px] text-slate-400">{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </ExceptionSection>

          <ExceptionSection
            icon={Hourglass} color="bg-blue-500" title="Short Days"
            subtitle='Marked "present" despite under 4 hours worked' count={data.short_days.length}
            empty="No short days flagged in this window.">
            <div className="space-y-1">
              {data.short_days.map((s) => (
                <div key={s.attendance_id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-50">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{s.employee.name}</p>
                    <p className="text-[11px] text-slate-400">{s.employee.employee_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] text-slate-600">{fmtDate(s.date)}</p>
                    <p className="text-[11px] text-slate-400">{Math.round(s.worked_minutes / 60 * 10) / 10}h worked</p>
                  </div>
                </div>
              ))}
            </div>
          </ExceptionSection>
        </div>
      )}
    </div>
  )
}
