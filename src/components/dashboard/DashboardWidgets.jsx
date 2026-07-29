import { Cake, Award, PartyPopper, CalendarDays, Umbrella } from 'lucide-react'
import { cn } from '@/lib/utils'

function initials(name) {
  return (name ?? '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function daysAwayLabel(days) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

export function CelebrationsWidget({ birthdays = [], anniversaries = [] }) {
  const items = [
    ...birthdays.map((b) => ({ ...b, kind: 'birthday' })),
    ...anniversaries.map((a) => ({ ...a, kind: 'anniversary' })),
  ].sort((a, b) => a.days_away - b.days_away).slice(0, 6)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50 text-pink-500">
          <PartyPopper size={16} />
        </div>
        <h2 className="text-[14px] font-bold tracking-tight text-slate-900">Celebrations</h2>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-slate-400">No birthdays or anniversaries in the next 60 days.</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={`${item.kind}-${item.employee_id}`}
              className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-slate-50">
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
                item.kind === 'birthday' ? 'bg-gradient-to-br from-pink-400 to-rose-500' : 'bg-gradient-to-br from-purple-400 to-indigo-500'
              )}>
                {initials(item.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800">{item.name}</p>
                <p className="flex items-center gap-1 text-[11px] text-slate-400">
                  {item.kind === 'birthday' ? <Cake size={11} className="text-pink-400" /> : <Award size={11} className="text-purple-400" />}
                  {item.kind === 'birthday' ? 'Birthday' : `${item.years}${item.years === 1 ? 'st' : item.years === 2 ? 'nd' : item.years === 3 ? 'rd' : 'th'} anniversary`}
                </p>
              </div>
              <span className={cn(
                'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold',
                item.days_away === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              )}>
                {daysAwayLabel(item.days_away)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function UpcomingHolidaysWidget({ holidays = [] }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
          <CalendarDays size={16} />
        </div>
        <h2 className="text-[14px] font-bold tracking-tight text-slate-900">Upcoming Holidays</h2>
      </div>

      {holidays.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-slate-400">No holidays scheduled in the next 60 days.</p>
      ) : (
        <div className="space-y-1">
          {holidays.slice(0, 6).map((h) => (
            <div key={h.id} className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-slate-50">
              <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-orange-50 text-orange-600 leading-none">
                <span className="text-[13px] font-bold">{new Date(h.date + 'T00:00:00').getDate()}</span>
                <span className="text-[8px] font-semibold uppercase">{new Date(h.date + 'T00:00:00').toLocaleString('default', { month: 'short' })}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800">{h.name}</p>
                <p className="text-[11px] text-slate-400">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}</p>
              </div>
              <span className={cn(
                'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold',
                h.days_away === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              )}>
                {daysAwayLabel(h.days_away)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function OnLeaveTodayWidget({ employees = [] }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-3.5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
          <Umbrella size={16} />
        </div>
        <h2 className="text-[14px] font-bold tracking-tight text-slate-900">On Leave Today</h2>
      </div>

      {employees.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-slate-400">Everyone's in today. 🎉</p>
      ) : (
        <div className="space-y-1">
          {employees.slice(0, 6).map((e) => (
            <div key={e.employee_id} className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-slate-50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                {initials(e.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800">{e.name}</p>
                <p className="text-[11px] text-slate-400">Back on {new Date(e.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
