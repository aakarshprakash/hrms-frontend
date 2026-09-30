import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { payrollApi, salaryApi } from '@/lib/api/payroll'
import { employeeApi } from '@/lib/api/employees'
import { money } from '@/lib/format'
import { Card, CardHeader, Button, IconButton, Field, Input, Select, Toggle, ErrorBanner, EmptyState, Table, Modal } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

/**
 * One-off earnings (incentives, arrears) and deductions (advance recovery)
 * for a single payroll run. Editing a processed run sends it back to draft
 * so it's re-processed before finalizing.
 */
export default function AdjustmentsPanel({ run, editable }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null) // null | {} (new) | adjustment

  const { data: adjustments = [] } = useQuery({
    queryKey: ['payroll-adjustments', run.id],
    queryFn: () => payrollApi.listAdjustments(run.id).then((r) => r.data?.data ?? []),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payroll-adjustments', run.id] })
    qc.invalidateQueries({ queryKey: ['payroll-run', String(run.id)] })
    qc.invalidateQueries({ queryKey: ['payroll-preview', String(run.id)] })
  }

  const remove = useMutation({ mutationFn: (id) => payrollApi.deleteAdjustment(id), onSuccess: invalidate })

  const totals = useMemo(() => adjustments.reduce((acc, a) => {
    acc[a.component?.type === 'deduction' ? 'deductions' : 'earnings'] += Number(a.amount)
    return acc
  }, { earnings: 0, deductions: 0 }), [adjustments])

  return (
    <Card padded={false}>
      <CardHeader title="Adjustments for this run" icon={TrendingUp}
        subtitle={`Incentives ${money(totals.earnings)} · One-off deductions ${money(totals.deductions)}`}
        actions={editable && <Button size="sm" icon={Plus} onClick={() => setEditing({})}>Add</Button>} />
      <ErrorBanner error={remove.error} className="m-4" />
      <Table
        rows={adjustments}
        empty={<EmptyState icon={TrendingUp} title="No adjustments" description="Add sales incentives, arrears or recoveries that apply to this month only." />}
        columns={[
          { key: 'employee', label: 'Employee', render: (a) => <div><p className="font-medium text-slate-800">{a.employee?.first_name} {a.employee?.last_name}</p><p className="text-xs text-slate-400">{a.employee?.employee_code}</p></div> },
          { key: 'component', label: 'Component', render: (a) => (
            <span className={cn('inline-flex items-center gap-1 text-sm', a.component?.type === 'deduction' ? 'text-rose-700' : 'text-emerald-700')}>
              {a.component?.type === 'deduction' ? <TrendingDown size={13} /> : <TrendingUp size={13} />} {a.component?.name}
            </span>
          ) },
          { key: 'note', label: 'Note', render: (a) => <span className="text-xs text-slate-500">{a.note ?? '—'}</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (a) => <span className="font-medium">{money(a.amount)}</span> },
          ...(editable ? [{ key: 'actions', label: '', align: 'right', render: (a) => (
            <div className="flex justify-end">
              <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(a)} />
              <IconButton icon={Trash2} label="Remove" tone="danger" onClick={() => remove.mutate(a.id)} />
            </div>
          ) }] : []),
        ]}
      />
      {editing && <AdjustmentModal run={run} adjustment={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={invalidate} />}
    </Card>
  )
}

function AdjustmentModal({ run, adjustment, onClose, onSaved }) {
  const isEdit = !!adjustment
  const [type, setType] = useState(adjustment?.component?.type ?? 'earning')
  const [componentId, setComponentId] = useState(adjustment ? String(adjustment.component_id) : '')
  const [amount, setAmount] = useState(adjustment ? String(adjustment.amount) : '')
  const [note, setNote] = useState(adjustment?.note ?? '')
  const [applyToAll, setApplyToAll] = useState(false)
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')

  const { data: components = [] } = useQuery({
    queryKey: ['salary-components', run.branch_id],
    queryFn: () => salaryApi.listComponents({ branch_id: run.branch_id, active_only: 1 }).then((r) => r.data?.data ?? []),
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'payroll-picker', run.branch_id],
    queryFn: () => employeeApi.list({ branch_id: run.branch_id, status: 'active', per_page: 200 }).then((r) => r.data?.data ?? []),
    enabled: !isEdit,
  })

  const save = useMutation({
    mutationFn: () => {
      const payload = { component_id: Number(componentId), amount: Number(amount), note: note || undefined }
      if (isEdit) return payrollApi.updateAdjustment(adjustment.id, payload)
      return payrollApi.bulkCreateAdjustment(run.id, { ...payload, apply_to_all: applyToAll, employee_ids: applyToAll ? undefined : selected })
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  const q = search.trim().toLowerCase()
  const visible = q ? employees.filter((e) => `${e.first_name} ${e.last_name} ${e.employee_code}`.toLowerCase().includes(q)) : employees
  const canSave = componentId && Number(amount) > 0 && (isEdit || applyToAll || selected.length > 0)

  return (
    <Modal title={isEdit ? 'Edit adjustment' : 'Add adjustment'} subtitle="Applies to this payroll run only." onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>{isEdit ? 'Save' : 'Add adjustment'}</Button>
      </>}>
      <div className="space-y-4">
        <ErrorBanner error={save.error} />
        {!isEdit && (
          <div className="grid grid-cols-2 gap-2">
            {[['earning', 'Incentive / allowance', TrendingUp], ['deduction', 'Deduction / recovery', TrendingDown]].map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => { setType(key); setComponentId('') }}
                className={cn('flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium',
                  type === key ? (key === 'earning' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-rose-500 bg-rose-50 text-rose-700') : 'border-slate-200 text-slate-600')}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Component" required>
            <Select value={componentId} onChange={(e) => setComponentId(e.target.value)}>
              <option value="">Select…</option>
              {components.filter((c) => c.type === type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Amount (₹)" required><Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Note" className="sm:col-span-2"><Input value={note} placeholder="e.g. 9 vehicles delivered" onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        {!isEdit && (
          <div className="space-y-2">
            <Toggle checked={applyToAll} onChange={setApplyToAll} label="Everyone in this branch" description="e.g. a festival bonus" />
            {!applyToAll && (
              <div className="rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                  <Search size={14} className="text-slate-400" />
                  <input className="w-full text-sm outline-none" placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <span className="whitespace-nowrap text-xs text-slate-400">{selected.length} selected</span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {visible.map((e) => (
                    <label key={e.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={selected.includes(e.id)}
                        onChange={() => setSelected((s) => (s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id]))} />
                      {e.first_name} {e.last_name} <span className="text-xs text-slate-400">{e.employee_code}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
