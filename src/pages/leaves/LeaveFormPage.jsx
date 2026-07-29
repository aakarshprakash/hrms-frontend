import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { leaveApi } from '@/lib/api/leaves'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const schema = z.object({
  leave_type_id: z.string().min(1, 'Leave type required'),
  start_date: z.string().min(1, 'Start date required'),
  end_date: z.string().min(1, 'End date required'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
}).refine((d) => d.end_date >= d.start_date, {
  message: 'End date must be on or after start date',
  path: ['end_date'],
})

function daysBetween(start, end) {
  if (!start || !end || end < start) return 0
  const ms = new Date(end) - new Date(start)
  return Math.floor(ms / 86400000) + 1
}

export default function LeaveFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  const startDate = watch('start_date')
  const endDate = watch('end_date')
  const leaveTypeId = watch('leave_type_id')
  const days = daysBetween(startDate, endDate)

  const activeBranch = useAuthStore((s) => s.activeBranch)
  const bid = activeBranch?.id

  const { data: types = [] } = useQuery({
    queryKey: ['leave-types', bid],
    queryFn: () => leaveApi.listTypes(bid ? { branch_id: bid } : {}).then((r) => r.data?.data ?? []),
  })

  const { data: balances = [] } = useQuery({
    queryKey: ['leave-balances', user?.employee_id],
    queryFn: () => leaveApi.listBalances({ employee_id: user?.employee_id }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  const selectedBalance = balances.find((b) => String(b.leave_type_id) === String(leaveTypeId))

  const submit = useMutation({
    mutationFn: (data) => leaveApi.submit(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] })
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
      navigate('/leaves')
    },
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Apply for Leave</h1>
        <p className="text-sm text-slate-500 mt-1">Fill in the details below and submit for approval.</p>
      </div>

      <form onSubmit={handleSubmit((d) => submit.mutateAsync(d))} className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
        {submit.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {submit.error.response?.data?.message ?? 'Submission failed. Please try again.'}
          </div>
        )}

        {/* Leave type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type</label>
          <select {...register('leave_type_id')}
            className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-blue-500">
            <option value="">Select type…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {errors.leave_type_id && <p className="text-xs text-red-500 mt-1">{errors.leave_type_id.message}</p>}

          {/* Live balance */}
          {selectedBalance && (
            <div className={cn(
              'mt-2 rounded-lg px-3 py-2 text-xs font-medium',
              selectedBalance.remaining > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            )}>
              Balance: {selectedBalance.remaining ?? 0} day(s) remaining
              {days > 0 && ` · Applying for ${days} day(s)`}
              {days > 0 && selectedBalance.remaining < days && ' · ⚠ Insufficient balance'}
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input type="date" {...register('start_date')}
              className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-blue-500" />
            {errors.start_date && <p className="text-xs text-red-500 mt-1">{errors.start_date.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <input type="date" {...register('end_date')}
              className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-blue-500" />
            {errors.end_date && <p className="text-xs text-red-500 mt-1">{errors.end_date.message}</p>}
          </div>
        </div>

        {/* Duration */}
        {days > 0 && (
          <p className="text-xs text-slate-500">Duration: <strong className="text-slate-800">{days} day(s)</strong></p>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
          <textarea {...register('reason')} rows={3}
            placeholder="Briefly describe the reason for leave…"
            className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-blue-500 resize-none" />
          {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {isSubmitting && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            Submit Application
          </button>
          <button type="button" onClick={() => navigate('/leaves')}
            className="rounded-lg border px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
