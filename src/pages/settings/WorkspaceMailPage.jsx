import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Save, Send, CheckCircle2, Info } from 'lucide-react'
import { notificationApi } from '@/lib/api/notifications'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, CardHeader, Button, Field, Input, Select, Toggle, ErrorBanner } from '@/components/ui/kit'

/**
 * The workspace's own outgoing mail server, so emails to employees (welcome
 * mails, approvals, payslips) come from the company's domain. Without it the
 * platform's server sends them under the company's name.
 */
export default function WorkspaceMailPage() {
  const { data, isLoading } = useQuery({ queryKey: ['notification-settings'], queryFn: () => notificationApi.settings().then((r) => r.data) })
  if (isLoading || !data) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>

  return <MailForm key={JSON.stringify(data.data.smtp_credentials) + data.data.smtp_enabled} config={data} />
}

function MailForm({ config }) {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user?.email)
  const companyName = useAuthStore((s) => s.company?.name)
  const s = config.data
  const saved = s.smtp_credentials ?? {}
  const val = (k, d = '') => saved[k]?.value ?? d
  const [form, setForm] = useState({
    enabled: !!s.smtp_enabled, host: val('host'), port: val('port', 587), encryption: val('encryption', 'tls'),
    username: val('username'), password: '', from_address: val('from_address'), from_name: val('from_name'),
  })
  const [testTo, setTestTo] = useState(me ?? '')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const save = useMutation({
    mutationFn: () => {
      const { enabled, ...creds } = form
      return notificationApi.saveSettings({
        smtp_enabled: enabled,
        // Using your own server means sending email; switch the channel on with it.
        ...(enabled ? { email_enabled: true } : {}),
        smtp_credentials: { ...creds, port: creds.port ? Number(creds.port) : null, password: creds.password || null },
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-settings'] }),
  })
  const test = useMutation({ mutationFn: () => notificationApi.test({ channel: 'email', to: testTo || undefined }) })

  return (
    <div className="space-y-6">
      <PageHeader icon={Mail} title="Mail server" subtitle="Send your organisation’s emails from your own domain through your mail server (SMTP)."
        actions={<Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>} />

      {!s.smtp_enabled && (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>{config.platform_smtp
            ? <>Right now emails go out through PeopleNex as “{companyName ?? 'Your organisation'} via PeopleNex”. Add your own server to send from your company address.</>
            : <>No mail server is set up yet — add yours here to send emails to employees.</>}</p>
        </div>
      )}

      <ErrorBanner error={save.error} />
      {save.isSuccess && <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} />Mail server saved. Send a test to check it.</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <CardHeader icon={Mail} title="SMTP settings" subtitle="From your email provider: Google Workspace, Microsoft 365, Zoho Mail, your hosting…" />
          <div className="space-y-4 p-5">
            <Toggle checked={form.enabled} onChange={(enabled) => set({ enabled })} label="Use our own mail server"
              description="Off: emails are sent by PeopleNex under your organisation’s name." />
            <fieldset disabled={!form.enabled} className="grid gap-4 sm:grid-cols-6">
              <Field label="SMTP host" required className="sm:col-span-4"><Input value={form.host} placeholder="smtp.gmail.com" onChange={(e) => set({ host: e.target.value })} /></Field>
              <Field label="Port" required className="sm:col-span-2"><Input type="number" value={form.port} onChange={(e) => set({ port: e.target.value })} /></Field>
              <Field label="Security" className="sm:col-span-3">
                <Select value={form.encryption} onChange={(e) => set({ encryption: e.target.value, port: e.target.value === 'ssl' ? 465 : e.target.value === 'none' ? 25 : 587 })}>
                  {Object.entries(config.smtp_encryptions ?? { tls: 'TLS', ssl: 'SSL', none: 'None' }).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Username" className="sm:col-span-3"><Input value={form.username} autoComplete="off" placeholder="hr@yourcompany.com" onChange={(e) => set({ username: e.target.value })} /></Field>
              <Field label="Password / app password" className="sm:col-span-6" hint={saved.password?.set ? `Saved (${saved.password.hint}). Leave blank to keep it.` : undefined}>
                <Input type="password" autoComplete="new-password" value={form.password} placeholder={saved.password?.set ? '••••••••' : ''} onChange={(e) => set({ password: e.target.value })} />
              </Field>
              <Field label="From address" required className="sm:col-span-3"><Input type="email" value={form.from_address} placeholder="hr@yourcompany.com" onChange={(e) => set({ from_address: e.target.value })} /></Field>
              <Field label="From name" className="sm:col-span-3"><Input value={form.from_name} placeholder={companyName ? `${companyName} HR` : 'HR team'} onChange={(e) => set({ from_name: e.target.value })} /></Field>
            </fieldset>
          </div>
        </Card>

        <Card padded={false}>
          <CardHeader icon={Send} title="Send a test" subtitle="Uses the saved settings — save first." />
          <div className="space-y-3 p-5">
            <Field label="Send to"><Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></Field>
            <Button variant="secondary" icon={Send} className="w-full" loading={test.isPending} disabled={!s.email_enabled} onClick={() => test.mutate()}>Send test email</Button>
            {!s.email_enabled && <p className="text-xs text-amber-700">Email notifications are off. Save with your own server on (or switch email on under Notifications) to test.</p>}
            {test.isSuccess && <p className="flex items-start gap-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{test.data.data.message}</p>}
            <ErrorBanner error={test.error} />
            <p className="text-xs text-slate-500">Gmail / Google Workspace and Microsoft 365 need an app password when two-step verification is on.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
