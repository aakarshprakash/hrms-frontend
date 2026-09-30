import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Landmark, MapPin, Save } from 'lucide-react'
import { companyApi } from '@/lib/api/departments'
import { refreshSession } from '@/lib/session'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, CardHeader, Button, Field, Input, Select, ErrorBanner } from '@/components/ui/kit'

const INDUSTRIES = [
  ['automotive', 'Automotive (showrooms & service)'],
  ['healthcare', 'Healthcare (hospitals & clinics)'],
  ['finance', 'Finance (banking, NBFC, insurance)'],
  ['retail', 'Retail & distribution'],
  ['manufacturing', 'Manufacturing'],
  ['hospitality', 'Hospitality & restaurants'],
  ['it_services', 'IT & professional services'],
  ['general', 'General business'],
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const STATUTORY_FIELDS = [
  ['pf_establishment_code', 'PF establishment code', 'e.g. KRKCH0012345000'],
  ['esi_employer_code', 'ESI employer code', '17-digit code'],
  ['pan', 'Company PAN', 'AAACV1234F'],
  ['tan', 'TAN (for TDS)', 'KOCV12345A'],
  ['pt_registration', 'Professional tax registration', ''],
  ['lwf_registration', 'Labour welfare fund registration', ''],
  ['gstin', 'GSTIN', ''],
]

export default function OrganisationSettingsPage() {
  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyApi.get().then((r) => r.data?.data ?? r.data),
  })

  if (isLoading || !company) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>

  return <OrganisationForm key={company.id} company={company} />
}

function toForm(company) {
  return {
    name: company.name ?? '', legal_name: company.legal_name ?? '', industry: company.industry ?? 'general',
    email: company.email ?? '', phone: company.phone ?? '', website: company.website ?? '',
    address_line1: company.address_line1 ?? '', address_line2: company.address_line2 ?? '', city: company.city ?? '',
    state: company.state ?? '', postal_code: company.postal_code ?? '', timezone: company.timezone ?? 'Asia/Kolkata',
    fiscal_year_start_month: company.fiscal_year_start_month ?? 4,
    statutory: { ...(company.statutory ?? {}) },
  }
}

function OrganisationForm({ company }) {
  const qc = useQueryClient()
  const { can } = useRole()
  const editable = can('settings.manage')
  const [form, setForm] = useState(() => toForm(company))
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: (payload) => companyApi.update(payload),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['company'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      try { await refreshSession() } catch { /* header refresh only */ }
    },
  })

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setStat = (key, value) => setForm((f) => ({ ...f, statutory: { ...f.statutory, [key]: value.toUpperCase() } }))

  function submit(e) {
    e.preventDefault()
    const payload = { ...form, statutory: Object.fromEntries(Object.entries(form.statutory).map(([k, v]) => [k, v || null])) }
    for (const k of ['legal_name', 'email', 'phone', 'website', 'address_line1', 'address_line2', 'city', 'state', 'postal_code']) {
      if (payload[k] === '') payload[k] = null
    }
    mutation.mutate(payload)
  }

  return (
    <form onSubmit={submit}>
      <PageHeader icon={Building2} title="Organisation"
        subtitle="Your company profile and the employer registrations printed on payslips and statutory returns."
        actions={editable && <Button type="submit" icon={Save} loading={mutation.isPending}>{saved ? 'Saved' : 'Save changes'}</Button>} />

      <ErrorBanner error={mutation.error} className="mb-4" />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card padded={false} className="xl:col-span-2">
          <CardHeader icon={Building2} title="Profile" />
          <fieldset disabled={!editable} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Display name" required><Input required value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Registered (legal) name"><Input value={form.legal_name} onChange={(e) => set({ legal_name: e.target.value })} /></Field>
            <Field label="Industry" hint="Used for starter templates. Nothing is locked to an industry.">
              <Select value={form.industry} onChange={(e) => set({ industry: e.target.value })}>
                {INDUSTRIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Financial year starts in">
              <Select value={form.fiscal_year_start_month} onChange={(e) => set({ fiscal_year_start_month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Contact email"><Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field label="Contact phone"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            <Field label="Website"><Input value={form.website} placeholder="https://" onChange={(e) => set({ website: e.target.value })} /></Field>
            <Field label="Timezone"><Input value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} /></Field>
          </fieldset>
        </Card>

        <Card padded={false}>
          <CardHeader icon={MapPin} title="Registered address" />
          <fieldset disabled={!editable} className="grid gap-4 p-5">
            <Field label="Address line 1"><Input value={form.address_line1} onChange={(e) => set({ address_line1: e.target.value })} /></Field>
            <Field label="Address line 2"><Input value={form.address_line2} onChange={(e) => set({ address_line2: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City"><Input value={form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="PIN code"><Input value={form.postal_code} onChange={(e) => set({ postal_code: e.target.value })} /></Field>
            </div>
            <Field label="State" hint="Drives the professional tax slabs used in payroll."><Input value={form.state} onChange={(e) => set({ state: e.target.value })} /></Field>
          </fieldset>
        </Card>

        <Card padded={false} className="xl:col-span-3">
          <CardHeader icon={Landmark} title="Statutory registrations" subtitle="Printed on payslips, PF ECR, ESI and TDS returns." />
          <fieldset disabled={!editable} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {STATUTORY_FIELDS.map(([key, label, placeholder]) => (
              <Field key={key} label={label}>
                <Input value={form.statutory[key] ?? ''} placeholder={placeholder} className="font-mono uppercase placeholder:normal-case placeholder:font-sans"
                  onChange={(e) => setStat(key, e.target.value)} />
              </Field>
            ))}
          </fieldset>
        </Card>
      </div>
    </form>
  )
}
