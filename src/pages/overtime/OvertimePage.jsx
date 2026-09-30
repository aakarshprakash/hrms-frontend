import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Timer, Plus, Inbox, ArrowRight } from 'lucide-react'
import { overtimeApi } from '@/lib/api/overtime'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Modal, Field, Input, Textarea, Tabs, Table, StatusPill, EmptyState, ErrorBanner, Avatar, Pagination } from '@/components/ui/kit'

const schema = z.object({
  date: z.string().min(1, 'Pick the day you worked extra'),
  hours: z.coerce.number().min(0.5, 'Minimum 0.5 hours').max(12, 'Maximum 12 hours'),
  reason: z.string().min(5, 'Describe the work (5+ characters)'),
})

const STATUS_FILTERS = [{ key: '', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' }]
const day = (v) => new Date(String(v).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const who = (e) => `${e?.first_name ?? ''} ${e?.last_name ?? ''}`.trim()
const hrs = (h) => `${Number(h ?? 0).toString().replace(/\.0+$/, '')}h`

function RequestModal({ onClose, onDone }) {
  const user = useAuthStore((s) => s.user)
  const [error, setError] = useState(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  async function submit(data) {
    setError(null)
    try {
      await overtimeApi.submit({ ...data, employee_id: user?.employee_id })
      onDone()
    } catch (e) { setError(e) }
  }

  return (
    <Modal title="Claim overtime" subtitle="Approved hours are paid in the next payroll run at your branch's overtime rate." size="sm" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="ot-form" loading={isSubmitting}>Submit claim</Button>
      </>}>
      <form id="ot-form" onSubmit={handleSubmit(submit)} className="space-y-4">
        <ErrorBanner error={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required error={errors.date?.message}>
            <Input type="date" max={new Date().toLocaleDateString('en-CA')} {...register('date')} />
          </Field>
          <Field label="Extra hours" required error={errors.hours?.message}>
            <Input type="number" step="0.5" min="0.5" max="12" placeholder="e.g. 2.5" {...register('hours')} />
          </Field>
        </div>
        <Field label="What did you work on?" required error={errors.reason?.message}>
          <Textarea rows={3} placeholder="e.g. Month-end stock audit at the spares counter" {...register('reason')} />
        </Field>
      </form>
    </Modal>
  )
}

/** Overtime claims: raise your own, and (for managers / HR) see the team's. */
export default function OvertimePage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { can, dataScope } = useRole()
  const seesOthers = dataScope !== 'self'
  const [tab, setTab] = useState(user?.employee_id ? 'mine' : 'team')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [composing, setComposing] = useState(false)
  const [flash, setFlash] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ot-requests', tab, status, page],
    queryFn: () => overtimeApi.list({ mine: tab === 'mine' ? 1 : undefined, status: status || undefined, page }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
  const rows = data?.data ?? []

  const { data: pending } = useQuery({
    queryKey: ['ot-requests', 'pending-count'],
    queryFn: () => overtimeApi.list({ status: 'pending' }).then((r) => r.data?.meta?.total ?? 0),
    enabled: can('leaves.approve') && seesOthers,
  })

  const done = () => {
    setComposing(false)
    qc.invalidateQueries({ queryKey: ['ot-requests'] })
    qc.invalidateQueries({ queryKey: ['approvals-count'] })
    setFlash('Overtime claim sent for approval.')
    setTimeout(() => setFlash(null), 4000)
  }

  const columns = [
    ...(tab === 'team' ? [{ key: 'employee', label: 'Employee', render: (r) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={who(r.employee)} src={r.employee?.avatar_url} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{who(r.employee)}</p>
          <p className="text-xs text-slate-500">{r.employee?.employee_code}</p>
        </div>
      </div>
    ) }] : []),
    { key: 'date', label: 'Day', render: (r) => <span className="whitespace-nowrap font-medium text-slate-800">{day(r.date)}</span> },
    { key: 'hours', label: 'Hours', align: 'right', render: (r) => <span className="font-semibold text-slate-900">{hrs(r.hours)}</span> },
    { key: 'reason', label: 'Work done', render: (r) => <span className="line-clamp-2 max-w-sm text-slate-600">{r.reason ?? '—'}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
    { key: 'note', label: 'Approver note', render: (r) => (
      <span className="text-xs text-slate-500">{r.comments ?? ''}{r.approver && <span className="block text-slate-400">— {r.approver.name}</span>}</span>
    ) },
  ]

  return (
    <div>
      <PageHeader icon={Timer} title="Overtime"
        subtitle="Claim extra hours worked — approved overtime is paid with the next payroll."
        actions={<>
          {pending > 0 && (
            <Link to="/approvals?tab=overtime"><Button variant="secondary" icon={Inbox}>Review {pending} pending</Button></Link>
          )}
          {user?.employee_id && <Button icon={Plus} onClick={() => setComposing(true)}>Claim overtime</Button>}
        </>} />

      {flash && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-700">{flash}</div>}

      {seesOthers && user?.employee_id && (
        <Tabs className="mb-4" value={tab} onChange={(k) => { setTab(k); setPage(1) }}
          tabs={[{ key: 'mine', label: 'My claims' }, { key: 'team', label: dataScope === 'team' ? 'My team' : 'Everyone' }]} />
      )}

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-3">
          <Tabs variant="pills" value={status} onChange={(k) => { setStatus(k); setPage(1) }} tabs={STATUS_FILTERS} />
          {data?.meta?.total != null && <span className="text-xs text-slate-500">{data.meta.total} claim{data.meta.total === 1 ? '' : 's'}</span>}
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
          <Table rows={rows} columns={columns}
            empty={<EmptyState icon={Timer} title={status ? `No ${status} claims` : 'No overtime claims yet'}
              description={tab === 'mine' ? 'Worked beyond your shift? Claim the extra hours here.' : undefined}
              action={tab === 'mine' && !status && user?.employee_id && <Button variant="soft" icon={Plus} onClick={() => setComposing(true)}>Claim overtime</Button>} />} />
        )}
        <div className="px-4 pb-3"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </Card>

      {tab === 'team' && can('leaves.approve') && (
        <p className="mt-3 flex items-center gap-1 text-xs text-slate-500">
          Decisions are made from the approvals inbox, which follows each branch's approval workflow.
          <Link to="/approvals?tab=overtime" className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:underline">Open approvals <ArrowRight size={12} /></Link>
        </p>
      )}

      {composing && <RequestModal onClose={() => setComposing(false)} onDone={done} />}
    </div>
  )
}
