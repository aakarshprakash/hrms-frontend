import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Clock3, Download, Send, X, XCircle, Ban } from 'lucide-react'
import { leaveApi } from '@/lib/api/leaves'
import { saveBlob } from '@/lib/api/payroll'
import { useRole } from '@/hooks/useRole'
import { dateLabel } from '@/lib/format'
import { dayCount, leaveRange, lowerLabel, SESSION_LABELS } from '@/lib/leave'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Modal, Button, Textarea, StatusPill, ErrorBanner, Avatar } from '@/components/ui/kit'
import { LeaveTypeChip } from './BalanceCards'

const UPCOMING = ['bg-white text-slate-300 ring-2 ring-slate-200', Clock3]

const STEP_STYLE = {
  approved: ['bg-emerald-500 text-white', Check],
  rejected: ['bg-rose-500 text-white', X],
  pending: ['bg-amber-100 text-amber-700 ring-2 ring-amber-200', Clock3],
}

export function LeaveDetailModal({ leaveId, onClose }) {
  const qc = useQueryClient()
  const { user } = useRole()
  const [mode, setMode] = useState(null) // approve | reject | cancel
  const [note, setNote] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['leave', leaveId],
    queryFn: () => leaveApi.get(leaveId).then((r) => r.data),
  })
  const leave = data?.data
  const timeline = data?.timeline ?? []
  const firstPending = timeline.find((s) => s.status === 'pending')?.step
  const own = leave && leave.employee_id === user?.employee_id

  const done = () => {
    ['leaves', 'leave', 'leave-summary', 'leave-calendar', 'approvals', 'approvals-count', 'leave-overview'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    setMode(null)
    setNote('')
  }
  const act = useMutation({
    mutationFn: () => mode === 'cancel'
      ? leaveApi.cancel(leaveId, { reason: note || undefined })
      : leaveApi[mode](leaveId, { comments: note || undefined }),
    onSuccess: done,
  })
  const download = useMutation({
    mutationFn: () => leaveApi.attachment(leaveId).then((res) => {
      const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[res.data.type] ?? 'bin'
      saveBlob(res.data, `leave-${leaveId}-document.${ext}`, res.data.type)
    }),
  })

  const name = leave?.employee ? `${leave.employee.first_name} ${leave.employee.last_name}` : ''

  const footer = leave && (mode ? (
    <>
      <Button variant="secondary" onClick={() => { setMode(null); act.reset() }}>Back</Button>
      <Button variant={mode === 'approve' ? 'success' : 'danger'} loading={act.isPending} onClick={() => act.mutate()}
        icon={mode === 'approve' ? Check : mode === 'reject' ? XCircle : Ban}>
        {mode === 'approve' ? 'Approve' : mode === 'reject' ? 'Reject' : 'Cancel leave'}
      </Button>
    </>
  ) : (data?.can_approve || data?.can_cancel) && (
    <>
      {data.can_cancel && <Button variant="ghost" icon={Ban} onClick={() => setMode('cancel')}>{leave.status === 'pending' && own ? 'Withdraw' : 'Cancel leave'}</Button>}
      {data.can_approve && <Button variant="secondary" icon={XCircle} onClick={() => setMode('reject')}>Reject</Button>}
      {data.can_approve && <Button variant="success" icon={Check} onClick={() => setMode('approve')}>Approve</Button>}
    </>
  ))

  return (
    <Modal size="lg" onClose={onClose} title="Leave request" subtitle={leave ? `#${leave.id} · applied ${dateLabel(leave.created_at)}` : undefined} footer={footer || undefined}>
      {isLoading || !leave ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div> : (
        <div className="space-y-5">
          {!own && (
            <div className="flex items-center gap-3">
              <Avatar name={name} />
              <div>
                <p className="font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-500">
                  {leave.employee?.employee_code}
                  {leave.employee?.designation?.title && ` · ${leave.employee.designation.title}`}
                  {leave.employee?.department?.name && ` · ${leave.employee.department.name}`}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Type</p>
              <LeaveTypeChip type={leave.leave_type} className="mt-1" />
              {leave.leave_type && !leave.leave_type.paid && <p className="mt-0.5 text-xs text-rose-600">Unpaid</p>}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dates</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{leaveRange(leave, { year: true })}</p>
              <p className="text-xs text-slate-500">{dayCount(leave.days)}{leave.half_day_session && ` · ${SESSION_LABELS[leave.half_day_session]}`}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
              <StatusPill status={leave.status} className="mt-1.5" />
            </div>
          </div>

          {leave.reason && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reason</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{leave.reason}</p>
            </div>
          )}

          {leave.has_attachment && (
            <Button variant="secondary" size="sm" icon={Download} loading={download.isPending} onClick={() => download.mutate()}>Supporting document</Button>
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Approval trail</p>
            <ol className="relative space-y-4 border-l border-slate-200 pl-6">
              <li className="relative">
                <span className="absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white"><Send size={12} /></span>
                <p className="text-sm font-medium text-slate-800">{leave.recorder ? `Recorded by ${leave.recorder.name}` : 'Submitted'}</p>
                <p className="text-xs text-slate-500">{new Date(leave.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </li>
              {timeline.map((step) => {
                const current = step.status === 'pending' && step.step === firstPending
                const [cls, Icon] = step.status === 'pending' && !current ? UPCOMING : (STEP_STYLE[step.status] ?? STEP_STYLE.pending)
                return (
                  <li key={step.step} className="relative">
                    <span className={cn('absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full', cls)}><Icon size={12} /></span>
                    <p className={cn('text-sm font-medium', current || step.status !== 'pending' ? 'text-slate-800' : 'text-slate-500')}>
                      {step.status !== 'pending'
                        ? `${step.status === 'approved' ? 'Approved' : 'Rejected'} by ${step.approver ?? step.waiting_for}`
                        : leave.status !== 'pending' ? `${step.waiting_for} — not needed`
                          : current ? `Waiting for ${lowerLabel(step.waiting_for)}` : `Then ${lowerLabel(step.waiting_for)}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {timeline.length > 1 && `Step ${step.step} · ${step.waiting_for}`}
                      {step.acted_at && `${timeline.length > 1 ? ' · ' : ''}${new Date(step.acted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`}
                    </p>
                    {step.comments && <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">“{step.comments}”</p>}
                  </li>
                )
              })}
              {leave.status === 'cancelled' && (
                <li className="relative">
                  <span className="absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-white"><Ban size={12} /></span>
                  <p className="text-sm font-medium text-slate-800">Cancelled{leave.canceller && ` by ${leave.canceller.name}`}</p>
                  {leave.cancelled_at && <p className="text-xs text-slate-500">{new Date(leave.cancelled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                  {leave.cancellation_reason && <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">“{leave.cancellation_reason}”</p>}
                </li>
              )}
            </ol>
          </div>

          {mode && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-4">
              <ErrorBanner error={act.error} />
              <p className="text-sm font-medium text-slate-800">
                {mode === 'approve' ? 'Approve this leave?' : mode === 'reject' ? 'Reject this leave?' : 'Cancel this leave?'}
                {mode === 'cancel' && leave.status === 'approved' && <span className="font-normal text-slate-500"> The days go back to the balance.</span>}
              </p>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={mode === 'cancel' ? 'Reason (optional)' : 'Comment for the employee (optional)'} />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
