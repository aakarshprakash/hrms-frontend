import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Save, Send, CheckCircle2, Info } from 'lucide-react'
import api from '@/lib/api/axios'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, CardHeader, Button, Field, Input, Select, Toggle, ErrorBanner } from '@/components/ui/kit'

const mailApi = {
  get: () => api.get('/platform/mail-settings'),
  save: (data) => api.put('/platform/mail-settings', data),
  test: (to) => api.post('/platform/mail-settings/test', { to }),
}

/**
 * The platform's outgoing mail server (SMTP): sign-up codes, invoices and
 * every organisation's emails unless it sets up its own.
 */
export default function PlatformMailPage() {
  const { data, isLoading } = useQuery({ queryKey: ['platform-mail'], queryFn: () => mailApi.get().then((r) => r.data) })
  if (isLoading || !data) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>

  return <MailForm key={JSON.stringify(data.data)} config={data} />
}

function MailForm({ config }) {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user?.email)
  const s = config.data
  const [form, setForm] = useState({
    enabled: s.enabled, host: s.host ?? '', port: s.port ?? 587, encryption: s.encryption ?? 'tls',
    username: s.username ?? '', password: '', from_address: s.from_address ?? '', from_name: s.from_name ?? '',
  })
  const [testTo, setTestTo] = useState(me ?? '')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const save = useMutation({
    mutationFn: () => mailApi.save({ ...form, port: form.port ? Number(form.port) : null, password: form.password || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-mail'] }),
  })
  const test = useMutation({ mutationFn: () => mailApi.test(testTo) })

  return (
    <div className="space-y-6">
      <PageHeader icon={Mail} title="Mail server" subtitle="SMTP for sign-up codes, invoices and notifications. Organisations can also add their own."
        actions={<Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>} />

      {config.env_mailer && !s.enabled && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>No mail server is saved here, so the server’s <code>.env</code> mailer (<b>{config.env_mailer}</b>) is used
            {config.env_mailer === 'log' && ' — emails are only written to the log, nobody receives them'}.</p>
        </div>
      )}

      <ErrorBanner error={save.error} />
      {save.isSuccess && <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} />{save.data.data.message}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <CardHeader icon={Mail} title="SMTP settings" subtitle="From your email provider (Google Workspace, Microsoft 365, Zoho, Amazon SES, SendGrid…)." />
          <div className="space-y-4 p-5">
            <Toggle checked={form.enabled} onChange={(enabled) => set({ enabled })} label="Send email through this server"
              description="Off: the server’s .env mail settings are used." />
            <fieldset disabled={!form.enabled} className="grid gap-4 sm:grid-cols-6">
              <Field label="SMTP host" required className="sm:col-span-4"><Input value={form.host} placeholder="smtp.zoho.in" onChange={(e) => set({ host: e.target.value })} /></Field>
              <Field label="Port" required className="sm:col-span-2"><Input type="number" value={form.port} onChange={(e) => set({ port: e.target.value })} /></Field>
              <Field label="Security" className="sm:col-span-3">
                <Select value={form.encryption} onChange={(e) => set({ encryption: e.target.value, port: e.target.value === 'ssl' ? 465 : e.target.value === 'none' ? 25 : 587 })}>
                  {Object.entries(config.encryptions).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Username" className="sm:col-span-3"><Input value={form.username} autoComplete="off" onChange={(e) => set({ username: e.target.value })} /></Field>
              <Field label="Password / app password" className="sm:col-span-6" hint={s.password_set ? 'Saved. Leave blank to keep it.' : undefined}>
                <Input type="password" autoComplete="new-password" value={form.password} placeholder={s.password_set ? '••••••••' : ''} onChange={(e) => set({ password: e.target.value })} />
              </Field>
              <Field label="From address" required className="sm:col-span-3"><Input type="email" value={form.from_address} placeholder="no-reply@peoplenex.in" onChange={(e) => set({ from_address: e.target.value })} /></Field>
              <Field label="From name" className="sm:col-span-3"><Input value={form.from_name} placeholder="PeopleNex" onChange={(e) => set({ from_name: e.target.value })} /></Field>
            </fieldset>
          </div>
        </Card>

        <Card padded={false}>
          <CardHeader icon={Send} title="Send a test" subtitle="Uses the saved settings — save first." />
          <div className="space-y-3 p-5">
            <Field label="Send to"><Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></Field>
            <Button variant="secondary" icon={Send} className="w-full" loading={test.isPending} disabled={!testTo} onClick={() => test.mutate()}>Send test email</Button>
            {test.isSuccess && <p className="flex items-start gap-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{test.data.data.message}</p>}
            <ErrorBanner error={test.error} />
            <p className="text-xs text-slate-500">Gmail / Google Workspace and Microsoft 365 need an app password when two-step verification is on.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
