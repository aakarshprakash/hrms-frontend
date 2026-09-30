import { CheckCircle2, Fingerprint, IndianRupee, CalendarCheck2 } from 'lucide-react'
import logoIcon from '@/assets/brand/icon.png'
import logoFull from '@/assets/brand/logo-full.png'

const POINTS = [
  { icon: Fingerprint, text: 'Biometric, web and mobile punches across every branch' },
  { icon: CalendarCheck2, text: 'Leave, shifts and approvals that follow your policies' },
  { icon: IndianRupee, text: 'Payroll with PF, ESI, PT and TDS worked out for you' },
]

/** A tiny, static preview of the product for the brand panel. */
function Preview() {
  return (
    <div className="rounded-xl bg-white/95 p-4 text-slate-900 shadow-2xl ring-1 ring-white/20">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Today · all branches</p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Live</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[['Present', '46', 'text-emerald-600'], ['On leave', '3', 'text-violet-600'], ['Late', '4', 'text-amber-600']].map(([l, v, c]) => (
          <div key={l} className="rounded-lg bg-slate-50 px-2.5 py-2">
            <p className={`text-lg font-semibold tabular-nums ${c}`}>{v}</p>
            <p className="text-[10px] text-slate-500">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
        <span className="w-[80%] rounded-l-full bg-emerald-500" /><span className="w-[7%] bg-amber-400" /><span className="w-[5%] bg-violet-500" /><span className="w-[8%] rounded-r-full bg-slate-200" />
      </div>
      <div className="mt-3 space-y-1.5">
        {[['Leave · Anjali Nair', '2 days casual'], ['Overtime · Rahul K', '2.5 hours']].map(([t, s]) => (
          <div key={t} className="flex items-center justify-between rounded-lg border border-slate-100 px-2.5 py-1.5 text-[11px]">
            <span className="font-medium text-slate-700">{t}<span className="ml-1.5 font-normal text-slate-400">{s}</span></span>
            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Approve</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Shell for the signed-out screens: brand panel on the left (desktop),
 * the form on the right.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-navy via-[#0b2a5c] to-blue-800 p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-400/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white"><img src={logoIcon} alt="" className="h-6 w-6" /></span>
          <span className="text-lg font-semibold tracking-tight">PeopleNex <span className="font-normal text-blue-200">HRMS</span></span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[28px] font-semibold leading-tight tracking-tight">People, time and pay — one place for every branch.</h2>
          <ul className="mt-5 space-y-2.5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[14px] text-blue-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15"><Icon size={15} /></span>{text}
              </li>
            ))}
          </ul>
          <div className="mt-8 max-w-sm"><Preview /></div>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-blue-200">
          <CheckCircle2 size={14} /> Powered by Sysnac
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-slate-50/60 p-6">
        <div className="w-full max-w-[400px]">
          <img src={logoFull} alt="PeopleNex HRMS" className="mb-8 h-10 w-auto lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
          <p className="mt-10 text-center text-xs text-slate-400">© {new Date().getFullYear()} PeopleNex HRMS · Powered by Sysnac</p>
        </div>
      </main>
    </div>
  )
}
