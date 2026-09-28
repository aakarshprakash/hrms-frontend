import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, Plus, Pencil, Trash2, MapPin, Clock, Users, CalendarClock, Landmark, ArrowRight } from 'lucide-react'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { PageHeader, Card, Button, IconButton, Modal, Field, Input, Select, Textarea, EmptyState, ErrorBanner } from '@/components/ui/kit'

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'Pacific/Auckland']
const CURRENCIES = [['INR', 'Indian Rupee'], ['USD', 'US Dollar'], ['EUR', 'Euro'], ['GBP', 'British Pound'], ['AED', 'UAE Dirham'], ['SGD', 'Singapore Dollar'], ['AUD', 'Australian Dollar']]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EMPTY = { name: '', address: '', city: '', country: 'India', timezone: 'Asia/Kolkata', currency_code: 'INR', payroll_days_in_month: 30, week_off_days: [0, 6] }

function BranchModal({ branch, onClose, onSaved }) {
  const [form, setForm] = useState(() => (branch ? {
    name: branch.name ?? '', address: branch.address ?? '', city: branch.city ?? '', country: branch.country ?? '',
    timezone: branch.timezone ?? 'Asia/Kolkata', currency_code: branch.currency_code ?? 'INR',
    payroll_days_in_month: branch.payroll_days_in_month ?? 30, week_off_days: branch.week_off_days ?? [0, 6],
  } : EMPTY))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleDay = (d) => setForm((f) => ({ ...f, week_off_days: f.week_off_days.includes(d) ? f.week_off_days.filter((x) => x !== d) : [...f.week_off_days, d].sort() }))

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, payroll_days_in_month: Number(form.payroll_days_in_month) || 30 }
      return branch ? branchApi.update(branch.id, body) : branchApi.create(body)
    },
    onSuccess: onSaved,
  })

  return (
    <Modal size="lg" title={branch ? `Edit ${branch.name}` : 'New branch'} subtitle="A location people work from — it sets their timezone, week-offs and pay-day divisor." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="branch-form" loading={save.isPending}>{branch ? 'Save changes' : 'Create branch'}</Button></>}>
      <form id="branch-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <ErrorBanner error={save.error} />
        <Field label="Branch name" required>
          <Input required autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Edappally Showroom" />
        </Field>
        <Field label="Address">
          <Textarea rows={2} value={form.address} onChange={set('address')} placeholder="Building, street, area" className="min-h-0" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City"><Input value={form.city} onChange={set('city')} placeholder="e.g. Kochi" /></Field>
          <Field label="Country"><Input value={form.country} onChange={set('country')} /></Field>
          <Field label="Timezone">
            <Select value={form.timezone} onChange={set('timezone')}>{TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}</Select>
          </Field>
          <Field label="Currency">
            <Select value={form.currency_code} onChange={set('currency_code')}>{CURRENCIES.map(([c, l]) => <option key={c} value={c}>{c} — {l}</option>)}</Select>
          </Field>
        </div>
        <Field label="Working days" hint="Unselected days are week-offs: no absence marking and no leave deducted.">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const working = !form.week_off_days.includes(i)
              return (
                <button key={d} type="button" onClick={() => toggleDay(i)} aria-pressed={working}
                  className={cn('h-9 w-12 rounded-lg border text-xs font-semibold transition-colors',
                    working ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300')}>
                  {d}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Payroll days in a month" hint="Divisor for the per-day rate used in loss-of-pay deductions (commonly 30 or 26)." className="sm:w-1/2">
          <Input type="number" min={1} max={31} value={form.payroll_days_in_month} onChange={set('payroll_days_in_month')} />
        </Field>
      </form>
    </Modal>
  )
}

/** Locations the organisation operates from. */
export default function BranchesPage() {
  const qc = useQueryClient()
  const company = useAuthStore((s) => s.company)
  const [editing, setEditing] = useState(null) // null | 'new' | branch
  const [deleting, setDeleting] = useState(null)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => { const raw = r.data?.data ?? r.data; return Array.isArray(raw) ? raw : [] }),
  })
  const remove = useMutation({
    mutationFn: (id) => branchApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setDeleting(null) },
  })
  const people = branches.reduce((n, b) => n + (b.employees_count ?? 0), 0)

  return (
    <div>
      <PageHeader icon={Building2} title="Branches"
        subtitle={branches.length ? `${branches.length} location${branches.length === 1 ? '' : 's'} · ${people} active people` : 'Offices and locations your organisation operates from.'}
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>Add branch</Button>} />

      <Link to="/settings/organisation" className="group mb-6 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs transition-colors hover:border-blue-200">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Landmark size={17} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-900">{company?.name ?? 'Organisation profile'}</p>
          <p className="text-xs text-slate-500">Legal name, registered address and statutory registrations are in the organisation profile.</p>
        </div>
        <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500" />
      </Link>

      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
        : branches.length === 0 ? (
          <Card><EmptyState icon={Building2} title="No branches yet" description="Add the first location your people work from." action={<Button icon={Plus} onClick={() => setEditing('new')}>Add branch</Button>} /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((b) => {
              const workDays = WEEKDAYS.filter((_, i) => !(b.week_off_days ?? [0, 6]).includes(i))
              return (
                <Card key={b.id} padded={false} className="flex flex-col">
                  <div className="flex items-start gap-3 p-5 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white"><Building2 size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-semibold text-slate-900">{b.name}</h3>
                      <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                        <MapPin size={12} className="shrink-0" />{[b.city, b.country].filter(Boolean).join(', ') || 'No address yet'}
                      </p>
                    </div>
                    <div className="flex gap-0.5">
                      <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(b)} />
                      <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => setDeleting(b)} />
                    </div>
                  </div>
                  <dl className="mt-auto grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
                    <div className="px-2 py-3">
                      <dt className="flex items-center justify-center gap-1 text-[11px] text-slate-500"><Users size={12} />People</dt>
                      <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-900">{b.employees_count ?? 0}</dd>
                    </div>
                    <div className="px-2 py-3">
                      <dt className="flex items-center justify-center gap-1 text-[11px] text-slate-500"><CalendarClock size={12} />Work week</dt>
                      <dd className="mt-0.5 text-[15px] font-semibold text-slate-900" title={workDays.join(', ')}>{workDays.length} days</dd>
                    </div>
                    <div className="px-2 py-3">
                      <dt className="flex items-center justify-center gap-1 text-[11px] text-slate-500"><Clock size={12} />Timezone</dt>
                      <dd className="mt-0.5 truncate text-[13px] font-semibold text-slate-900">{(b.timezone ?? '—').split('/').pop().replace('_', ' ')}</dd>
                    </div>
                  </dl>
                </Card>
              )
            })}
          </div>
        )}

      {editing && (
        <BranchModal branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['branches'] }); setEditing(null) }} />
      )}

      {deleting && (
        <Modal title="Delete branch" size="sm" onClose={() => { setDeleting(null); remove.reset() }}
          footer={<>
            <Button variant="secondary" onClick={() => { setDeleting(null); remove.reset() }}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={remove.isPending} onClick={() => remove.mutate(deleting.id)}>Delete</Button>
          </>}>
          <ErrorBanner error={remove.error} className="mb-3" />
          <p className="text-[13px] text-slate-600">
            Delete <strong className="text-slate-900">{deleting.name}</strong>? This can't be undone.
            {deleting.employees_count > 0 && ` It still has ${deleting.employees_count} active ${deleting.employees_count === 1 ? 'person' : 'people'} — move them to another branch first.`}
          </p>
        </Modal>
      )}
    </div>
  )
}
