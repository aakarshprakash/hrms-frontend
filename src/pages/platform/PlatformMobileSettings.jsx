import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Smartphone, Save, CheckCircle2, Layers, PackageCheck, AlertTriangle } from 'lucide-react'
import { platformApi } from '@/lib/api/platform'
import { Spinner } from '@/components/ui/Spinner'
import { Card, CardHeader, Button, Field, Input, Toggle, ErrorBanner } from '@/components/ui/kit'

/**
 * The mobile app's switches: on/off for everyone, which plans include it, and
 * the versions the app checks at start-up. Organisations can be switched on
 * or off individually from their page.
 */
export default function PlatformMobileSettings() {
  const { data, isLoading } = useQuery({ queryKey: ['platform-mobile'], queryFn: () => platformApi.mobileSettings().then((r) => r.data) })
  if (isLoading || !data) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>

  return <MobileForm key={JSON.stringify(data)} config={data} />
}

function MobileForm({ config }) {
  const qc = useQueryClient()
  const s = config.data
  const [form, setForm] = useState({
    enabled: !!s.enabled, min_version: s.min_version ?? '', latest_version: s.latest_version ?? '',
    android_url: s.android_url ?? '', ios_url: s.ios_url ?? '', message: s.message ?? '',
  })
  const [plans, setPlans] = useState(() => Object.fromEntries(config.plans.map((p) => [p.id, p.mobile_app])))
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const blank = (v) => (v === '' ? null : v)

  const save = useMutation({
    mutationFn: () => platformApi.saveMobileSettings({
      enabled: form.enabled, min_version: blank(form.min_version), latest_version: blank(form.latest_version),
      android_url: blank(form.android_url), ios_url: blank(form.ios_url), message: blank(form.message), plans,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-mobile'] }); qc.invalidateQueries({ queryKey: ['platform-plans'] }) },
  })

  return (
    <div className="space-y-4">
      {!s.enabled && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>The mobile app is <b>off for everyone</b>. Signed-in phones are refused on their next request; the web app is not affected.</p>
        </div>
      )}
      <ErrorBanner error={save.error} />
      {save.isSuccess && <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} />{save.data.data.message}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <CardHeader icon={Smartphone} title="Mobile app" subtitle="The PeopleNex app for employees and managers (Android)."
            actions={<Button icon={Save} size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>} />
          <div className="space-y-5 p-5">
            <Toggle checked={form.enabled} onChange={(enabled) => set({ enabled })} label="Mobile app is available"
              description="Off: nobody can sign in on the app, and signed-in phones are logged out. Use it to pull a bad release." />
            {!form.enabled && (
              <Field label="Message shown in the app" hint="Optional. For example: “Back after maintenance at 6 pm.”">
                <Input value={form.message} maxLength={255} onChange={(e) => set({ message: e.target.value })} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum version" hint="Older apps must update before they can continue.">
                <Input value={form.min_version} placeholder="1.0.0" onChange={(e) => set({ min_version: e.target.value })} />
              </Field>
              <Field label="Latest version" hint="Newer than the installed app: it offers the update.">
                <Input value={form.latest_version} placeholder="1.0.0" onChange={(e) => set({ latest_version: e.target.value })} />
              </Field>
              <Field label="Android download link" className="sm:col-span-2" hint="Play Store listing or the APK’s download URL.">
                <Input type="url" value={form.android_url} placeholder="https://play.google.com/store/apps/details?id=online.peoplenex.app" onChange={(e) => set({ android_url: e.target.value })} />
              </Field>
              <Field label="iOS download link" className="sm:col-span-2" hint="Later, once the iPhone app is out.">
                <Input type="url" value={form.ios_url} onChange={(e) => set({ ios_url: e.target.value })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <CardHeader icon={Layers} title="Plans with the app" subtitle="Same as the “Mobile app” module in the plan editor." />
          <div className="divide-y divide-slate-100">
            {config.plans.map((p) => (
              <div key={p.id} className="px-5 py-3">
                <Toggle checked={!!plans[p.id]} onChange={(on) => setPlans((x) => ({ ...x, [p.id]: on }))} label={p.name}
                  description={plans[p.id] ? 'Included' : 'Not included: the app tells people to use the web'} />
              </div>
            ))}
          </div>
          <p className="flex items-start gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <PackageCheck size={14} className="mt-px shrink-0" />
            To switch one organisation on or off regardless of its plan, open it under Organisations.
          </p>
        </Card>
      </div>
    </div>
  )
}
