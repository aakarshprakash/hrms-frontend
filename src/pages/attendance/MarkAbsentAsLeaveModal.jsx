import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { leaveApi } from '@/lib/api/leaves'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const schema = z.object({
  leave_type_id: z.string().min(1, 'Leave type required'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
})

export default function MarkAbsentAsLeaveModal({ record, onClose, onSuccess }) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  const leaveTypeId = watch('leave_type_id')

  const { data: types = [] } = useQuery({
    queryKey: ['leave-types', record.employee?.branch_id],
    queryFn: () => leaveApi.listTypes(record.employee?.branch_id ? { branch_id: record.employee.branch_id } : {}).then((r) => r.data?.data ?? []),
  })

  const { data: balances = [] } = useQuery({
    queryKey: ['leave-balances', user?.employee_id],
    queryFn: () => leaveApi.listBalances({ employee_id: user?.employee_id }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  const selectedBalance = balances.find((b) => String(b.leave_type_id) === String(leaveTypeId))

  const submit = useMutation({
    mutationFn: (data) => leaveApi.submit({
      ...data,
      source_attendance_id: record.id,
      start_date: record.date,
      end_date: record.date,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] })
      qc.invalidateQueries({ queryKey: ['leave-balances'] })
      onSuccess?.()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Mark as Leave</h2>
            <p className="text-xs text-slate-400 mt-0.5">{record.date?.slice(0, 10)} · currently marked Absent</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit((d) => submit.mutateAsync(d))} className="space-y-4 p-5">
          {submit.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {submit.error.response?.data?.message ?? 'Submission failed. Please try again.'}
            </div>
          )}

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

            {selectedBalance && (
              <div className={cn(
                'mt-2 rounded-lg px-3 py-2 text-xs font-medium',
                Number(selectedBalance.balance) >= 1 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              )}>
                Balance: {selectedBalance.balance} day(s) remaining
                {Number(selectedBalance.balance) < 1 && ' · ⚠ Insufficient balance for 1 day'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <textarea {...register('reason')} rows={3}
              placeholder="Explain why this day should be covered by leave…"
              className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-blue-500 resize-none" />
            {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {isSubmitting && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
              Submit Request
            </button>
            <button type="button" onClick={onClose}
              className="rounded-lg border px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
