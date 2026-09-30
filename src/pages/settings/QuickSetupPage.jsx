import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Briefcase, CalendarDays, Clock, IndianRupee, CheckCircle2, ArrowRight, Sparkles, Landmark,
  Car, HeartPulse, Banknote, Store,
} from 'lucide-react'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api/axios'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, CardHeader, Button, Field, Select, ErrorBanner } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

const ICONS = { automotive: Car, healthcare: HeartPulse, finance: Banknote, general: Store }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Pill({ children, tone = 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100', green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-rose-50 text-rose-700 border-rose-100', slate: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>
}

const RESULT_LABELS = {
  departments: 'Departments', designations: 'Designations', shifts: 'Shifts', leave_types: 'Leave types',
  salary_components: 'Pay components', statutory_rules: 'Statutory rules',
}

export default function QuickSetupPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const company = useAuthStore((s) => s.company)
  const [branchId, setBranchId] = useState(activeBranch?.id ?? '')
  const [pickedKey, setTemplateKey] = useState('')

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? []) })
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['industry-templates'],
    queryFn: () => api.get('/industry-templates').then((r) => r.data.data),
  })

  // Until the user picks one, default to the organisation's own industry.
  const templateKey = pickedKey || (templates.find((t) => t.key === company?.industry)?.key ?? (templates.length ? 'general' : ''))

  const template = useMemo(() => templates.find((t) => t.key === templateKey), [templates, templateKey])

  const mutation = useMutation({
    mutationFn: () => api.post('/quick-setup', { branch_id: branchId, industry: templateKey }).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries(),
  })

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader icon={Sparkles} title="Industry starter templates"
        subtitle="Set a branch up in one step with departments, roles, shifts, leave and pay rules suited to your industry. Existing items are never overwritten, and everything stays editable." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {templates.map((t) => {
          const Icon = ICONS[t.key] ?? Store
          return (
            <button key={t.key} type="button" onClick={() => { setTemplateKey(t.key); mutation.reset() }}
              className={cn('rounded-2xl border-2 bg-white p-4 text-left transition-all',
                templateKey === t.key ? 'border-blue-500 shadow-md shadow-blue-500/10' : 'border-slate-200 hover:border-slate-300')}>
              <div className={cn('mb-2 flex h-10 w-10 items-center justify-center rounded-xl',
                templateKey === t.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')}><Icon size={19} /></div>
              <p className="text-sm font-semibold capitalize text-slate-900">{t.key}</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-500 first-letter:uppercase">{t.label.split('—')[1]?.trim() ?? t.label}</p>
            </button>
          )
        })}
      </div>

      {template && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padded={false}>
            <CardHeader icon={Building2} title={`Departments & designations (${template.departments.length})`} />
            <div className="space-y-3 p-5">
              {template.departments.map((d) => (
                <div key={d.name}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{d.name}</p>
                  <div className="flex flex-wrap gap-1">{d.designations.map((t) => <Pill key={t} tone="blue">{t}</Pill>)}</div>
                </div>
              ))}
            </div>
          </Card>
          <div className="space-y-4">
            <Card padded={false}>
              <CardHeader icon={Clock} title={`Shifts (${template.shifts.length})`}
                subtitle={`Weekly off: ${template.week_off_days.length ? template.week_off_days.map((d) => DAYS[d]).join(', ') : 'rostered per person (24×7)'}`} />
              <div className="divide-y divide-slate-100">
                {template.shifts.map((s) => (
                  <div key={s.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <span className="text-xs text-slate-500">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)} · break {s.break_minutes}m · grace {s.grace_minutes}m</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card padded={false}>
              <CardHeader icon={CalendarDays} title={`Leave types (${template.leave_types.length})`} />
              <div className="flex flex-wrap gap-1.5 p-5">
                {template.leave_types.map((l) => (
                  <Pill key={l.name} tone={l.paid ? 'green' : 'red'}>{l.name}{l.days_per_year ? ` · ${l.days_per_year}d` : ''}{l.carry_forward ? ' · carry fwd' : ''}</Pill>
                ))}
              </div>
            </Card>
            <Card padded={false}>
              <CardHeader icon={IndianRupee} title={`Pay components (${template.salary_components.length})`}
                subtitle={<span className="inline-flex items-center gap-1"><Landmark size={11} /> plus statutory rules: {template.statutory.join(', ')}</span>} />
              <div className="flex flex-wrap gap-1.5 p-5">
                {template.salary_components.map((c) => (
                  <Pill key={c.name} tone={c.type === 'earning' ? 'green' : 'red'}>{c.name}</Pill>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      <ErrorBanner error={mutation.error} />

      {mutation.isSuccess ? (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={26} className="shrink-0 text-emerald-500" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900">Template applied</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {Object.entries(RESULT_LABELS).map(([k, label]) => (
                  <span key={k} className="text-emerald-800">{label}: <b>{mutation.data.created[k] ?? 0}</b> created
                    {mutation.data.skipped[k] ? <span className="text-emerald-600"> · {mutation.data.skipped[k]} already there</span> : null}</span>
                ))}
              </div>
            </div>
            <Button variant="success" onClick={() => navigate('/settings')}>Back to settings <ArrowRight size={14} /></Button>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 border-blue-100 bg-blue-50/40 sm:flex-row sm:items-end">
          <Field label="Apply to branch" required className="flex-1">
            <Select value={branchId} onChange={(e) => { setBranchId(e.target.value); mutation.reset() }}>
              <option value="">Choose a branch…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Button size="lg" icon={Briefcase} disabled={!branchId || !templateKey} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Apply {templateKey} template
          </Button>
        </Card>
      )}
    </div>
  )
}
