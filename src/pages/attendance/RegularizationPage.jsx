import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { attendanceApi } from '@/lib/api/attendance'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { ApprovalInbox } from '@/components/approvals/ApprovalInbox'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  requested_check_in: z.string().min(1, 'Check-in time required'),
  requested_check_out: z.string().optional(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
})

function RegularizationForm({ onSuccess }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data) {
    await attendanceApi.submitRegularization(data)
    reset()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input type="date" {...register('date')}
            className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-blue-500" />
          {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Check-In Time</label>
          <input type="time" {...register('requested_check_in')}
            className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-blue-500" />
          {errors.requested_check_in && <p className="text-xs text-red-500 mt-1">{errors.requested_check_in.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Check-Out Time <span className="text-slate-400">(optional)</span></label>
          <input type="time" {...register('requested_check_out')}
            className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
        <textarea {...register('reason')} rows={3}
          placeholder="Explain why this regularization is needed…"
          className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-blue-500 resize-none" />
        {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
      </div>
      <button type="submit" disabled={isSubmitting}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {isSubmitting && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
        Submit Request
      </button>
    </form>
  )
}

function renderRegMeta(item) {
  return (
    <p className="text-xs text-slate-500 mt-0.5">
      {item.date} · In: {item.requested_check_in ?? '—'} → Out: {item.requested_check_out ?? '—'}
    </p>
  )
}

export default function RegularizationPage() {
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

  const { data: myRegs, isLoading: myLoading } = useQuery({
    queryKey: ['regularizations', 'my'],
    queryFn: () => attendanceApi.listRegularizations({ employee_id: user?.employee_id }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  const { data: pendingRegs, isLoading: pendingLoading } = useQuery({
    queryKey: ['regularizations', 'pending'],
    queryFn: () => attendanceApi.listRegularizations({ status: 'pending' }).then((r) => r.data?.data ?? []),
    enabled: isApprover,
  })

  const approve = useMutation({
    mutationFn: ({ id, data }) => attendanceApi.approveRegularization(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regularizations'] }); notify('Regularization approved.') },
    onError: () => notify('Failed to approve.', 'error'),
  })

  const reject = useMutation({
    mutationFn: ({ id, data }) => attendanceApi.rejectRegularization(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regularizations'] }); notify('Regularization rejected.') },
    onError: () => notify('Failed to reject.', 'error'),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Attendance Regularization</h1>

      {toast && (
        <div className={cn('rounded-lg px-4 py-3 text-sm font-medium',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.msg}
        </div>
      )}

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">New Regularization Request</h2>
        <RegularizationForm onSuccess={() => { qc.invalidateQueries({ queryKey: ['regularizations'] }); notify('Request submitted successfully.') }} />
      </div>

      {isApprover && (
        <div className="flex gap-1 p-1 rounded-lg bg-slate-100 w-fit">
          {['my', 'pending'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                tab === t ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
              {t === 'my' ? 'My Requests' : 'Pending Approval'}
            </button>
          ))}
        </div>
      )}

      {tab === 'my' && (
        <ApprovalInbox
          items={myRegs ?? []}
          loading={myLoading}
          renderMeta={renderRegMeta}
          emptyText="No regularization requests yet."
          showApproverActions={false}
        />
      )}

      {tab === 'pending' && isApprover && (
        <ApprovalInbox
          items={pendingRegs ?? []}
          loading={pendingLoading}
          renderMeta={renderRegMeta}
          emptyText="No pending regularizations."
          onApprove={(id, data) => approve.mutateAsync({ id, data })}
          onReject={(id, data) => reject.mutateAsync({ id, data })}
        />
      )}
    </div>
  )
}
