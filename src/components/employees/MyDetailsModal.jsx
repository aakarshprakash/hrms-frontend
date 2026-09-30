import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import api from '@/lib/api/axios'
import { Modal, Button, Field, Input, Select, ErrorBanner } from '@/components/ui/kit'

const FIELDS = [
  'phone', 'personal_email', 'marital_status', 'blood_group', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
  'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation', 'tax_regime', 'declared_deductions',
]

/** An employee updating their own personal details (the rest stays with HR). */
export function MyDetailsModal({ employee, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((f) => [f, employee[f] ?? (f === 'tax_regime' ? 'new' : '')])))
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const save = useMutation({
    mutationFn: () => api.put('/me/profile', Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee'] })
      qc.invalidateQueries({ queryKey: ['me-home'] })
      onClose()
    },
  })

  const section = 'grid gap-3 sm:grid-cols-2'
  const heading = 'text-xs font-semibold uppercase tracking-wide text-slate-500'

  return (
    <Modal size="lg" onClose={onClose} title="Update my details"
      subtitle="Contact, address and emergency details are yours to keep current. Job, pay and ID changes go through HR."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="space-y-5">
        <ErrorBanner error={save.error} />

        <div className="space-y-3">
          <p className={heading}>Contact</p>
          <div className={section}>
            <Field label="Mobile"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="98470 12345" /></Field>
            <Field label="Personal email"><Input type="email" value={form.personal_email} onChange={(e) => set({ personal_email: e.target.value })} /></Field>
            <Field label="Marital status">
              <Select value={form.marital_status} onChange={(e) => set({ marital_status: e.target.value })}>
                <option value="">—</option>
                {['single', 'married', 'divorced', 'widowed'].map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Blood group">
              <Select value={form.blood_group} onChange={(e) => set({ blood_group: e.target.value })}>
                <option value="">—</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <p className={heading}>Address</p>
          <Field label="Address line 1"><Input value={form.address_line1} onChange={(e) => set({ address_line1: e.target.value })} /></Field>
          <Field label="Address line 2"><Input value={form.address_line2} onChange={(e) => set({ address_line2: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="City" className="sm:col-span-2"><Input value={form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field label="State"><Input value={form.state} onChange={(e) => set({ state: e.target.value })} /></Field>
            <Field label="PIN code"><Input value={form.postal_code} onChange={(e) => set({ postal_code: e.target.value })} /></Field>
          </div>
        </div>

        <div className="space-y-3">
          <p className={heading}>Emergency contact</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name"><Input value={form.emergency_contact_name} onChange={(e) => set({ emergency_contact_name: e.target.value })} /></Field>
            <Field label="Relation"><Input value={form.emergency_contact_relation} onChange={(e) => set({ emergency_contact_relation: e.target.value })} placeholder="e.g. Spouse" /></Field>
            <Field label="Phone"><Input value={form.emergency_contact_phone} onChange={(e) => set({ emergency_contact_phone: e.target.value })} /></Field>
          </div>
        </div>

        <div className="space-y-3">
          <p className={heading}>Income tax</p>
          <div className={section}>
            <Field label="Tax regime" hint="Used for TDS from the next payroll run.">
              <Select value={form.tax_regime} onChange={(e) => set({ tax_regime: e.target.value })}>
                <option value="new">New regime (default)</option>
                <option value="old">Old regime (with deductions)</option>
              </Select>
            </Field>
            {form.tax_regime === 'old' && (
              <Field label="Declared deductions (₹ per year)" hint="80C, 80D, HRA exemption… total you’ll claim.">
                <Input type="number" min="0" value={form.declared_deductions} onChange={(e) => set({ declared_deductions: e.target.value })} />
              </Field>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
