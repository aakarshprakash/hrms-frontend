import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BellRing, Mail, MessageSquare, MessageCircle, Smartphone, Save, CheckCircle2 } from 'lucide-react'
import { notificationApi } from '@/lib/api/notifications'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Field, Input, Toggle, ErrorBanner } from '@/components/ui/kit'

const META = {
  email: { label: 'Email', icon: Mail, description: 'Approvals, decisions and payslips in your inbox.' },
  sms: { label: 'SMS', icon: MessageSquare, description: 'Short text messages to your mobile.' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, description: 'Messages on WhatsApp from your organisation.' },
  push: { label: 'Mobile app', icon: Smartphone, description: 'Push notifications on phones where you’re signed in to the PeopleNex app.' },
}

/** My own notification channels: opt out per channel, and the mobile number to use. */
export default function AccountNotificationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-notification-preferences'],
    queryFn: () => notificationApi.preferences().then((r) => r.data),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader icon={BellRing} title="My notifications" subtitle="Everything always shows in the bell; choose which other channels reach you." />
      {isLoading || !data ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : <PreferencesForm data={data} />}
    </div>
  )
}

function PreferencesForm({ data }) {
  const qc = useQueryClient()
  const [prefs, setPrefs] = useState(() => Object.fromEntries(data.data.map((c) => [c.channel, c.enabled])))
  const [phone, setPhone] = useState(data.phone ?? '')
  const available = data.data.filter((c) => c.available)

  const save = useMutation({
    mutationFn: () => notificationApi.savePreferences({ ...prefs, phone: phone || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notification-preferences'] }),
  })

  if (available.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Your organisation sends notifications in the app only for now — watch the bell at the top of the screen.</p>
      </Card>
    )
  }

  return (
    <Card className="space-y-5">
      <ErrorBanner error={save.error} />
      {available.map((c) => {
        const m = META[c.channel]
        if (!m) return null
        const Icon = m.icon
        return (
          <div key={c.channel} className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon size={17} /></div>
              <div>
                <p className="font-medium text-slate-800">{m.label}</p>
                <p className="text-xs text-slate-500">{m.description}</p>
              </div>
            </div>
            <Toggle checked={prefs[c.channel]} onChange={(v) => setPrefs({ ...prefs, [c.channel]: v })} />
          </div>
        )
      })}
      {available.some((c) => ['sms', 'whatsapp'].includes(c.channel)) && (
        <Field label="Mobile number for SMS / WhatsApp"
          hint={!phone && data.profile_phone
            ? `Using the number on your employee profile (${data.profile_phone}). Enter another to use that instead.`
            : 'Indian numbers can be entered as 10 digits.'}>
          <Input value={phone} placeholder={data.profile_phone || '98470 12345'} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      )}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {save.isSuccess && <span className="flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 size={15} /> Saved</span>}
        <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
      </div>
    </Card>
  )
}
