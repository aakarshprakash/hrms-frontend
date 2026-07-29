import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { shiftApi } from '@/lib/api/shifts'
import api from '@/lib/api/axios'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const schema = z.object({
  with_employee_id: z.string().min(1, 'Select an employee to swap with'),
  my_date: z.string().min(1, 'Your shift date is required'),
  their_date: z.string().min(1, 'Their shift date is required'),
  reason: z.string().optional(),
})

const STATUS_VARIANT = { pending: 'default', approved: 'active', rejected: 'terminated' }

function SwapForm({ employees, onSuccess }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })
  async function onSubmit(data) {
    await shiftApi.requestSwap(data)
    reset()
    onSuccess?.()
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Swap With</label>
          <select {...register('with_employee_id')}
            className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-blue-500">
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
            ))}
          </select>
          {errors.with_employee_id && <p className="text-xs text-red-500 mt-1">{errors.with_employee_id.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">My Shift Date</label>
          <input type="date" {...register('my_date')}
            className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-blue-500" />
          {errors.my_date && <p className="text-xs text-red-500 mt-1">{errors.my_date.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Their Shift Date</label>
          <input type="date" {...register('their_date')}
            className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:border-blue-500" />
          {errors.their_date && <p className="text-xs text-red-500 mt-1">{errors.their_date.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reason <span className="text-slate-400">(optional)</span></label>
          <input type="text" {...register('reason')} placeholder="Optional reason…"
            className="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:border-blue-500" />
        </div>
      </div>
      <button type="submit" disabled={isSubmitting}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {isSubmitting && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
        Submit Swap Request
      </button>
    </form>
  )
}

export default function ShiftSwapPage() {
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

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees', { params: { per_page: 200 } }).then((r) => r.data?.data ?? []).catch(() => []),
  })

  const { data: mySwaps = [], isLoading: myLoading } = useQuery({
    queryKey: ['swaps', 'my'],
    queryFn: () => shiftApi.listSwaps({ employee_id: user?.employee_id }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  const { data: pendingSwaps = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['swaps', 'pending'],
    queryFn: () => shiftApi.listSwaps({ status: 'pending' }).then((r) => r.data?.data ?? []),
    enabled: isApprover,
  })

  const approveMutation = useMutation({
    mutationFn: (id) => shiftApi.approveSwap(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }); notify('Swap approved.') },
  })

  const rejectMutation = useMutation({
    mutationFn: (id) => shiftApi.rejectSwap(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }); notify('Swap rejected.') },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Shift Swap Requests</h1>

      {toast && (
        <div className={cn('rounded-lg px-4 py-3 text-sm font-medium',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.msg}
        </div>
      )}

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Request a Shift Swap</h2>
        <SwapForm employees={employees} onSuccess={() => { qc.invalidateQueries({ queryKey: ['swaps'] }); notify('Swap request submitted.') }} />
      </div>

      {isApprover && (
        <div className="flex gap-1 p-1 rounded-lg bg-slate-100 w-fit">
          {['my', 'pending'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                tab === t ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
              {t === 'my' ? 'My Requests' : 'Pending Approval'}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {(tab === 'my' ? (myLoading ? null : mySwaps) : (pendingLoading ? null : pendingSwaps))?.map((swap) => (
          <div key={swap.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {swap.employee?.first_name} {swap.employee?.last_name}
                    {' ↔ '}
                    {swap.with_employee?.first_name} {swap.with_employee?.last_name}
                  </span>
                  <Badge label={swap.status} variant={STATUS_VARIANT[swap.status] ?? 'default'} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {swap.my_date} ↔ {swap.their_date}
                </p>
                {swap.reason && <p className="text-xs text-slate-400 mt-0.5">{swap.reason}</p>}
              </div>
              {tab === 'pending' && isApprover && swap.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => approveMutation.mutate(swap.id)}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                    Approve
                  </button>
                  <button onClick={() => rejectMutation.mutate(swap.id)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {(tab === 'my' ? myLoading : pendingLoading) && (
          <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
        )}
        {!myLoading && !pendingLoading && (tab === 'my' ? mySwaps : pendingSwaps)?.length === 0 && (
          <div className="rounded-xl border border-dashed py-12 text-center text-sm text-slate-400">No swap requests found.</div>
        )}
      </div>
    </div>
  )
}
