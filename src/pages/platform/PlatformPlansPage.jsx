import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layers, Pencil, Save } from 'lucide-react'
import { billingApi, FEATURE_LABELS } from '@/lib/api/billing'
import { money } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Modal, Field, Input, Toggle, StatusPill, ErrorBanner } from '@/components/ui/kit'

/** The plan catalogue: prices, modules and quotas (platform operator). */
export default function PlatformPlansPage() {
  const [editing, setEditing] = useState(null)
  const { data, isLoading } = useQuery({ queryKey: ['platform-plans'], queryFn: () => billingApi.plans().then((r) => r.data) })

  return (
    <div className="space-y-5">
      <PageHeader icon={Layers} title="Plans" subtitle="Changes apply to every organisation on the plan from their next request; prices from the next invoice." />
      {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.data.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-slate-900">{p.name}</p>
                  <p className="font-mono text-[11px] text-slate-400">{p.code}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!p.is_public && <StatusPill tone="slate" label="Private" dot={false} />}
                  {!p.is_active && <StatusPill tone="red" label="Retired" dot={false} />}
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">{money(p.base_price)}<span className="text-sm font-medium text-slate-400">/mo</span></p>
              <p className="text-xs text-slate-500">incl. {p.included_employees} employees, then {money(p.per_employee_price)} each</p>
              <p className="mt-3 flex-1 text-xs text-slate-500">{p.features.length} modules · {p.limits?.branches ?? '∞'} branch{p.limits?.branches === 1 ? '' : 'es'} · {p.limits?.employees ?? '∞'} employees</p>
              <Button className="mt-4" variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(p)}>Edit</Button>
            </Card>
          ))}
        </div>
      )}
      {editing && <PlanModal plan={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PlanModal({ plan, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(() => ({
    name: plan.name, description: plan.description ?? '', base_price: plan.base_price, per_employee_price: plan.per_employee_price,
    included_employees: plan.included_employees, features: plan.features, is_public: plan.is_public, is_active: plan.is_active,
    branches: plan.limits?.branches ?? '', employees: plan.limits?.employees ?? '',
  }))
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const save = useMutation({
    mutationFn: () => billingApi.updatePlan(plan.id, {
      name: form.name, description: form.description, base_price: Number(form.base_price), per_employee_price: Number(form.per_employee_price),
      included_employees: Number(form.included_employees), features: form.features, is_public: form.is_public, is_active: form.is_active,
      limits: { branches: form.branches === '' ? null : Number(form.branches), employees: form.employees === '' ? null : Number(form.employees) },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-plans'] }); onClose() },
  })

  return (
    <Modal size="lg" title={`Edit ${plan.name}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save plan</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={save.error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => set({ description: e.target.value })} /></Field>
          <Field label="Base price / month (₹)"><Input type="number" min="0" value={form.base_price} onChange={(e) => set({ base_price: e.target.value })} /></Field>
          <Field label="Included employees"><Input type="number" min="0" value={form.included_employees} onChange={(e) => set({ included_employees: e.target.value })} /></Field>
          <Field label="Per extra employee / month (₹)"><Input type="number" min="0" value={form.per_employee_price} onChange={(e) => set({ per_employee_price: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max branches" hint="Blank = no limit"><Input type="number" min="1" value={form.branches} onChange={(e) => set({ branches: e.target.value })} /></Field>
            <Field label="Max employees" hint="Blank = no limit"><Input type="number" min="1" value={form.employees} onChange={(e) => set({ employees: e.target.value })} /></Field>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Modules</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" disabled={key === 'core'} checked={form.features.includes(key)} className="rounded border-slate-300"
                  onChange={(e) => set({ features: e.target.checked ? [...form.features, key] : form.features.filter((f) => f !== key) })} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-6">
          <Toggle checked={form.is_public} onChange={(v) => set({ is_public: v })} label="Offered to customers" />
          <Toggle checked={form.is_active} onChange={(v) => set({ is_active: v })} label="Active" />
        </div>
      </div>
    </Modal>
  )
}
