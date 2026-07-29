import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Calendar } from 'lucide-react'
import { leaveApi } from '@/lib/api/leaves'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { ApprovalInbox } from '@/components/approvals/ApprovalInbox'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const STATUS_VARIANT = {
  pending: 'default',
  approved: 'active',
  rejected: 'terminated',
  cancelled: 'inactive',
}

function renderLeaveMeta(item) {
  return (
    <p className="text-xs text-slate-500 mt-0.5">
      {item.leave_type?.name ?? 'Leave'} · {item.start_date} → {item.end_date}
      {item.days ? ` · ${item.days} day(s)` : ''}
    </p>
  )
}

function BalanceSummary() {
  const user = useAuthStore((s) => s.user)
  const { data: balances = [], isLoading } = useQuery({
    queryKey: ['leave-balances', user?.employee_id],
    queryFn: () => leaveApi.listBalances({ employee_id: user?.employee_id }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  if (isLoading) return <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>
  if (!balances.length) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {balances.map((b) => (
        <div key={b.id} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 truncate">{b.leave_type?.name}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{b.remaining ?? 0}</p>
          <p className="text-xs text-slate-400">of {b.allocated ?? 0} days</p>
        </div>
      ))}
    </div>
  )
}

export default function LeavePage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { hasRole } = useRole()
  const isApprover = hasRole('hr') || hasRole('manager') || hasRole('branch_admin') || hasRole('super_admin')
  const [tab, setTab] = useState('my')
  const [toast, setToast] = useState(null)

  function notify(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const { data: myLeaves = [], isLoading: myLoading } = useQuery({
    queryKey: ['leaves', 'my'],
    queryFn: () => leaveApi.list({ employee_id: user?.employee_id }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  const { data: pendingLeaves = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['leaves', 'pending'],
    queryFn: () => leaveApi.list({ status: 'pending' }).then((r) => r.data?.data ?? []),
    enabled: isApprover,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data }) => leaveApi.approve(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); notify('Leave approved.') },
    onError: () => notify('Approval failed.', 'error'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }) => leaveApi.reject(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); notify('Leave rejected.') },
    onError: () => notify('Rejection failed.', 'error'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => leaveApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); notify('Leave cancelled.') },
    onError: () => notify('Cancel failed.', 'error'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
        <Link to="/leaves/apply"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus size={16} /> Apply for Leave
        </Link>
      </div>

      {toast && (
        <div className={cn('rounded-lg px-4 py-3 text-sm font-medium',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.msg}
        </div>
      )}

      {/* Leave balance cards */}
      <BalanceSummary />

      {/* Tabs */}
      {isApprover && (
        <div className="flex gap-1 p-1 rounded-lg bg-slate-100 w-fit">
          {['my', 'pending'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                tab === t ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
              {t === 'my' ? 'My Leaves' : 'Pending Approval'}
              {t === 'pending' && pendingLeaves.length > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5">{pendingLeaves.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {tab === 'my' && (
        <div>
          {myLoading ? <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div> : (
            myLeaves.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center text-sm text-slate-400">
                No leave requests yet. <Link to="/leaves/apply" className="text-blue-600 hover:underline">Apply now.</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myLeaves.map((leave) => (
                  <div key={leave.id} className="rounded-xl border bg-white p-4 shadow-sm flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{leave.leave_type?.name}</span>
                        <Badge label={leave.status} variant={STATUS_VARIANT[leave.status] ?? 'default'} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        <Calendar size={11} className="inline mr-1" />
                        {leave.start_date} → {leave.end_date}
                        {leave.days ? ` · ${leave.days} day(s)` : ''}
                      </p>
                      {leave.reason && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{leave.reason}</p>}
                    </div>
                    {leave.status === 'pending' && (
                      <button onClick={() => cancelMutation.mutate(leave.id)}
                        className="shrink-0 text-xs text-red-500 hover:underline">
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {tab === 'pending' && isApprover && (
        <ApprovalInbox
          items={pendingLeaves}
          loading={pendingLoading}
          renderMeta={renderLeaveMeta}
          emptyText="No pending leave requests."
          onApprove={(id, data) => approveMutation.mutateAsync({ id, data })}
          onReject={(id, data) => rejectMutation.mutateAsync({ id, data })}
        />
      )}
    </div>
  )
}
