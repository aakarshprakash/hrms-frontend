import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, IndianRupee, Wand2, History } from 'lucide-react'
import { salaryApi } from '@/lib/api/payroll'
import api from '@/lib/api/axios'
import { useRole } from '@/hooks/useRole'
import { money, dateLabel } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, CardHeader, Button, IconButton, Modal, Field, Input, Select, StatCard, ErrorBanner, EmptyState } from '@/components/ui/kit'

const today = new Date().toISOString().slice(0, 10)

/** Monthly amount of a line: fixed, % of basic, or % of fixed earnings. */
function monthlyOf(line, basic, grossBase) {
  const c = line.component
  if (c?.calculation_type !== 'percentage') return Number(line.amount)
  return ((c.percentage_of === 'gross' ? grossBase : basic) * Number(line.amount)) / 100
}

export default function SalaryStructurePage() {
  const { employeeId } = useParams()
  const qc = useQueryClient()
  const { can } = useRole()
  const editable = can('payroll.manage')
  const [adding, setAdding] = useState(false)
  const [restructuring, setRestructuring] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const { data: employee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}`).then((r) => r.data?.data ?? r.data),
  })
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['salary-structures', employeeId],
    queryFn: () => salaryApi.listStructures({ employee_id: employeeId }).then((r) => r.data?.data ?? []),
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['salary-structures', employeeId] })
  const remove = useMutation({ mutationFn: (id) => salaryApi.deleteStructure(id), onSuccess: invalidate })

  const { current, history, summary } = useMemo(() => {
    const isCurrent = (l) => l.effective_from.slice(0, 10) <= today && (!l.effective_to || l.effective_to.slice(0, 10) >= today)
    const cur = lines.filter(isCurrent)
    const upcoming = lines.filter((l) => l.effective_from.slice(0, 10) > today)
    const past = lines.filter((l) => l.effective_to && l.effective_to.slice(0, 10) < today)
    const earnings = cur.filter((l) => l.component?.type === 'earning')
    const basicLine = earnings.find((l) => l.component?.is_basic && l.component?.calculation_type === 'fixed')
      ?? earnings.find((l) => l.component?.calculation_type === 'fixed')
    const basic = basicLine ? Number(basicLine.amount) : 0
    const grossBase = earnings.filter((l) => !(l.component?.calculation_type === 'percentage' && l.component?.percentage_of === 'gross'))
      .reduce((s, l) => s + monthlyOf(l, basic, 0), 0)
    const withMonthly = cur.map((l) => ({ ...l, monthly: monthlyOf(l, basic, grossBase) }))
    const gross = withMonthly.filter((l) => l.component?.type === 'earning').reduce((s, l) => s + l.monthly, 0)
    const deductions = withMonthly.filter((l) => l.component?.type === 'deduction').reduce((s, l) => s + l.monthly, 0)
    return { current: [...withMonthly, ...upcoming.map((l) => ({ ...l, upcoming: true, monthly: null }))], history: past, summary: { gross, deductions, basic } }
  }, [lines])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to={`/employees/${employeeId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Employee profile</Link>
      <PageHeader icon={IndianRupee} title="Salary structure"
        subtitle={employee ? `${employee.first_name} ${employee.last_name} · ${employee.employee_code} · ${employee.branch?.name ?? ''}` : ' '}
        actions={editable && <>
          <Button variant="secondary" icon={Wand2} onClick={() => setRestructuring(true)}>Set from monthly gross</Button>
          <Button icon={Plus} onClick={() => setAdding(true)}>Add line</Button>
        </>} />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Monthly gross" value={money(summary.gross)} tone="green" hint={`Annual ${money(summary.gross * 12)}`} />
        <StatCard label="Basic" value={money(summary.basic)} tone="blue" />
        <StatCard label="Fixed deductions" value={money(summary.deductions)} tone="red" hint="Statutory deductions are computed in payroll" />
      </div>

      {remove.error && <ErrorBanner error={remove.error} />}

      {isLoading ? <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div> : (
        ['earning', 'deduction'].map((type) => {
          const rows = current.filter((l) => l.component?.type === type)
          return (
            <Card key={type} padded={false}>
              <CardHeader title={type === 'earning' ? 'Earnings' : 'Deductions'} subtitle={`${rows.length} line(s) in effect`} />
              {rows.length === 0 ? <EmptyState title={`No ${type}s`} /> : (
                <div className="divide-y divide-slate-100">
                  {rows.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{l.component?.name}
                          {l.upcoming && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">from {dateLabel(l.effective_from)}</span>}</p>
                        <p className="text-xs text-slate-400">
                          {l.component?.calculation_type === 'percentage' ? `${Number(l.amount)}% of ${l.component?.percentage_of === 'gross' ? 'gross' : 'basic'}` : 'Fixed'}
                          {' · since '}{dateLabel(l.effective_from)}{l.effective_to ? ` until ${dateLabel(l.effective_to)}` : ''}
                        </p>
                      </div>
                      <span className={type === 'earning' ? 'text-sm font-semibold text-emerald-700' : 'text-sm font-semibold text-rose-700'}>
                        {l.monthly !== null ? money(l.monthly) : (l.component?.calculation_type === 'percentage' ? `${Number(l.amount)}%` : money(l.amount))}
                      </span>
                      {editable && <IconButton icon={Trash2} label="Remove" tone="danger" onClick={() => remove.mutate(l.id)} />}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })
      )}

      {history.length > 0 && (
        <Card padded={false}>
          <button className="flex w-full items-center justify-between px-5 py-3 text-left" onClick={() => setShowHistory((v) => !v)}>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><History size={15} /> Salary history ({history.length})</span>
            <span className="text-xs text-blue-600">{showHistory ? 'Hide' : 'Show'}</span>
          </button>
          {showHistory && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {history.map((l) => (
                <div key={l.id} className="flex justify-between px-5 py-2 text-sm text-slate-500">
                  <span>{l.component?.name} · {dateLabel(l.effective_from)} – {dateLabel(l.effective_to)}</span>
                  <span>{l.component?.calculation_type === 'percentage' ? `${Number(l.amount)}%` : money(l.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {adding && employee && <AddLineModal employee={employee} onClose={() => setAdding(false)} onSaved={invalidate} />}
      {restructuring && employee && <FromGrossModal employee={employee} currentGross={summary.gross} onClose={() => setRestructuring(false)} onSaved={invalidate} />}
    </div>
  )
}

function AddLineModal({ employee, onClose, onSaved }) {
  const [form, setForm] = useState({ component_id: '', amount: '', effective_from: today, effective_to: '' })
  const { data: components = [] } = useQuery({
    queryKey: ['salary-components', employee.branch_id, 'active'],
    queryFn: () => salaryApi.listComponents({ branch_id: employee.branch_id, active_only: 1 }).then((r) => r.data?.data ?? []),
  })
  const component = components.find((c) => String(c.id) === String(form.component_id))
  const save = useMutation({
    mutationFn: () => salaryApi.createStructure({ ...form, employee_id: employee.id, effective_to: form.effective_to || null }),
    onSuccess: () => { onSaved(); onClose() },
  })
  return (
    <Modal title="Add salary line" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!form.component_id || form.amount === ''} onClick={() => save.mutate()}>Add</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <ErrorBanner error={save.error} className="sm:col-span-2" />
        <Field label="Component" required className="sm:col-span-2">
          <Select value={form.component_id} onChange={(e) => setForm({ ...form, component_id: e.target.value })}>
            <option value="">Select…</option>
            {['earning', 'deduction'].map((t) => (
              <optgroup key={t} label={t === 'earning' ? 'Earnings' : 'Deductions'}>
                {components.filter((c) => c.type === t).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label={component?.calculation_type === 'percentage' ? `Percentage of ${component.percentage_of === 'gross' ? 'gross' : 'basic'}` : 'Monthly amount (₹)'} required>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <div />
        <Field label="Effective from" required><Input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} /></Field>
        <Field label="Effective to" hint="Leave blank if ongoing"><Input type="date" value={form.effective_to} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

function FromGrossModal({ employee, currentGross, onClose, onSaved }) {
  const [form, setForm] = useState({ monthly_gross: currentGross ? Math.round(currentGross) : '', effective_from: today, basic_percent: 50, hra_percent: 40, conveyance: 1600 })
  const gross = Number(form.monthly_gross) || 0
  const basic = Math.round((gross * form.basic_percent) / 100 / 100) * 100
  const hra = (basic * form.hra_percent) / 100
  const conveyance = Math.min(Number(form.conveyance) || 0, Math.max(0, gross - basic - hra))
  const special = gross - basic - hra - conveyance

  const save = useMutation({
    mutationFn: () => api.post(`/employees/${employee.id}/salary/from-gross`, form),
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <Modal title="Set salary from monthly gross" subtitle="Current lines end the day before the effective date; history is kept." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!gross || special < 0} onClick={() => save.mutate()}>Apply</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monthly gross (₹)" required><Input type="number" value={form.monthly_gross} onChange={(e) => setForm({ ...form, monthly_gross: e.target.value })} /></Field>
          <Field label="Effective from" required><Input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} /></Field>
          <Field label="Basic (% of gross)"><Input type="number" value={form.basic_percent} onChange={(e) => setForm({ ...form, basic_percent: Number(e.target.value) })} /></Field>
          <Field label="HRA (% of basic)"><Input type="number" value={form.hra_percent} onChange={(e) => setForm({ ...form, hra_percent: Number(e.target.value) })} /></Field>
          <Field label="Conveyance (₹)"><Input type="number" value={form.conveyance} onChange={(e) => setForm({ ...form, conveyance: Number(e.target.value) })} /></Field>
        </div>
        <div className="grid grid-cols-4 gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm">
          {[['Basic', basic], ['HRA', hra], ['Conveyance', conveyance], ['Special', special]].map(([label, v]) => (
            <div key={label}><p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p><p className={v < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-slate-800'}>{money(v)}</p></div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
