import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, Check, X, CalendarDays, Clock, Timer, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { approvalApi, leaveApi } from '@/lib/api/leaves'
import { attendanceApi } from '@/lib/api/attendance'
import { overtimeApi } from '@/lib/api/overtime'
import { dateLabel, timeLabel } from '@/lib/format'
import { dayCount, leaveRange, lowerLabel, num } from '@/lib/leave'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Tabs, EmptyState, Textarea, ErrorBanner, Avatar, StatusPill } from '@/components/ui/kit'
import { LeaveTypeChip } from '@/components/leave/BalanceCards'
import { LeaveDetailModal } from '@/components/leave/LeaveDetailModal'

const MODULES = {
  leave: { label: 'Leave', icon: CalendarDays, approve: leaveApi.approve, reject: leaveApi.reject },
  regularization: { label: 'Regularization', icon: Clock, approve: attendanceApi.approveRegularization, reject: attendanceApi.rejectRegularization },
  overtime: { label: 'Overtime', icon: Timer, approve: overtimeApi.approve, reject: overtimeApi.reject },
}

/**
 * Everything waiting on me: requests whose current approval step is mine
 * (as the employee's manager, HR, or an admin acting for them).
 */
export default function ApprovalsPage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => (MODULES[params.get('tab')] ? params.get('tab') : 'leave'))
  const [scope, setScope] = useState('mine')
  const [openLeave, setOpenLeave] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalApi.inbox().then((r) => r.data.data),
  })
  // "Assigned to me": the step names me. "All": also what I may step in on.
  const visible = (list = []) => (scope === 'mine' ? list.filter((i) => i.designated) : list)
  const items = visible(data?.[tab])
  const standIns = Object.keys(MODULES).reduce((n, k) => n + (data?.[k] ?? []).filter((i) => !i.designated).length, 0)

  return (
    <div className="space-y-5">
      <PageHeader icon={Inbox} title="Approvals" subtitle="Requests waiting for your decision."
        actions={(standIns > 0 || scope === 'all') && (
          <div className="flex rounded-xl bg-slate-100 p-1">
            {[['mine', 'Assigned to me'], ['all', `Everything I can act on`]].map(([key, label]) => (
              <button key={key} onClick={() => setScope(key)}
                className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium', scope === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {label}
              </button>
            ))}
          </div>
        )} />

      <Tabs value={tab} onChange={setTab} tabs={Object.entries(MODULES).map(([key, m]) => ({ key, label: m.label, count: visible(data?.[key]).length }))} />

      {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : items.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="You’re all caught up"
          description={scope === 'mine' && standIns > 0
            ? `Nothing assigned to you. ${standIns} request(s) are waiting on other approvers — switch to “Everything I can act on” to step in.`
            : `No ${MODULES[tab].label.toLowerCase()} requests are waiting for you.`} /></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => <RequestCard key={`${tab}-${item.id}`} item={item} module={tab} onDetails={tab === 'leave' ? () => setOpenLeave(item.id) : undefined} />)}
        </div>
      )}

      {openLeave && <LeaveDetailModal leaveId={openLeave} onClose={() => setOpenLeave(null)} />}
    </div>
  )
}

function RequestCard({ item, module, onDetails }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState('')
  const m = MODULES[module]

  const act = useMutation({
    mutationFn: (action) => m[action](item.id, { comments: comments || undefined }),
    onSuccess: () => {
      ['approvals', 'approvals-count', 'leaves', 'leave-calendar', 'leave-summary', 'regularizations', 'overtime'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    },
  })

  const e = item.employee

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
          <Avatar name={e?.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-semibold text-slate-900">{e?.name}</p>
              <span className="text-xs text-slate-400">{e?.employee_code}{e?.designation && ` · ${e.designation}`}{e?.branch && ` · ${e.branch}`}</span>
            </div>

            {module === 'leave' && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <LeaveTypeChip type={item.leave_type} />
                <span className="font-medium text-slate-800">{leaveRange(item, { year: true })}</span>
                <span className="text-slate-500">{dayCount(item.days)}</span>
                {item.leave_type && !item.leave_type.paid && <StatusPill tone="red" dot={false} label="Unpaid" />}
                {item.balance !== null && item.balance !== undefined && (
                  <span className={cn('text-xs', Number(item.balance) < Number(item.days) ? 'font-semibold text-rose-600' : 'text-slate-500')}>
                    Balance {num(item.balance)}
                  </span>
                )}
              </div>
            )}
            {module === 'regularization' && (
              <p className="mt-1.5 text-sm text-slate-700">
                <span className="font-medium">{dateLabel(item.date)}</span>
                <span className="text-slate-500"> · In {timeLabel(item.requested_check_in)} · Out {timeLabel(item.requested_check_out)}</span>
              </p>
            )}
            {module === 'overtime' && (
              <p className="mt-1.5 text-sm text-slate-700">
                <span className="font-medium">{dateLabel(item.date)}</span>
                <span className="text-slate-500"> · {num(item.hours)} hour(s)</span>
              </p>
            )}

            {item.reason && <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">“{item.reason}”</p>}
            {item.step && (
              <p className="mt-1.5 text-xs text-slate-400">
                {item.step.of > 1 ? `Step ${item.step.number} of ${item.step.of} · ` : ''}Waiting for {lowerLabel(item.step.waiting_for)} · submitted {dateLabel(item.created_at)}
                {!item.designated && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">you’d be stepping in</span>}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={X} disabled={act.isPending} onClick={() => act.mutate('reject')}>Reject</Button>
            <Button variant="success" size="sm" icon={Check} loading={act.isPending && act.variables === 'approve'} disabled={act.isPending} onClick={() => act.mutate('approve')}>Approve</Button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
              Add comment {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {onDetails && (
              <button onClick={onDetails} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                Details <ExternalLink size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {(expanded || act.error) && (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <ErrorBanner error={act.error} />
          {expanded && <Textarea rows={2} value={comments} onChange={(ev) => setComments(ev.target.value)} placeholder="Comment (optional) — kept with your decision and shown to the employee" />}
        </div>
      )}
    </Card>
  )
}
