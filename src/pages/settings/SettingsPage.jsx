import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import {
  Building2, Network, Briefcase, CalendarDays, CalendarRange, Clock, Timer, Landmark, Sparkles, Fingerprint,
  Settings, ShieldCheck, KeyRound, BellRing, History, CreditCard, Wallet, ChevronRight, CheckCircle2, Circle, Building,
} from 'lucide-react'
import { branchApi, departmentApi, designationApi } from '@/lib/api/departments'
import { shiftApi, holidayApi } from '@/lib/api/shifts'
import { leaveApi } from '@/lib/api/leaves'
import { salaryApi } from '@/lib/api/payroll'
import { overtimeApi } from '@/lib/api/overtime'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { isAllowed } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { PageHeader, Card, CardHeader, Button } from '@/components/ui/kit'

const list = (r) => { const d = r.data?.data ?? r.data ?? []; return Array.isArray(d) ? d : [] }

/** How much of the setup exists: one count per configurable area. */
function useSetupCounts(ctx) {
  const bid = useAuthStore((s) => s.activeBranch?.id)
  const year = new Date().getFullYear()
  const params = bid ? { branch_id: bid } : {}
  const payroll = ctx.hasFeature('payroll')
  const sources = {
    branches: [() => branchApi.list()],
    departments: [() => departmentApi.list(params)],
    designations: [() => designationApi.list(params)],
    shifts: [() => shiftApi.list(params)],
    holidays: [() => holidayApi.list({ year, ...params })],
    leaveTypes: [() => leaveApi.listTypes(params)],
    components: [() => salaryApi.listComponents(params), payroll],
    statutory: [() => salaryApi.listStatutory(params), payroll],
    otRules: [() => overtimeApi.listRules().then((r) => ({ data: list(r).filter((x) => !bid || x.branch_id === bid) })), payroll],
  }
  const results = useQueries({
    queries: Object.entries(sources).map(([key, [fn, enabled = true]]) => ({
      queryKey: ['setup-count', key, bid], queryFn: () => fn().then((r) => list(r).length), enabled, staleTime: 60_000,
    })),
  })
  return Object.fromEntries(Object.keys(sources).map((key, i) => [key, results[i].data]))
}

/**
 * Every setting in one place, grouped the way admins think about them.
 * `count` / `required` feed the setup checklist; `perms` / `feature` hide
 * what this user or plan can't reach (same rules as the sidebar).
 */
function sections(c, year) {
  const n = (v, one, many = `${one}s`) => (v == null ? '…' : `${v} ${v === 1 ? one : many}`)
  return [
    {
      title: 'Organisation', icon: Building,
      items: [
        { to: '/settings/organisation', icon: Landmark, title: 'Organisation profile', text: 'Legal name, address and the PF / ESI / PAN / TAN registrations printed on payslips and returns.', perms: ['settings.manage'] },
        { to: '/settings/branches', icon: Building2, title: 'Branches', text: 'Locations you operate from — employees, policies and payroll are set per branch.', meta: n(c.branches, 'branch', 'branches'), count: c.branches, required: true, perms: ['settings.manage'] },
        { to: '/departments', icon: Network, title: 'Departments', text: 'Functional units inside each branch, used to group people and filter reports.', meta: n(c.departments, 'department'), count: c.departments, required: true, perms: ['departments.manage'] },
        { to: '/designations', icon: Briefcase, title: 'Designations', text: 'Job titles and seniority levels within departments.', meta: n(c.designations, 'designation'), count: c.designations, required: true, perms: ['departments.manage'] },
        { to: '/settings/quick-setup', icon: Sparkles, title: 'Industry templates', text: 'Fill a branch with departments, shifts, leave types and pay rules suited to your industry.', perms: ['settings.manage'] },
      ],
    },
    {
      title: 'Time & attendance', icon: Clock,
      items: [
        { to: '/settings/shifts', icon: Clock, title: 'Shifts & schedules', text: 'Working hours, breaks, grace periods and weekly offs.', meta: n(c.shifts, 'shift'), count: c.shifts, required: true, perms: ['shifts.manage'] },
        { to: '/shifts/holidays', icon: CalendarRange, title: 'Holiday calendar', text: 'Public holidays per branch — flagged automatically in attendance.', meta: c.holidays == null ? '…' : `${c.holidays} in ${year}`, count: c.holidays, required: true },
        { to: '/settings/biometric', icon: Fingerprint, title: 'Biometric devices', text: 'Pull punches from each branch\'s attendance devices instead of manual entry.', perms: ['settings.manage'], feature: 'biometric' },
      ],
    },
    {
      title: 'Leave', icon: CalendarDays,
      items: [
        { to: '/leaves/settings', icon: CalendarDays, title: 'Leave types & policies', text: 'Entitlements, accrual, carry-forward, encashment and sandwich rules.', meta: n(c.leaveTypes, 'leave type'), count: c.leaveTypes, required: true, perms: ['leaves.manage'] },
      ],
    },
    {
      title: 'Payroll', icon: Wallet, feature: 'payroll',
      items: [
        { to: '/payroll/settings', icon: Wallet, title: 'Pay components', text: 'Earnings and deductions that make up each salary structure.', meta: n(c.components, 'component'), count: c.components, required: true, perms: ['payroll.manage'], feature: 'payroll' },
        { to: '/payroll/settings?tab=statutory', icon: Landmark, title: 'Statutory rules', text: 'PF, ESI, professional tax, TDS and LWF for each branch.', meta: n(c.statutory, 'rule'), count: c.statutory, required: true, perms: ['payroll.manage'], feature: 'payroll' },
        { to: '/payroll/settings?tab=overtime', icon: Timer, title: 'Overtime', text: 'When overtime starts and the multiplier it\'s paid at.', meta: c.otRules == null ? '…' : c.otRules ? 'Configured' : 'Not set up', count: c.otRules, required: true, perms: ['payroll.manage', 'shifts.manage'], feature: 'payroll' },
      ],
    },
    {
      title: 'Access & administration', icon: ShieldCheck,
      items: [
        { to: '/settings/users', icon: ShieldCheck, title: 'Users & access', text: 'Who can sign in, their roles and which branches they see.', perms: ['users.manage'] },
        { to: '/settings/roles', icon: KeyRound, title: 'Roles & permissions', text: 'Built-in and custom roles, and the data each role can reach.', perms: ['roles.manage'] },
        { to: '/settings/notifications', icon: BellRing, title: 'Notifications', text: 'Email, SMS and WhatsApp alerts, and the templates they use.', perms: ['notifications.manage'] },
        { to: '/settings/audit', icon: History, title: 'Audit trail', text: 'Every change to people, pay and settings — who, what and when.', perms: ['audit.view'], feature: 'audit_log' },
        { to: '/settings/billing', icon: CreditCard, title: 'Plan & billing', text: 'Your subscription, seats, invoices and payment method.', perms: ['billing.manage'] },
      ],
    },
  ]
}

function SetupChecklist({ steps }) {
  const done = steps.filter((s) => s.count > 0).length
  if (!steps.length || done === steps.length) return null
  const pct = Math.round((done / steps.length) * 100)

  return (
    <Card padded={false} className="mb-6 overflow-hidden">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-blue-50 to-white px-5 py-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-slate-900">Finish setting up — {done} of {steps.length} done</p>
          <p className="mt-0.5 text-[13px] text-slate-500">These drive attendance, leave and payroll. Industry templates can fill most of them in one go.</p>
          <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-blue-100">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Link to="/settings/quick-setup"><Button icon={Sparkles}>Use a template</Button></Link>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
        {steps.map((s) => (
          <Link key={s.to} to={s.to}
            className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
              s.count > 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}>
            {s.count > 0 ? <CheckCircle2 size={13} /> : <Circle size={13} className="text-slate-300" />}{s.title}
          </Link>
        ))}
      </div>
    </Card>
  )
}

/** The settings hub: every configurable area, with what's still missing. */
export default function SettingsPage() {
  const company = useAuthStore((s) => s.company)
  const { can, hasFeature } = useRole()
  const ctx = { can, hasFeature }
  const counts = useSetupCounts(ctx)
  const visible = sections(counts, new Date().getFullYear())
    .filter((s) => !s.feature || hasFeature(s.feature))
    .map((s) => ({ ...s, items: s.items.filter((i) => isAllowed(i, ctx)) }))
    .filter((s) => s.items.length > 0)
  const steps = visible.flatMap((s) => s.items).filter((i) => i.required && i.count != null)

  return (
    <div>
      <PageHeader icon={Settings} title="Settings" subtitle={`Everything that shapes how ${company?.name ?? 'your organisation'} runs — structure, time, leave, pay and access.`} />

      <SetupChecklist steps={steps} />

      <div className="space-y-6">
        {visible.map((section) => (
          <Card key={section.title} padded={false}>
            <CardHeader title={section.title} icon={section.icon} />
            <div className="overflow-hidden rounded-b-xl">
            <div className="-mb-px -mr-px grid sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => {
                const Icon = item.icon
                const missing = item.required && item.count === 0
                return (
                  <Link key={item.to} to={item.to} className="group flex items-start gap-3 border-b border-r border-slate-100 p-4 transition-colors hover:bg-slate-50">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                      missing ? 'bg-amber-50 text-amber-600 ring-amber-200' : 'bg-blue-50 text-blue-600 ring-blue-100')}>
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-[13px] font-semibold text-slate-900 group-hover:text-blue-700">
                        {item.title}<ChevronRight size={14} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.text}</p>
                      {item.meta && (
                        <p className={cn('mt-1.5 text-[11px] font-medium', missing ? 'text-amber-700' : 'text-slate-400')}>
                          {missing ? 'Not set up yet' : item.meta}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
