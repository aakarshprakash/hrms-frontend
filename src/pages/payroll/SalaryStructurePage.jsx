import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, ArrowLeft, IndianRupee } from 'lucide-react'
import { salaryApi } from '@/lib/api/payroll'
import api from '@/lib/api/axios'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const schema = z.object({
  component_id: z.string().min(1, 'Select a component'),
  amount: z.coerce.number().min(0, 'Amount must be ≥ 0'),
  effective_from: z.string().min(1, 'Effective date required'),
  effective_to: z.string().optional(),
})

function fmtMoney(v) {
  return Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export default function SalaryStructurePage() {
  const { employeeId } = useParams()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState(null)

  function notify(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const { data: employee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}`).then((r) => r.data?.data ?? r.data),
  })

  const { data: components = [] } = useQuery({
    queryKey: ['salary-components'],
    queryFn: () => salaryApi.listComponents().then((r) => r.data?.data ?? []),
  })

  const { data: structures = [], isLoading } = useQuery({
    queryKey: ['salary-structures', employeeId],
    queryFn: () => salaryApi.listStructures({ employee_id: employeeId }).then((r) => r.data?.data ?? []),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  const addMutation = useMutation({
    mutationFn: (data) => salaryApi.createStructure({ ...data, employee_id: employeeId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-structures', employeeId] }); setShowForm(false); reset(); notify('Component added.') },
    onError: () => notify('Failed to add component.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => salaryApi.deleteStructure(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-structures', employeeId] }); notify('Component removed.') },
    onError: () => notify('Failed to remove.', 'error'),
  })

  const earnings = structures.filter((s) => s.component?.type === 'earning')
  const deductions = structures.filter((s) => s.component?.type === 'deduction')
  const grossPay = earnings.reduce((sum, s) => sum + Number(s.amount), 0)
  const totalDeductions = deductions.reduce((sum, s) => sum + Number(s.amount), 0)
  const netPay = grossPay - totalDeductions

  const componentById = (id) => components.find((c) => String(c.id) === String(id))

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to={`/employees/${employeeId}`}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salary Structure</h1>
          {employee && (
            <p className="text-sm text-slate-500">{employee.first_name} {employee.last_name} · {employee.employee_code}</p>
          )}
        </div>
      </div>

      {toast && (
        <div className={cn('rounded-xl px-4 py-3 text-sm font-medium',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.msg}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Gross Pay', value: grossPay, color: 'text-emerald-600' },
          { label: 'Deductions', value: totalDeductions, color: 'text-red-500' },
          { label: 'Net Pay', value: netPay, color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm text-center">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={cn('text-xl font-bold flex items-center justify-center gap-0.5', color)}>
              <IndianRupee size={15} />{fmtMoney(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Earnings */}
      <StructureSection
        title="Earnings"
        items={earnings}
        color="text-emerald-600"
        onDelete={(id) => deleteMutation.mutate(id)}
        loading={isLoading}
      />

      {/* Deductions */}
      <StructureSection
        title="Deductions"
        items={deductions}
        color="text-red-500"
        onDelete={(id) => deleteMutation.mutate(id)}
        loading={isLoading}
      />

      {/* Add component */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20">
            <Plus size={16} /> Add Component
          </button>
        ) : (
          <form onSubmit={handleSubmit((d) => addMutation.mutateAsync(d))} className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Add Component</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Component</label>
                <select {...register('component_id')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500">
                  <option value="">Select…</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
                {errors.component_id && <p className="text-xs text-red-500 mt-1">{errors.component_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount / Rate</label>
                <input type="number" step="0.01" min="0" {...register('amount')}
                  placeholder="e.g. 25000"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500" />
                {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Effective From</label>
                <input type="date" {...register('effective_from')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500" />
                {errors.effective_from && <p className="text-xs text-red-500 mt-1">{errors.effective_from.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Effective To <span className="text-slate-400">(optional)</span></label>
                <input type="date" {...register('effective_to')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {isSubmitting && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
                Add
              </button>
              <button type="button" onClick={() => { setShowForm(false); reset() }}
                className="rounded-xl border px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function StructureSection({ title, items, color, onDelete, loading }) {
  if (loading) return <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className="text-xs text-slate-400">{items.length} component{items.length !== 1 ? 's' : ''}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">No {title.toLowerCase()} components.</p>
      ) : (
        <div className="divide-y">
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{s.component?.name ?? '—'}</p>
                <p className="text-xs text-slate-400">
                  {s.component?.calculation_type === 'percentage' ? `${s.amount}%` : ''}
                  · from {s.effective_from}
                  {s.effective_to ? ` to ${s.effective_to}` : ' (ongoing)'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className={cn('text-sm font-semibold flex items-center gap-0.5', color)}>
                  {s.component?.calculation_type === 'percentage'
                    ? `${s.amount}%`
                    : <><IndianRupee size={13} />{Number(s.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</>
                  }
                </span>
                <button onClick={() => onDelete(s.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
