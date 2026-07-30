import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, Users, Briefcase, CalendarDays, DollarSign,
  CalendarRange, Timer, CheckCircle2, AlertCircle, ArrowRight,
  Settings, Landmark, Clock, Sparkles, Fingerprint,
} from 'lucide-react'
import { branchApi, departmentApi, designationApi } from '@/lib/api/departments'
import { shiftApi } from '@/lib/api/shifts'
import { leaveApi } from '@/lib/api/leaves'
import { salaryApi } from '@/lib/api/payroll'
import { overtimeApi } from '@/lib/api/overtime'
import { holidayApi } from '@/lib/api/shifts'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

// ─── individual count queries ─────────────────────────────────────────────────

function useSetupCounts() {
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const bid = activeBranch?.id

  const { data: branches }    = useQuery({ queryKey: ['branches'],         queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []) })
  const { data: departments } = useQuery({ queryKey: ['departments'],      queryFn: () => departmentApi.list(bid ? { branch_id: bid } : {}).then((r) => r.data?.data ?? r.data ?? []) })
  const { data: designations }= useQuery({ queryKey: ['designations'],     queryFn: () => designationApi.list(bid ? { branch_id: bid } : {}).then((r) => r.data?.data ?? r.data ?? []) })
  const { data: leaveTypes }  = useQuery({ queryKey: ['leave-types'],      queryFn: () => leaveApi.listTypes(bid ? { branch_id: bid } : {}).then((r) => r.data?.data ?? r.data ?? []) })
  const { data: components }  = useQuery({ queryKey: ['salary-components'],queryFn: () => salaryApi.listComponents().then((r) => r.data?.data ?? r.data ?? []) })
  const { data: statutory }   = useQuery({ queryKey: ['statutory-rules'],  queryFn: () => salaryApi.listStatutory().then((r) => r.data?.data ?? r.data ?? []) })
  const { data: otRules }     = useQuery({ queryKey: ['overtime-rules'],   queryFn: () => overtimeApi.listRules().then((r) => r.data?.data ?? r.data ?? []) })
  const { data: shifts }      = useQuery({ queryKey: ['shifts', bid],      queryFn: () => shiftApi.list(bid ? { branch_id: bid } : {}).then((r) => r.data?.data ?? r.data ?? []) })
  const { data: holidayResp } = useQuery({ queryKey: ['holidays', new Date().getFullYear(), null, bid], queryFn: () => holidayApi.list({ year: new Date().getFullYear(), ...(bid ? { branch_id: bid } : {}) }).then((r) => r.data) })

  return {
    branches:    Array.isArray(branches)    ? branches.length    : 0,
    departments: Array.isArray(departments) ? departments.length : 0,
    designations:Array.isArray(designations)? designations.length: 0,
    leaveTypes:  Array.isArray(leaveTypes)  ? leaveTypes.length  : 0,
    components:  Array.isArray(components)  ? components.length  : 0,
    statutory:   Array.isArray(statutory)   ? statutory.length   : 0,
    otRules:     Array.isArray(otRules)     ? otRules.length     : 0,
    holidays:    (holidayResp?.data ?? []).length,
    shifts:      Array.isArray(shifts)      ? shifts.length      : 0,
  }
}

// ─── Setup step card ──────────────────────────────────────────────────────────

function SetupCard({ icon: Icon, color, title, description, count, countLabel, minCount = 1, path, action }) {
  const navigate = useNavigate()
  const done = count >= minCount

  return (
    <div className={cn(
      'rounded-2xl border bg-white p-5 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md',
      done ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl shrink-0', color)}>
          <Icon size={20} className="text-white" />
        </div>
        {done
          ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
          : <AlertCircle  size={18} className="text-amber-500  shrink-0 mt-0.5" />
        }
      </div>

      {/* Body */}
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>

      {/* Count badge */}
      <div className="flex items-center justify-between">
        <span className={cn(
          'rounded-full px-2.5 py-1 text-xs font-semibold',
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        )}>
          {count === 0 ? 'None configured' : `${count} ${countLabel}`}
        </span>
        <button
          onClick={() => navigate(path)}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
          {action ?? 'Manage'} <ArrowRight size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function SetupProgress({ counts }) {
  const steps = [
    counts.branches    >= 1,
    counts.departments >= 1,
    counts.designations>= 1,
    counts.leaveTypes  >= 1,
    counts.components  >= 1,
    counts.statutory   >= 1,
    counts.holidays    >= 1,
    counts.otRules     >= 1,
    counts.shifts      >= 1,
  ]
  const done  = steps.filter(Boolean).length
  const total = steps.length
  const pct   = Math.round((done / total) * 100)

  if (done === total) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-4">
        <CheckCircle2 size={28} className="text-emerald-500 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-800">System fully configured!</p>
          <p className="text-xs text-emerald-600 mt-0.5">All required settings are in place. Your Peoplenex showroom is ready to use.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-amber-600 animate-spin-slow" />
          <p className="font-semibold text-amber-800">Initial Setup — {pct}% complete</p>
        </div>
        <span className="text-xs font-medium text-amber-600">{done}/{total} steps done</span>
      </div>
      <div className="h-2 rounded-full bg-amber-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-amber-600 mt-2">
        Complete the steps below to finish setting up your HRMS.
      </p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    title: 'Organisation',
    description: 'Core structure of your company. Set these up first — everything else depends on them.',
    cards: (counts) => [
      {
        icon: Building2, color: 'bg-slate-700',
        title: 'Branches',
        description: 'Offices or locations your company operates from. Each employee, leave policy, and payroll rule is tied to a branch.',
        count: counts.branches, countLabel: 'branches',
        path: '/settings/branches', action: 'Manage',
      },
      {
        icon: Users, color: 'bg-blue-600',
        title: 'Departments',
        description: 'Functional units within each branch (HR, Engineering, Finance…). Used to group employees and filter reports.',
        count: counts.departments, countLabel: 'departments',
        path: '/departments', action: 'Manage',
      },
      {
        icon: Briefcase, color: 'bg-indigo-600',
        title: 'Designations',
        description: 'Job titles within departments. Assigned to employees to define their role and approval hierarchy.',
        count: counts.designations, countLabel: 'designations',
        path: '/designations', action: 'Manage',
      },
    ],
  },
  {
    title: 'Leave Management',
    description: 'Define the types of leave employees can apply for and their entitlements.',
    cards: (counts) => [
      {
        icon: CalendarDays, color: 'bg-teal-600',
        title: 'Leave Types',
        description: 'e.g. Casual Leave (12 days, paid), Sick Leave (10 days, paid, carry-forward), Unpaid Leave. Each type sets entitlement and policy.',
        count: counts.leaveTypes, countLabel: 'leave types',
        path: '/leaves/settings', action: 'Manage',
      },
      {
        icon: CalendarRange, color: 'bg-rose-500',
        title: 'Holiday Calendar',
        description: 'Public & national holidays per branch. Days marked as holidays are automatically flagged in attendance records.',
        count: counts.holidays, countLabel: `holidays in ${new Date().getFullYear()}`,
        path: '/shifts/holidays', action: 'Manage',
      },
    ],
  },
  {
    title: 'Payroll',
    description: 'Set up salary components and statutory rules before running payroll.',
    cards: (counts) => [
      {
        icon: DollarSign, color: 'bg-green-600',
        title: 'Salary Components',
        description: 'Earnings (Basic Pay, HRA, Conveyance) and Deductions (PF Employee, ESI Employee, TDS) that make up an employee\'s salary structure.',
        count: counts.components, countLabel: 'components',
        path: '/payroll/settings', action: 'Manage',
      },
      {
        icon: Landmark, color: 'bg-purple-600',
        title: 'Statutory Rules',
        description: 'PF, ESI, and Income Tax rates/slabs per branch. Payroll uses these to auto-calculate statutory deductions for every employee.',
        count: counts.statutory, countLabel: 'rules',
        path: '/payroll/settings', action: 'Manage',
      },
    ],
  },
  {
    title: 'Attendance & Shifts',
    description: 'Define work shifts and overtime rules that govern scheduling and pay calculations.',
    cards: (counts) => [
      {
        icon: Clock, color: 'bg-cyan-600',
        title: 'Shift Definitions',
        description: 'Create named shifts (Morning, Night, General) with start/end times, break duration, and grace period for late check-ins.',
        count: counts.shifts, countLabel: 'shifts',
        path: '/settings/shifts', action: 'Manage',
      },
      {
        icon: Timer, color: 'bg-orange-500',
        title: 'Overtime Rules',
        description: 'Define the daily work-hour threshold beyond which overtime kicks in, and the multiplier for OT pay calculation.',
        count: counts.otRules, countLabel: 'rules',
        path: '/overtime', action: 'Manage',
      },
    ],
  },
]

export default function SettingsPage() {
  const counts = useSetupCounts()
  const navigate = useNavigate()

  return (
    <div className="max-w-5xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings & Setup</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure every aspect of your Peoplenex showroom from one place.</p>
      </div>

      {/* Quick Setup banner */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-blue-50 to-slate-50 p-5 flex items-center gap-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shrink-0 shadow-md shadow-indigo-500/20">
          <Sparkles size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-indigo-900">Automotive Showroom Quick Setup</h3>
          <p className="text-sm text-indigo-700 mt-0.5">
            Seed departments, designations, leave types, shifts, and salary components tailored for a vehicle dealership — in one click.
          </p>
        </div>
        <button
          onClick={() => navigate('/settings/quick-setup')}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm shrink-0">
          Quick Setup <ArrowRight size={14} />
        </button>
      </div>

      {/* Setup progress */}
      <SetupProgress counts={counts} />

      {/* Sections */}
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800">{section.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.cards(counts).map((card) => (
              <SetupCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      ))}

      {/* Integrations — optional, kept separate from the required-setup progress bar */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-800">Integrations</h2>
          <p className="text-xs text-slate-500 mt-0.5">Optional connections to external systems.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0 bg-cyan-600">
              <Fingerprint size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Biometric Attendance</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Connect each branch's biometric device provider to automatically pull check-in/check-out punches instead of manual entry.
              </p>
            </div>
            <button
              onClick={() => navigate('/settings/biometric')}
              className="flex items-center justify-center gap-1 self-start rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
              Configure <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
