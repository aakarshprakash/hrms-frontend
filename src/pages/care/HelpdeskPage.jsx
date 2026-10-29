import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { LifeBuoy, Plus, Inbox, AlarmClock, UserX, ShieldAlert, Star, Search, EyeOff } from 'lucide-react'
import { helpdeskApi } from '@/lib/api/care'
import { apiError } from '@/lib/api/axios'
import { TICKET_STATUS, PRIORITY, ago } from '@/lib/care'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import {
  PageHeader, Card, Button, StatCard, Table, StatusPill, EmptyState, Pagination, Modal, Field, Input, Select, Textarea, Toggle, ErrorBanner, Tabs,
} from '@/components/ui/kit'

/** HR helpdesk: employees raise and follow tickets; HR works the queue. */
export default function HelpdeskPage() {
  const navigate = useNavigate()
  const { data: meta } = useQuery({ queryKey: ['helpdesk-meta'], queryFn: () => helpdeskApi.meta().then((r) => r.data.data) })
  const handler = meta?.can_handle
  const [view, setView] = useState(null)
  const scope = view ?? (handler ? 'all' : 'mine')
  const [filters, setFilters] = useState({ status: 'open', type: '', assigned: '', search: '', page: 1 })
  const [raising, setRaising] = useState(false)
  const set = (p) => setFilters((f) => ({ ...f, page: 1, ...p }))

  const { data, isLoading } = useQuery({
    queryKey: ['helpdesk', scope, filters],
    queryFn: () => helpdeskApi.list({ scope, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: !!meta,
  })

  return (
    <div className="space-y-6">
      <PageHeader icon={LifeBuoy} title="Helpdesk" subtitle="Ask HR anything — salary, leave, documents — or raise a grievance, confidentially if you need to."
        actions={<Button icon={Plus} onClick={() => setRaising(true)}>Raise a ticket</Button>} />

      {handler && meta.stats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Open" value={meta.stats.open} icon={Inbox} tone="blue" onClick={() => { setView('all'); set({ status: 'open', assigned: '' }) }} />
          <StatCard label="Unassigned" value={meta.stats.unassigned} icon={UserX} tone={meta.stats.unassigned ? 'amber' : 'slate'} onClick={() => { setView('all'); set({ status: 'open', assigned: 'none' }) }} />
          <StatCard label="Past target" value={meta.stats.overdue} icon={AlarmClock} tone={meta.stats.overdue ? 'red' : 'slate'} />
          <StatCard label="Open grievances" value={meta.stats.grievances} icon={ShieldAlert} tone="purple" onClick={() => { setView('all'); set({ status: 'open', type: 'grievance' }) }} />
          <StatCard label="Satisfaction" value={meta.stats.avg_rating ? `${meta.stats.avg_rating} / 5` : '—'} icon={Star} tone="green" />
        </div>
      )}

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          {handler ? <Tabs variant="pills" value={scope} onChange={setView} tabs={[{ key: 'all', label: 'Team queue' }, { key: 'mine', label: 'My tickets' }]} /> : <p className="font-semibold text-slate-900">My tickets</p>}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input className="w-52 pl-8" placeholder="Number or subject…" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
            </div>
            <Select className="w-auto" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="open">Open</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="">All</option>
            </Select>
            {scope === 'all' && (
              <>
                <Select className="w-auto" value={filters.type} onChange={(e) => set({ type: e.target.value })}>
                  <option value="">Requests & grievances</option><option value="request">Requests</option><option value="grievance">Grievances</option>
                </Select>
                <Select className="w-auto" value={filters.assigned} onChange={(e) => set({ assigned: e.target.value })}>
                  <option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option>
                </Select>
              </>
            )}
          </div>
        </div>
        {isLoading || !meta ? <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div> : (
          <Table rows={data?.data ?? []} onRowClick={(t) => navigate(`/helpdesk/${t.id}`)}
            empty={<EmptyState icon={LifeBuoy} title="No tickets here" description={scope === 'mine' ? 'Raise a ticket and HR will get back to you.' : 'Nothing in this view.'} />}
            columns={[
              { key: 'number', label: 'Ticket', render: (t) => (
                <div>
                  <p className="flex items-center gap-1.5 font-medium text-slate-900">{t.subject}{t.anonymous && <EyeOff size={12} className="text-slate-400" title="Anonymous" />}</p>
                  <p className="text-xs text-slate-400">{t.number} · {t.category_label}{t.type === 'grievance' && ' · grievance'}</p>
                </div>
              ) },
              ...(scope === 'all' ? [{ key: 'employee', label: 'Raised by', render: (t) => <span className={cn(t.anonymous && 'italic text-slate-400')}>{t.employee.name}</span> }] : []),
              { key: 'priority', label: 'Priority', render: (t) => <StatusPill tone={PRIORITY[t.priority][0]} label={PRIORITY[t.priority][1]} dot={false} /> },
              { key: 'status', label: 'Status', render: (t) => (
                <div className="flex flex-wrap gap-1">
                  <StatusPill tone={TICKET_STATUS[t.status][0]} label={TICKET_STATUS[t.status][1]} />
                  {t.overdue && <StatusPill tone="red" label="Past target" dot={false} />}
                </div>
              ) },
              ...(scope === 'all' ? [{ key: 'assignee', label: 'With', render: (t) => t.assignee?.name ?? <span className="text-slate-400">Unassigned</span> }] : []),
              { key: 'created_at', label: 'Raised', render: (t) => <span className="text-xs text-slate-500">{ago(t.created_at)}</span> },
            ]} />
        )}
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} /></div>
      </Card>

      {raising && meta && <RaiseModal categories={meta.categories} onClose={() => setRaising(false)} onCreated={(t) => navigate(`/helpdesk/${t.id}`)} />}
    </div>
  )
}

function RaiseModal({ categories, onClose, onCreated }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ type: 'request', category: 'payroll', subject: '', description: '', priority: 'normal', anonymous: false })
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const create = useMutation({
    mutationFn: () => helpdeskApi.create(form).then((r) => r.data.data),
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ['helpdesk'] }); onCreated(t) },
  })
  const grievance = form.type === 'grievance'

  return (
    <Modal title="Raise a ticket" onClose={onClose} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.isPending} disabled={form.subject.length < 4 || form.description.length < 10} onClick={() => create.mutate()}>Submit</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[['request', 'A question or request', 'Salary, leave, letters, access…'], ['grievance', 'A grievance', 'Something that’s wrong at work — handled confidentially']].map(([key, title, hint]) => (
            <button key={key} type="button" onClick={() => set({ type: key, category: key === 'grievance' ? 'conduct' : 'payroll', priority: key === 'grievance' ? 'high' : 'normal' })}
              className={cn('rounded-lg border p-3 text-left', form.type === key ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50')}>
              <span className="block text-[13px] font-medium text-slate-900">{title}</span><span className="block text-xs text-slate-500">{hint}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category"><Select value={form.category} onChange={(e) => set({ category: e.target.value })}>{categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
          <Field label="Priority"><Select value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
            <option value="low">Low — when you can</option><option value="normal">Normal</option><option value="high">High — affecting my work</option><option value="urgent">Urgent — needs action today</option>
          </Select></Field>
        </div>
        <Field label="Subject" required><Input value={form.subject} maxLength={191} onChange={(e) => set({ subject: e.target.value })} placeholder="e.g. PF deduction looks wrong in September" /></Field>
        <Field label="Details" required hint="Include dates, amounts or names that help HR sort it out."><Textarea rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        {grievance && (
          <Toggle checked={form.anonymous} onChange={(v) => set({ anonymous: v })} label="Keep my name hidden from HR"
            description="HR sees the grievance and can reply, but not who raised it. You can still follow and answer it here." />
        )}
        <ErrorBanner error={create.error} message={create.error ? apiError(create.error) : undefined} />
      </div>
    </Modal>
  )
}
