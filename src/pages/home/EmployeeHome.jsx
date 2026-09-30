import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CalendarDays, Clock, Timer, Award, IndianRupee, Download, Eye, ArrowRight, PartyPopper, Users, Inbox, Sun, Palmtree,
} from 'lucide-react'
import { meApi } from '@/lib/api/me'
import { openPayslipPdf } from '@/lib/api/payroll'
import { money, monthLabel, WEEKDAYS } from '@/lib/format'
import { dayCount, leaveRange, num, typeColor } from '@/lib/leave'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { Card, Button, Avatar, StatusPill } from '@/components/ui/kit'
import { ApplyLeaveModal } from '@/components/leave/ApplyLeaveModal'
import PunchWidget from '@/pages/attendance/PunchWidget'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/**
 * Self-service home for employees (and managers): my day, my week, my
 * leave, my pay -- and, for managers, my team today.
 */
export default function EmployeeHome() {
  const [applying, setApplying] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['me-home'],
    queryFn: () => meApi.home().then((r) => r.data.data),
  })

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>
  if (!data) {
    return <Card className="mx-auto max-w-lg text-center text-sm text-slate-500">Your account isn’t linked to an employee profile yet. Ask HR to link it.</Card>
  }

  const { employee, week, leave, payslip, month, requests, holidays, team } = data
  const openRequests = requests.leave + requests.regularization + requests.overtime

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{greeting()}, {employee.first_name} 👋</h1>
          <p className="mt-1 text-sm text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link to={`/employees/${employee.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm hover:shadow-md">
          <Avatar name={employee.name} src={employee.avatar_url} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{employee.designation ?? employee.name}</p>
            <p className="truncate text-xs text-slate-500">
              {[employee.department, employee.branch].filter(Boolean).join(' · ')}
              {employee.manager && ` · Reports to ${employee.manager.name}`}
            </p>
          </div>
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <WeekStrip week={week} />

          <Card padded={false}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <p className="font-semibold text-slate-900">My leave</p>
              <div className="flex gap-2">
                <Link to="/leaves" className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">History</Link>
                <Button size="sm" icon={CalendarDays} onClick={() => setApplying(true)}>Apply leave</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
              {leave.balances.filter((b) => !b.unlimited)
                // Everyday leave first; special leave (maternity, paternity...) after.
                .sort((a, b) => Number(!!a.leave_type.applicable_gender) - Number(!!b.leave_type.applicable_gender))
                .slice(0, 4).map((b) => (
                <div key={b.leave_type.id} className="bg-white px-5 py-4">
                  <p className="flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: typeColor(b.leave_type) }} />{b.leave_type.name}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{num(b.available)}</p>
                  <p className="text-[11px] text-slate-400">available{b.pending > 0 ? ` · ${num(b.pending)} pending` : ''}</p>
                </div>
              ))}
            </div>
            {leave.upcoming.length > 0 && (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {leave.upcoming.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Palmtree size={16} className="text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{leaveRange(l, { year: true })}</p>
                        <p className="text-xs text-slate-500">{l.leave_type?.name} · {dayCount(l.days)}</p>
                      </div>
                    </div>
                    <StatusPill status={l.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <MonthCard month={month} />
            <QuickActions openRequests={openRequests} requests={requests} onApply={() => setApplying(true)} />
          </div>

          {team && <TeamCard team={team} />}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <PunchWidget />
          <PayslipCard payslip={payslip} />
          <HolidaysCard holidays={holidays} />
        </div>
      </div>

      {applying && <ApplyLeaveModal onClose={() => setApplying(false)} />}
    </div>
  )
}

function WeekStrip({ week }) {
  return (
    <Card padded={false}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <p className="font-semibold text-slate-900">My week</p>
        <Link to="/attendance" className="text-xs font-medium text-blue-600 hover:underline">Attendance</Link>
      </div>
      <div className="grid grid-cols-7 divide-x divide-slate-100">
        {week.map((d, i) => {
          const date = new Date(d.date + 'T00:00:00')
          const off = d.weekly_off || d.holiday || d.leave === 'full'
          return (
            <div key={d.date} className={cn('px-1.5 py-3 text-center', i === 0 && 'bg-blue-50/60', off && 'bg-slate-50/80')}>
              <p className={cn('text-[11px] font-semibold uppercase', i === 0 ? 'text-blue-600' : 'text-slate-400')}>{i === 0 ? 'Today' : WEEKDAYS[date.getDay()]}</p>
              <p className="text-lg font-bold text-slate-900">{date.getDate()}</p>
              {d.holiday ? (
                <p className="mt-1 truncate rounded bg-teal-50 px-1 py-0.5 text-[10px] font-semibold text-teal-700" title={d.holiday}>{d.holiday}</p>
              ) : d.leave ? (
                <p className="mt-1 rounded bg-purple-50 px-1 py-0.5 text-[10px] font-semibold text-purple-700">{d.leave === 'half' ? '½ leave' : 'Leave'}</p>
              ) : d.weekly_off ? (
                <p className="mt-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">Off</p>
              ) : d.shift ? (
                <p className="mt-1 truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: d.shift.color || '#2563eb' }} title={d.shift.name}>
                  {d.shift.start}–{d.shift.end}
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-slate-400">—</p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function MonthCard({ month }) {
  const items = [
    ['Present', month.present, 'text-emerald-600'],
    ['Late', month.late, 'text-amber-600'],
    ['Absent', month.absent, 'text-rose-600'],
    ['On leave', month.on_leave, 'text-purple-600'],
  ]
  return (
    <Card>
      <p className="font-semibold text-slate-900">This month</p>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {items.map(([label, value, cls]) => (
          <div key={label} className="rounded-xl bg-slate-50 py-2.5">
            <p className={cn('text-xl font-bold', cls)}>{value}</p>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      {month.half_day > 0 && <p className="mt-2 text-xs text-slate-500">{month.half_day} half day(s)</p>}
    </Card>
  )
}

function QuickActions({ openRequests, requests, onApply }) {
  const { hasFeature } = useRole()
  const actions = [
    { label: 'Apply leave', icon: CalendarDays, onClick: onApply, badge: requests.leave },
    { label: 'Fix attendance', icon: Clock, to: '/attendance/regularizations', badge: requests.regularization },
    { label: 'Claim overtime', icon: Timer, to: '/overtime', badge: requests.overtime },
    ...(hasFeature('certificates') ? [{ label: 'Request a letter', icon: Award, to: '/certificates' }] : []),
  ]
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-900">Quick actions</p>
        {openRequests > 0 && <span className="text-xs text-amber-700">{openRequests} request(s) pending</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const Icon = a.icon
          const body = (
            <>
              <Icon size={16} className="shrink-0 text-blue-600" />
              <span className="flex-1 truncate">{a.label}</span>
              {a.badge > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">{a.badge}</span>}
            </>
          )
          const cls = 'flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-[13px] font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
          return a.to
            ? <Link key={a.label} to={a.to} className={cls}>{body}</Link>
            : <button key={a.label} onClick={a.onClick} className={cls}>{body}</button>
        })}
      </div>
    </Card>
  )
}

function PayslipCard({ payslip }) {
  const [busy, setBusy] = useState(false)
  if (!payslip) {
    return (
      <Card>
        <p className="font-semibold text-slate-900">Latest payslip</p>
        <p className="mt-2 text-sm text-slate-500">Your payslips appear here once payroll is finalized.</p>
      </Card>
    )
  }
  const download = async () => {
    setBusy(true)
    try { await openPayslipPdf(payslip.id, { download: true }) } finally { setBusy(false) }
  }
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-blue-100">Latest payslip</p>
        <IndianRupee size={16} className="text-blue-200" />
      </div>
      <p className="mt-1 text-sm font-semibold">{monthLabel(payslip.month, payslip.year)}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight">{money(payslip.net_pay)}</p>
      <p className="text-xs text-blue-100">Net pay · gross {money(payslip.gross_pay)}</p>
      <div className="mt-4 flex gap-2">
        <Link to="/payroll/payslips" className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"><Eye size={14} /> View</Link>
        <button onClick={download} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60">
          <Download size={14} /> {busy ? 'Preparing…' : 'PDF'}
        </button>
      </div>
    </Card>
  )
}

function HolidaysCard({ holidays }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-900">Upcoming holidays</p>
        <Link to="/shifts/holidays" className="text-xs font-medium text-blue-600 hover:underline">All</Link>
      </div>
      {holidays.length === 0 ? <p className="mt-2 text-sm text-slate-500">No holidays coming up.</p> : (
        <ul className="mt-3 space-y-2.5">
          {holidays.map((h) => {
            const d = new Date(String(h.date).slice(0, 10) + 'T00:00:00')
            return (
              <li key={h.id} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <span className="text-[9px] font-semibold uppercase leading-none">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                  <span className="text-sm font-bold leading-none">{d.getDate()}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{h.name}</span>
                  <span className="block text-xs text-slate-500">{d.toLocaleDateString('en-IN', { weekday: 'long' })}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function TeamCard({ team }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Users size={19} /></div>
          <div>
            <p className="font-semibold text-slate-900">My team today</p>
            <p className="text-xs text-slate-500">{team.checked_in} of {team.size} checked in · {team.on_leave.length} on leave</p>
          </div>
        </div>
        {team.approvals_waiting > 0 ? (
          <Link to="/approvals" className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">
            <Inbox size={15} /> {team.approvals_waiting} waiting for you <ArrowRight size={14} />
          </Link>
        ) : <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700"><Sun size={15} /> No approvals waiting</span>}
      </div>
      {team.on_leave.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {team.on_leave.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || '#7c3aed' }} />
              {p.name} · {p.type}{p.half_day_session ? ' (½)' : ''}
            </span>
          ))}
        </div>
      )}
      {team.on_leave.length === 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500"><PartyPopper size={14} /> Nobody’s on leave today.</p>
      )}
    </Card>
  )
}
