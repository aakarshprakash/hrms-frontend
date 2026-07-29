import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { overtimeApi } from '@/lib/api/overtime'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { ApprovalInbox } from '@/components/approvals/ApprovalInbox'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  hours: z.coerce.number().min(0.5, 'Minimum 0.5 hours').max(12, 'Maximum 12 hours'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
})

const STATUS_VARIANT = { pending: 'default', approved: 'active', rejected: 'terminated' }

function OtForm({ onSuccess }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })
  const user = useAuthStore((s) => s.user)

  async function onSubmit(data) {
    await overtimeApi.submit({ ...data, employee_id: user?.employee_id })
    reset()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
          <input type="date" {...register('date')}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500" />
          {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Overtime Hours</label>
          <input type="number" step="0.5" min="0.5" max="12" {...register('hours')}
            placeholder="e.g. 2.5"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500" />
          {errors.hours && <p className="text-xs text-red-500 mt-1">{errors.hours.message}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
        <textarea {...register('reason')} rows={3}
          placeholder="Describe what work was done during overtime…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-500 resize-none" />
        {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
      </div>
      <button type="submit" disabled={isSubmitting}
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 disabled:opacity-60">
        {isSubmitting && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
        Submit OT Request
      </button>
    </form>
  )
}

function renderOtMeta(item) {
  return (
    <p className="text-xs text-slate-500 mt-0.5">
      {item.date} · {item.hours}h overtime
      {item.hours && item.rate_multiplier ? ` · ${item.rate_multiplier}× rate` : ''}
    </p>
  )
}

export default function OvertimePage() {
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

  const { data: myRequests = [], isLoading: myLoading } = useQuery({
    queryKey: ['ot-requests', 'my', user?.employee_id],
    queryFn: () => overtimeApi.list({ employee_id: user?.employee_id }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  const { data: pendingRequests = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['ot-requests', 'pending'],
    queryFn: () => overtimeApi.list({ status: 'pending' }).then((r) => r.data?.data ?? []),
    enabled: isApprover,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data }) => overtimeApi.approve(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ot-requests'] }); notify('OT request approved.') },
    onError: () => notify('Approval failed.', 'error'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, data }) => overtimeApi.reject(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ot-requests'] }); notify('OT request rejected.') },
    onError: () => notify('Rejection failed.', 'error'),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Overtime Requests</h1>

      {toast && (
        <div className={cn('rounded-xl px-4 py-3 text-sm font-medium',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.msg}
        </div>
      )}

      {/* Submit form */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">New OT Request</h2>
        <OtForm onSuccess={() => { qc.invalidateQueries({ queryKey: ['ot-requests'] }); notify('OT request submitted successfully.') }} />
      </div>

      {/* Tabs */}
      {isApprover && (
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
          {['my', 'pending'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                tab === t ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
              {t === 'my' ? 'My Requests' : (
                <span className="flex items-center gap-1.5">
                  Pending Approval
                  {pendingRequests.length > 0 && (
                    <span className="rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5">{pendingRequests.length}</span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* My requests list */}
      {tab === 'my' && (
        myLoading ? <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div> : (
          myRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-slate-400">
              No overtime requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <div key={req.id} className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{req.date}</span>
                      <Badge label={req.status} variant={STATUS_VARIANT[req.status] ?? 'default'} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{req.hours}h · {req.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )
      )}

      {/* Pending approval inbox */}
      {tab === 'pending' && isApprover && (
        <ApprovalInbox
          items={pendingRequests}
          loading={pendingLoading}
          renderMeta={renderOtMeta}
          emptyText="No pending overtime requests."
          onApprove={(id, data) => approveMutation.mutateAsync({ id, data })}
          onReject={(id, data) => rejectMutation.mutateAsync({ id, data })}
        />
      )}
    </div>
  )
}
