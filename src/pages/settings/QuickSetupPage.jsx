import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Car, Building2, Users, Briefcase, CalendarDays,
  Clock, DollarSign, ChevronRight, CheckCircle2, AlertCircle,
  ArrowRight, Sparkles, Loader2,
} from 'lucide-react'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api/axios'
import { cn } from '@/lib/utils'

// ─── Static preview data ────────────────────────────────────────────────────

const DEPARTMENTS = [
  'Sales',
  'Vehicle Service',
  'Parts & Accessories',
  'Finance & Insurance',
  'Administration',
  'Customer Relations',
]

const DESIGNATIONS = [
  { dept: 'Sales', titles: ['Sales Executive', 'Senior Sales Executive', 'Sales Manager', 'Sales Head'] },
  { dept: 'Vehicle Service', titles: ['Technician', 'Senior Technician', 'Service Advisor', 'Service Manager', 'Workshop Manager'] },
  { dept: 'Parts & Accessories', titles: ['Parts Executive', 'Parts Manager'] },
  { dept: 'Finance & Insurance', titles: ['Finance Executive', 'Finance Manager'] },
  { dept: 'Administration', titles: ['Receptionist', 'HR Executive', 'Admin Executive', 'Admin Manager'] },
  { dept: 'Customer Relations', titles: ['CRM Executive', 'CRM Manager'] },
]

const LEAVE_TYPES = [
  { name: 'Casual Leave',        days: 12,  paid: true,  carry: false },
  { name: 'Sick Leave',          days: 10,  paid: true,  carry: false },
  { name: 'Earned Leave',        days: 15,  paid: true,  carry: true  },
  { name: 'Maternity Leave',     days: 84,  paid: true,  carry: false },
  { name: 'Paternity Leave',     days: 15,  paid: true,  carry: false },
  { name: 'Compensatory Off',    days: 0,   paid: true,  carry: false },
]

const SHIFTS = [
  { name: 'General Shift',  start: '09:00', end: '18:00', break: 30, grace: 10 },
  { name: 'Morning Shift',  start: '08:00', end: '17:00', break: 30, grace: 10 },
  { name: 'Service Shift',  start: '08:30', end: '17:30', break: 30, grace: 10 },
]

const SALARY_COMPONENTS = [
  { name: 'Basic Salary',           type: 'earning',   calc: 'fixed'      },
  { name: 'HRA',                    type: 'earning',   calc: 'percentage' },
  { name: 'Conveyance Allowance',   type: 'earning',   calc: 'fixed'      },
  { name: 'Special Allowance',      type: 'earning',   calc: 'fixed'      },
  { name: 'Sales Incentive',        type: 'earning',   calc: 'fixed'      },
  { name: 'PF Employee',            type: 'deduction', calc: 'percentage' },
  { name: 'ESI Employee',           type: 'deduction', calc: 'percentage' },
  { name: 'TDS',                    type: 'deduction', calc: 'percentage' },
]

// ─── Preview section components ─────────────────────────────────────────────

function PreviewCard({ icon: Icon, color, title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className={cn('flex items-center gap-3 px-5 py-3.5 border-b border-slate-100', color)}>
        <Icon size={16} className="text-white opacity-90" />
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Pill({ children, variant = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-100',
    red:    'bg-rose-50 text-rose-700 border-rose-100',
    slate:  'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <span className={cn('inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium', colors[variant])}>
      {children}
    </span>
  )
}

// ─── Result display ──────────────────────────────────────────────────────────

function ResultCard({ result, onGoToSettings }) {
  const rows = [
    { label: 'Departments',        created: result.created.departments,       skipped: result.skipped.departments },
    { label: 'Designations',       created: result.created.designations,      skipped: result.skipped.designations },
    { label: 'Leave Types',        created: result.created.leave_types,       skipped: result.skipped.leave_types },
    { label: 'Shifts',             created: result.created.shifts,            skipped: result.skipped.shifts },
    { label: 'Salary Components',  created: result.created.salary_components, skipped: result.skipped.salary_components },
  ]

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle2 size={28} className="text-emerald-500 shrink-0" />
        <div>
          <h3 className="font-bold text-emerald-900 text-lg">Quick Setup Complete!</h3>
          <p className="text-sm text-emerald-700">Your showroom defaults have been applied.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald-100 bg-emerald-50/60">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-emerald-600 uppercase tracking-wider">Created</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Skipped</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-2.5 font-medium text-slate-700">{r.label}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    {r.created}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center text-slate-400 text-xs">{r.skipped}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={onGoToSettings}
        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
        Go to Settings <ArrowRight size={14} />
      </button>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function QuickSetupPage() {
  const navigate = useNavigate()
  const activeBranch = useAuthStore((s) => s.activeBranch)

  const [selectedBranchId, setSelectedBranchId] = useState(activeBranch?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const { data: branchesRaw } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })
  const branches = Array.isArray(branchesRaw) ? branchesRaw : []

  const selectedBranch = branches.find((b) => b.id === Number(selectedBranchId) || b.id === selectedBranchId)

  async function handleApply() {
    if (!selectedBranchId) return
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/quick-setup', { branch_id: selectedBranchId })
      setResult(res.data?.data ?? res.data)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/20 shrink-0">
          <Car size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automotive Showroom Quick Setup</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Seed all standard departments, designations, leave types, shifts, and salary components
            for a vehicle dealership — without touching each settings page manually.
          </p>
        </div>
      </div>

      {/* Branch selector */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-blue-500" />
          <h2 className="font-semibold text-slate-800">Select Branch</h2>
          <span className="text-xs text-rose-500 font-medium">Required</span>
        </div>
        <p className="text-xs text-slate-500">All defaults will be created under the selected branch.</p>
        <select
          value={selectedBranchId}
          onChange={(e) => { setSelectedBranchId(e.target.value); setResult(null); setError('') }}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all"
        >
          <option value="">— Choose a branch —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Preview section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-500" />
          <h2 className="font-semibold text-slate-800">What will be created</h2>
          <span className="text-xs text-slate-400">(preview — read only)</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Departments */}
          <PreviewCard icon={Building2} color="bg-blue-600" title="Departments (6)">
            <ul className="space-y-1.5">
              {DEPARTMENTS.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-slate-700">
                  <ChevronRight size={12} className="text-blue-400 shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </PreviewCard>

          {/* Leave Types */}
          <PreviewCard icon={CalendarDays} color="bg-teal-600" title="Leave Types (6)">
            <div className="space-y-2">
              {LEAVE_TYPES.map((lt) => (
                <div key={lt.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 font-medium">{lt.name}</span>
                  <div className="flex items-center gap-1.5">
                    <Pill variant="slate">{lt.days === 0 ? 'ad-hoc' : `${lt.days}d`}</Pill>
                    {lt.carry && <Pill variant="green">carry-fwd</Pill>}
                  </div>
                </div>
              ))}
            </div>
          </PreviewCard>
        </div>

        {/* Designations */}
        <PreviewCard icon={Briefcase} color="bg-indigo-600" title="Designations (22 total)">
          <div className="grid gap-3 sm:grid-cols-2">
            {DESIGNATIONS.map((g) => (
              <div key={g.dept}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{g.dept}</p>
                <div className="flex flex-wrap gap-1">
                  {g.titles.map((t) => (
                    <Pill key={t} variant="blue">{t}</Pill>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PreviewCard>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Shifts */}
          <PreviewCard icon={Clock} color="bg-cyan-600" title="Shifts (3)">
            <div className="space-y-3">
              {SHIFTS.map((s) => (
                <div key={s.name} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.start} – {s.end}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill variant="slate">break {s.break}m</Pill>
                    <Pill variant="slate">grace {s.grace}m</Pill>
                  </div>
                </div>
              ))}
            </div>
          </PreviewCard>

          {/* Salary Components */}
          <PreviewCard icon={DollarSign} color="bg-green-600" title="Salary Components (8)">
            <div className="space-y-1.5">
              {SALARY_COMPONENTS.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{c.name}</span>
                  <div className="flex items-center gap-1.5">
                    <Pill variant={c.type === 'earning' ? 'green' : 'red'}>
                      {c.type === 'earning' ? 'Earning' : 'Deduction'}
                    </Pill>
                    <Pill variant="slate">{c.calc === 'percentage' ? '%' : 'Fixed'}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </PreviewCard>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <ResultCard result={result} onGoToSettings={() => navigate('/settings')} />
      )}

      {/* Apply button */}
      {!result && (
        <div className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <div className="flex-1">
            <p className="font-semibold text-indigo-900">
              {selectedBranch ? `Apply Defaults for ${selectedBranch.name}` : 'Select a branch to continue'}
            </p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Existing records with the same name will be skipped — this is safe to run multiple times.
            </p>
          </div>
          <button
            disabled={!selectedBranchId || loading}
            onClick={handleApply}
            className={cn(
              'flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-all shadow-sm shrink-0',
              selectedBranchId && !loading
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                : 'bg-indigo-300 cursor-not-allowed'
            )}>
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Apply Defaults
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
