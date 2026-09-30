import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FilePen, Plus, Inbox, ArrowRight } from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { timeLabel } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Modal, Field, Input, Textarea, Tabs, Table, StatusPill, EmptyState, ErrorBanner, Avatar, Pagination } from '@/components/ui/kit'

const schema = z.object({
  date: z.string().min(1, 'Pick the day to correct'),
  requested_check_in: z.string().optional(),
  requested_check_out: z.string().optional(),
  reason: z.string().min(5, 'Tell your approver what happened (5+ characters)'),
}).refine((v) => v.requested_check_in || v.requested_check_out, { message: 'Enter a check-in or check-out time', path: ['requested_check_in'] })

const STATUS_FILTERS = [{ key: '', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' }]
const day = (v) => new Date(String(v).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const who = (e) => `${e?.first_name ?? ''} ${e?.last_name ?? ''}`.trim()

function RequestModal({ date, onClose, onDone }) {
  const [error, setError] = useState(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { date: date ?? '', requested_check_in: '', requested_check_out: '', reason: '' },
  })

  async function submit(data) {
    setError(null)
    try {
      await attendanceApi.submitRegularization({
        ...data,
        requested_check_in: data.requested_check_in || undefined,
        requested_check_out: data.requested_check_out || undefined,
      })
      onDone()
    } catch (e) { setError(e) }
  }

  return (
    <Modal title="Request an attendance correction" subtitle="Your manager reviews it; approved times replace the recorded ones." onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="reg-form" loading={isSubmitting}>Submit request</Button>
      </>}>
      <form id="reg-form" onSubmit={handleSubmit(submit)} className="space-y-4">
        <ErrorBanner error={error} />
        <Field label="Date" required error={errors.date?.message}>
          <Input type="date" max={new Date().toLocaleDateString('en-CA')} {...register('date')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Actual check-in" error={errors.requested_check_in?.message}>
            <Input type="time" {...register('requested_check_in')} />
          </Field>
          <Field label="Actual check-out" hint="Leave blank if only check-in was wrong.">
            <Input type="time" {...register('requested_check_out')} />
          </Field>
        </div>
        <Field label="Reason" required error={errors.reason?.message}>
          <Textarea rows={3} placeholder="e.g. Forgot to punch in — was at the Vyttila branch for a delivery" {...register('reason')} />
        </Field>
      </form>
    </Modal>
  )
}

/** Attendance corrections: raise your own, and (for managers / HR) see the team's. */
export default function RegularizationPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { can, dataScope } = useRole()
  const [params] = useSearchParams()
  const seesOthers = dataScope !== 'self'
  const [tab, setTab] = useState(user?.employee_id ? 'mine' : 'team')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  // /attendance/regularizations?date=YYYY-MM-DD opens the form for that day.
  const [composeFor, setComposeFor] = useState(params.get('date'))
  const [flash, setFlash] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['regularizations', tab, status, page],
    queryFn: () => attendanceApi.listRegularizations({ mine: tab === 'mine' ? 1 : undefined, status: status || undefined, page }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
  const rows = data?.data ?? []

  const { data: pending } = useQuery({
    queryKey: ['regularizations', 'pending-count'],
    queryFn: () => attendanceApi.listRegularizations({ status: 'pending' }).then((r) => r.data?.meta?.total ?? 0),
    enabled: can('leaves.approve') && seesOthers,
  })

  const done = () => {
    setComposeFor(null)
    qc.invalidateQueries({ queryKey: ['regularizations'] })
    qc.invalidateQueries({ queryKey: ['approvals-count'] })
    setFlash('Request sent to your approver.')
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
    { key: 'recorded', label: 'Recorded', render: (r) => (
      <span className="whitespace-nowrap tabular-nums text-slate-500">{timeLabel(r.attendance?.check_in)} → {timeLabel(r.attendance?.check_out)}</span>
    ) },
    { key: 'requested', label: 'Requested', render: (r) => (
      <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">{timeLabel(r.requested_check_in)} → {timeLabel(r.requested_check_out)}</span>
    ) },
    { key: 'reason', label: 'Reason', render: (r) => <span className="line-clamp-2 max-w-xs text-slate-600">{r.reason}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader icon={FilePen} title="Attendance corrections"
        subtitle="Missed a punch or clocked the wrong time? Request a correction — approved times replace what was recorded."
        actions={<>
          {pending > 0 && (
            <Link to="/approvals?tab=regularization"><Button variant="secondary" icon={Inbox}>Review {pending} pending</Button></Link>
          )}
          {user?.employee_id && <Button icon={Plus} onClick={() => setComposeFor('')}>New request</Button>}
        </>} />

      {flash && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-700">{flash}</div>}

      {seesOthers && user?.employee_id && (
        <Tabs className="mb-4" value={tab} onChange={(k) => { setTab(k); setPage(1) }}
          tabs={[{ key: 'mine', label: 'My requests' }, { key: 'team', label: dataScope === 'team' ? 'My team' : 'Everyone' }]} />
      )}

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-3">
          <Tabs variant="pills" value={status} onChange={(k) => { setStatus(k); setPage(1) }} tabs={STATUS_FILTERS} />
          {data?.meta?.total != null && <span className="text-xs text-slate-500">{data.meta.total} request{data.meta.total === 1 ? '' : 's'}</span>}
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
          <Table rows={rows} columns={columns}
            empty={<EmptyState icon={FilePen} title={status ? `No ${status} requests` : 'No correction requests yet'}
              description={tab === 'mine' ? 'When a punch is missing or wrong, raise a request and your manager will review it.' : undefined}
              action={tab === 'mine' && !status && user?.employee_id && <Button variant="soft" icon={Plus} onClick={() => setComposeFor('')}>New request</Button>} />} />
        )}
        <div className="px-4 pb-3"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </Card>

      {tab === 'team' && can('leaves.approve') && (
        <p className="mt-3 flex items-center gap-1 text-xs text-slate-500">
          Decisions are made from the approvals inbox, which follows each branch's approval workflow.
          <Link to="/approvals?tab=regularization" className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:underline">Open approvals <ArrowRight size={12} /></Link>
        </p>
      )}

      {composeFor !== null && <RequestModal date={composeFor} onClose={() => setComposeFor(null)} onDone={done} />}
    </div>
  )
}
