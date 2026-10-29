import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UsersRound, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, BellRing } from 'lucide-react'
import { coverageApi, COVERAGE_STATUS } from '@/lib/api/coverage'
import { departmentApi, designationApi, branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { dateLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, IconButton, Modal, Field, Input, Select, Table, Tabs, Toggle, EmptyState, ErrorBanner, StatusPill } from '@/components/ui/kit'

const TABS = [{ key: 'today', label: 'Today' }, { key: 'forecast', label: 'Next 14 days' }, { key: 'rules', label: 'Minimum staffing' }]

/**
 * Is every team staffed today? Each team's minimum (e.g. Sales: 5 by 10:30)
 * against who has punched in, who is on leave and who hasn't come in yet;
 * the coming days with approved and pending leave; and the rules themselves.
 */
export default function CoveragePage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'today'
  const branchId = useAuthStore((s) => s.activeBranchId)

  return (
    <div className="space-y-6">
      <PageHeader icon={UsersRound} title="Team coverage"
        subtitle="Make sure every team has enough people at work — short-staffed teams are flagged and HR is alerted." />
      <Tabs tabs={TABS} value={tab} onChange={(key) => setParams(key === 'today' ? {} : { tab: key })} />
      {tab === 'today' && <Today branchId={branchId} onRules={() => setParams({ tab: 'rules' })} />}
      {tab === 'forecast' && <Forecast branchId={branchId} onRules={() => setParams({ tab: 'rules' })} />}
      {tab === 'rules' && <Rules />}
    </div>
  )
}

function Today({ branchId, onRules }) {
  const { data, isLoading } = useQuery({
    queryKey: ['coverage-today', branchId],
    queryFn: () => coverageApi.today(branchId ? { branch_id: branchId } : {}).then((r) => r.data.data),
    refetchInterval: 60_000,
  })
  if (isLoading || !data) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>

  const withRule = data.teams.filter((t) => t.rule_id)
  const others = data.teams.filter((t) => !t.rule_id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <SummaryChip tone="red" count={data.summary.short} label="short-staffed" />
        <SummaryChip tone="amber" count={data.summary.at_risk} label="at risk" />
        <span className="text-sm text-slate-500">{dateLabel(data.date)} · updates every minute</span>
      </div>

      {withRule.length === 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">Set a minimum for the teams that matter</p>
            <p className="text-sm text-slate-500">e.g. “Sales: at least 5 people by 10:30”. HR gets an alert when a team falls short.</p>
          </div>
          <Button icon={Plus} onClick={onRules}>Add a minimum</Button>
        </Card>
      )}

      {withRule.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {withRule.map((t) => <TeamCard key={t.key} team={t} />)}
        </div>
      )}

      {others.length > 0 && (
        <Card padded={false}>
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="font-semibold text-slate-900">Other departments</p>
            <p className="text-xs text-slate-500">No minimum set — shown for a quick look at who’s in.</p>
          </div>
          <Table rows={others} rowKey="key" columns={[
            { key: 'name', label: 'Department', render: (t) => <span className="font-medium text-slate-900">{t.name}</span> },
            { key: 'present', label: 'In', align: 'right', render: (t) => <b>{t.present}</b> },
            { key: 'scheduled', label: 'Scheduled', align: 'right' },
            { key: 'on_leave', label: 'On leave', align: 'right', render: (t) => t.on_leave + t.pending_leave },
            { key: 'not_in', label: 'Not in yet', align: 'right', render: (t) => <span className={t.not_in ? 'text-amber-700' : 'text-slate-400'}>{t.not_in}</span> },
          ]} />
        </Card>
      )}
    </div>
  )
}

function SummaryChip({ tone, count, label }) {
  const tones = { red: 'bg-rose-50 text-rose-700 ring-rose-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1', count ? tones[tone] : 'bg-emerald-50 text-emerald-700 ring-emerald-200')}>
      {count ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}{count} {label}
    </span>
  )
}

function TeamCard({ team: t }) {
  const [open, setOpen] = useState(false)
  const s = COVERAGE_STATUS[t.status]
  const pct = t.min_present ? Math.min(100, (t.present / t.min_present) * 100) : 0
  const bar = { ok: 'bg-emerald-500', at_risk: 'bg-amber-500', short: 'bg-rose-500' }[t.status]
  const scope = [t.department, t.designation, t.branch].filter(Boolean).join(' · ')

  return (
    <Card padded={false} className={cn(t.status === 'short' && 'ring-1 ring-rose-200')}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{t.name}</p>
            {scope && <p className="truncate text-xs text-slate-500">{scope}</p>}
          </div>
          {t.off_day ? <StatusPill tone="slate" label="Day off" /> : <StatusPill tone={s.tone} label={s.label} />}
        </div>
        <div className="mt-4 flex items-end gap-2">
          <span className="text-3xl font-bold text-slate-900">{t.present}</span>
          <span className="pb-1 text-sm text-slate-500">in · minimum {t.min_present} by {t.check_at}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <Stat label="On leave" value={t.on_leave + t.pending_leave} />
          <Stat label="Not in yet" value={t.not_in} warn={t.not_in > 0} />
          <Stat label="Day off" value={t.headcount - t.scheduled} />
        </div>
      </div>
      {(t.people_on_leave.length > 0 || t.people_not_in.length > 0) && (
        <>
          <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-xs font-medium text-slate-500 hover:text-slate-800">
            Who’s away {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {open && (
            <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-sm">
              {t.people_on_leave.length > 0 && <PeopleList title="On leave" people={t.people_on_leave} />}
              {t.people_not_in.length > 0 && <PeopleList title="Not punched in" people={t.people_not_in} />}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function Stat({ label, value, warn }) {
  return (
    <div className="rounded-lg bg-slate-50 py-1.5">
      <p className={cn('text-base font-semibold', warn ? 'text-amber-700' : 'text-slate-800')}>{value}</p>
      <p className="text-slate-500">{label}</p>
    </div>
  )
}

function PeopleList({ title, people }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="space-y-0.5">
        {people.map((p) => (
          <li key={p.code} className="flex justify-between gap-2 text-slate-700">
            <span className="truncate">{p.name} <span className="text-xs text-slate-400">{p.code}</span></span>
            {p.leave && <span className="shrink-0 text-xs text-slate-500">{p.leave}{p.pending ? ' (pending)' : ''}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Forecast({ branchId, onRules }) {
  const { data, isLoading } = useQuery({
    queryKey: ['coverage-forecast', branchId],
    queryFn: () => coverageApi.forecast({ days: 14, ...(branchId ? { branch_id: branchId } : {}) }).then((r) => r.data.data),
  })
  if (isLoading || !data) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
  if (data.rules.length === 0) {
    return <Card><EmptyState icon={UsersRound} title="No minimum staffing set" description="Add a minimum for a team to see the coming days."
      action={<Button icon={Plus} onClick={onRules}>Add a minimum</Button>} /></Card>
  }

  const cell = { ok: 'bg-emerald-50 text-emerald-800', at_risk: 'bg-amber-50 text-amber-800', short: 'bg-rose-100 text-rose-800 font-semibold' }

  return (
    <Card padded={false} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-slate-500">
            <th className="sticky left-0 bg-white px-4 py-3 text-left font-semibold">Team</th>
            {data.dates.map((d) => {
              const day = new Date(`${d}T00:00:00`)
              return <th key={d} className="min-w-14 px-1 py-2 text-center font-medium">{day.toLocaleDateString('en-IN', { weekday: 'short' })}<br /><span className="text-slate-800">{day.getDate()}</span></th>
            })}
          </tr>
        </thead>
        <tbody>
          {data.rules.map((r) => (
            <tr key={r.rule_id} className="border-b border-slate-50">
              <td className="sticky left-0 bg-white px-4 py-2"><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-500">min {r.min_present}</p></td>
              {data.dates.map((d) => {
                const x = r.days[d]
                const who = (x.people_on_leave ?? []).map((p) => `${p.name}${p.pending ? ' (pending)' : ''}`).join(', ')
                return (
                  <td key={d} className="p-1 text-center">
                    {x.off_day ? <span className="block rounded-md py-2 text-xs text-slate-300">off</span> : (
                      <span title={who ? `On leave: ${who}` : undefined} className={cn('block rounded-md py-2', cell[x.status])}>
                        {x.expected}<span className="text-[11px] opacity-60">/{r.min_present}</span>
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-slate-500">Expected in = scheduled minus approved and pending leave. Hover a day to see who’s away.</p>
    </Card>
  )
}

function Rules() {
  const qc = useQueryClient()
  const { can } = useRole()
  const editable = can('attendance.manage')
  const [editing, setEditing] = useState(null)
  const { data: rules = [], isLoading } = useQuery({ queryKey: ['coverage-rules'], queryFn: () => coverageApi.rules().then((r) => r.data.data) })
  const done = () => { ['coverage-rules', 'coverage-today', 'coverage-forecast'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); setEditing(null) }
  const save = useMutation({ mutationFn: ({ id, ...d }) => (id ? coverageApi.updateRule(id, d) : coverageApi.createRule(d)), onSuccess: done })
  const remove = useMutation({ mutationFn: coverageApi.deleteRule, onSuccess: done })

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="font-semibold text-slate-900">Minimum staffing</p>
          <p className="flex items-center gap-1 text-xs text-slate-500"><BellRing size={12} /> HR and attendance managers are alerted once a day when a team is short at its check time.</p>
        </div>
        {editable && <Button icon={Plus} onClick={() => setEditing('new')}>Add minimum</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div> : (
        <Table rows={rules} empty={<EmptyState icon={UsersRound} title="No minimums yet" description="e.g. Sales — at least 5 people in by 10:30." />}
          columns={[
            { key: 'name', label: 'Team', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
            { key: 'covers', label: 'Covers', render: (r) => [r.department?.name, r.designation?.title, r.branch?.name ?? 'All branches'].filter(Boolean).join(' · ') },
            { key: 'min', label: 'Minimum', align: 'right', render: (r) => <b>{r.min_present}</b> },
            { key: 'check', label: 'Checked at', render: (r) => String(r.check_at).slice(0, 5) },
            { key: 'alerts', label: 'Alerts sent', align: 'right', render: (r) => r.alerts_count },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.is_active ? 'active' : 'inactive'} /> },
            ...(editable ? [{ key: 'actions', label: '', align: 'right', render: (r) => (
              <div className="flex justify-end gap-0.5">
                <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(r)} />
                <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => { if (confirm(`Delete “${r.name}”?`)) remove.mutate(r.id) }} />
              </div>
            ) }] : []),
          ]} />
      )}
      {editing && <RuleModal initial={editing === 'new' ? null : editing} saving={save.isPending} error={save.error}
        onClose={() => { setEditing(null); save.reset() }} onSave={(d) => save.mutate({ id: editing === 'new' ? undefined : editing.id, ...d })} />}
    </Card>
  )
}

function RuleModal({ initial, onSave, onClose, saving, error }) {
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [form, setForm] = useState({
    name: initial?.name ?? '', branch_id: String(initial?.branch_id ?? activeBranchId ?? ''), department_id: String(initial?.department_id ?? ''),
    designation_id: String(initial?.designation_id ?? ''), min_present: initial?.min_present ?? 3, check_at: String(initial?.check_at ?? '10:30').slice(0, 5),
    is_active: initial?.is_active ?? true,
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchApi.list().then((r) => r.data?.data ?? []) })
  const { data: depts } = useQuery({ queryKey: ['departments', ''], queryFn: () => departmentApi.list({}).then((r) => r.data) })
  const { data: desigs } = useQuery({ queryKey: ['designations', ''], queryFn: () => designationApi.list({}).then((r) => r.data) })
  const departments = (depts?.data ?? []).filter((d) => !form.branch_id || String(d.branch_id) === form.branch_id)
  const designations = (desigs?.data ?? []).filter((d) => (!form.branch_id || String(d.branch_id) === form.branch_id) && (!form.department_id || String(d.department_id) === form.department_id))

  function submit(e) {
    e.preventDefault()
    const dept = departments.find((d) => String(d.id) === form.department_id)
    const desig = designations.find((d) => String(d.id) === form.designation_id)
    onSave({
      ...form, name: form.name.trim() || desig?.title || dept?.name || 'Team',
      branch_id: form.branch_id || null, department_id: form.department_id || null, designation_id: form.designation_id || null,
      min_present: Number(form.min_present),
    })
  }

  return (
    <Modal title={initial ? 'Edit minimum staffing' : 'Add minimum staffing'} subtitle="How many people a team needs at work, and when to check." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="cov-form" loading={saving}>Save</Button></>}>
      <form id="cov-form" className="space-y-4" onSubmit={submit}>
        <ErrorBanner error={error} />
        <Field label="Name" hint="Leave blank to use the department or designation name.">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Sales floor, Service advisors" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Branch">
            <Select value={form.branch_id} onChange={(e) => set({ branch_id: e.target.value, department_id: '', designation_id: '' })}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Department">
            <Select value={form.department_id} onChange={(e) => set({ department_id: e.target.value, designation_id: '' })}>
              <option value="">Any department</option>
              {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Designation" hint="Optional: e.g. only Sales Executives.">
            <Select value={form.designation_id} onChange={(e) => set({ designation_id: e.target.value })}>
              <option value="">Any designation</option>
              {designations.map((d) => <option key={d.id} value={String(d.id)}>{d.title}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum people at work" required>
            <Input type="number" min={1} required value={form.min_present} onChange={(e) => set({ min_present: e.target.value })} />
          </Field>
          <Field label="Check at" hint="Alert if the team is short at this time (branch time).">
            <Input type="time" required value={form.check_at} onChange={(e) => set({ check_at: e.target.value })} />
          </Field>
        </div>
        <Toggle checked={form.is_active} onChange={(is_active) => set({ is_active })} label="Active" description="Inactive minimums aren’t checked or alerted." />
      </form>
    </Modal>
  )
}
