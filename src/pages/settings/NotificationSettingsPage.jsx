import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BellRing, Mail, MessageSquare, MessageCircle, Send, Save, Lock, CheckCircle2 } from 'lucide-react'
import { notificationApi } from '@/lib/api/notifications'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Tabs, Field, Input, Select, Toggle, StatusPill, ErrorBanner, EmptyState, Pagination, Table } from '@/components/ui/kit'

const CHANNEL_META = {
  email: { label: 'Email', icon: Mail },
  sms: { label: 'SMS', icon: MessageSquare },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
}
const TEMPLATE_PROVIDERS = { sms: ['msg91'], whatsapp: ['meta', 'twilio'] }

export default function NotificationSettingsPage() {
  const [tab, setTab] = useState('channels')
  const { data, isLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => notificationApi.settings().then((r) => r.data),
  })

  return (
    <div className="space-y-5">
      <PageHeader icon={BellRing} title="Notifications"
        subtitle="How people hear about approvals, decisions and payslips — in the app, by email, SMS or WhatsApp." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'channels', label: 'Channels' },
        { key: 'events', label: 'What gets sent' },
        { key: 'log', label: 'Delivery log' },
      ]} />
      {isLoading || !data ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
        <>
          {tab === 'channels' && <Channels config={data} />}
          {tab === 'events' && <Events config={data} />}
          {tab === 'log' && <DeliveryLog />}
        </>
      )}
    </div>
  )
}

// ── Channels ───────────────────────────────────────────────────────────────

function Channels({ config }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChannelCard channel="email" config={config} />
      <ChannelCard channel="sms" config={config} locked={!config.plan_allows_messaging} />
      <ChannelCard channel="whatsapp" config={config} locked={!config.plan_allows_messaging} />
    </div>
  )
}

function ChannelCard({ channel, config, locked }) {
  const qc = useQueryClient()
  const companyName = useAuthStore((st) => st.company?.name)
  const s = config.data
  const meta = CHANNEL_META[channel]
  const Icon = meta.icon
  const [enabled, setEnabled] = useState(!!s[`${channel}_enabled`])
  const [provider, setProvider] = useState(s[`${channel}_provider`] ?? '')
  const [creds, setCreds] = useState({})
  const [testTo, setTestTo] = useState('')
  const fields = channel === 'email' ? {} : (config.credential_fields[channel]?.[provider] ?? {})
  const stored = s[`${channel}_credentials`] ?? {}

  const save = useMutation({
    mutationFn: () => notificationApi.saveSettings(channel === 'email'
      ? { email_enabled: enabled }
      : { [`${channel}_enabled`]: enabled, [`${channel}_provider`]: provider || null, [`${channel}_credentials`]: creds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notification-settings'] }); setCreds({}) },
  })
  const test = useMutation({ mutationFn: () => notificationApi.test({ channel, to: testTo || undefined }) })

  return (
    <Card className={cn('flex flex-col', locked && 'opacity-80')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={19} /></div>
          <div>
            <p className="font-semibold text-slate-900">{meta.label}</p>
            <p className="text-xs text-slate-500">{channel === 'email' ? 'From your platform mailer' : enabled ? (config.providers[channel][provider] ?? 'Choose a provider') : 'Off'}</p>
          </div>
        </div>
        {!locked && <Toggle checked={enabled} onChange={setEnabled} />}
      </div>

      {locked ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <Lock size={15} className="mt-0.5 shrink-0" /> SMS and WhatsApp aren’t part of your plan. Upgrade to send them.
        </div>
      ) : (
        <div className="mt-4 flex-1 space-y-3">
          {channel === 'email' ? (
            <p className="text-sm text-slate-500">Emails go out as “{companyName ?? 'Your organisation'} via Peoplenex”. Pick which events send email under <b>What gets sent</b>.</p>
          ) : (
            <>
              <Field label="Provider">
                <Select value={provider} onChange={(e) => { setProvider(e.target.value); setCreds({}) }}>
                  <option value="">Choose…</option>
                  {Object.entries(config.providers[channel]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </Select>
              </Field>
              {Object.entries(fields).map(([key, label]) => {
                const saved = stored[key]
                return (
                  <Field key={key} label={label}
                    hint={saved?.set && !saved.value ? `Saved (${saved.hint}). Leave blank to keep it.` : undefined}>
                    <Input value={creds[key] ?? (saved?.value ?? '')} type={saved?.value !== undefined && saved?.value !== null ? 'text' : 'password'}
                      autoComplete="off" placeholder={saved?.set && !saved.value ? '••••••••' : ''}
                      onChange={(e) => setCreds({ ...creds, [key]: e.target.value })} />
                  </Field>
                )
              })}
              {provider === 'log' && <p className="text-xs text-slate-500">Test mode: messages are written to the server log instead of being sent.</p>}
            </>
          )}
        </div>
      )}

      {!locked && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <ErrorBanner error={save.error} />
          <div className="flex justify-end">
            <Button size="sm" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save {meta.label}</Button>
          </div>
          {s[`${channel}_enabled`] && (
            <div className="flex gap-2">
              <Input className="py-1.5 text-xs" value={testTo} placeholder={channel === 'email' ? 'Your email (default)' : 'Mobile number, e.g. 98470 12345'}
                onChange={(e) => setTestTo(e.target.value)} />
              <Button size="sm" variant="secondary" icon={Send} loading={test.isPending} onClick={() => test.mutate()}>Test</Button>
            </div>
          )}
          {test.isSuccess && <p className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 size={13} />{test.data.data.message}</p>}
          <ErrorBanner error={test.error} />
        </div>
      )}
    </Card>
  )
}

// ── Events ─────────────────────────────────────────────────────────────────

function Events({ config }) {
  const qc = useQueryClient()
  const s = config.data
  const [events, setEvents] = useState(() => structuredClone(s.events))
  const on = (channel) => channel === 'in_app' || (s[`${channel}_enabled`] && (channel === 'email' || s[`${channel}_provider`]))

  const toggle = (key, channel) => setEvents((ev) => {
    const channels = ev[key].channels.includes(channel) ? ev[key].channels.filter((c) => c !== channel) : [...ev[key].channels, channel]
    return { ...ev, [key]: { ...ev[key], channels } }
  })
  const setField = (key, field, value) => setEvents((ev) => ({ ...ev, [key]: { ...ev[key], [field]: value } }))

  const save = useMutation({
    mutationFn: () => notificationApi.saveSettings({ events }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-settings'] }),
  })

  const groups = config.catalog.reduce((acc, e) => ({ ...acc, [e.group]: [...(acc[e.group] ?? []), e] }), {})
  const needsTemplate = (channel) => TEMPLATE_PROVIDERS[channel]?.includes(s[`${channel}_provider`])

  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Event</th>
              {['in_app', 'email', 'sms', 'whatsapp'].map((c) => (
                <th key={c} className={cn('px-3 py-3 text-center', !on(c) && 'text-slate-300')}>{c === 'in_app' ? 'In-app' : CHANNEL_META[c].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([group, list]) => (
              <GroupRows key={group} group={group} list={list} events={events} on={on} toggle={toggle} setField={setField} needsTemplate={needsTemplate} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <p className="text-xs text-slate-400">Greyed-out channels are switched off under Channels. In-app notifications appear in the bell.</p>
        <div className="flex items-center gap-2">
          {save.isSuccess && <span className="text-xs text-emerald-700">Saved</span>}
          <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </div>
      </div>
      <ErrorBanner error={save.error} className="mx-4 mb-4" />
    </Card>
  )
}

function GroupRows({ group, list, events, on, toggle, setField, needsTemplate }) {
  return (
    <>
      <tr><td colSpan={5} className="bg-slate-50/40 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group}</td></tr>
      {list.map((e) => {
        const ev = events[e.key]
        const templated = ['sms', 'whatsapp'].filter((c) => ev.channels.includes(c) && on(c) && needsTemplate(c))
        return (
          <tr key={e.key} className="border-b border-slate-100 align-top">
            <td className="px-4 py-3">
              <p className="font-medium text-slate-800">{e.label}</p>
              <p className="text-xs text-slate-400">To the {e.to.toLowerCase()}</p>
              {templated.map((c) => (
                <div key={c} className="mt-2 max-w-md space-y-1 rounded-lg bg-slate-50 p-2.5">
                  <div className="flex gap-2">
                    <Input className="py-1.5 text-xs" value={ev[`${c}_template`] ?? ''}
                      placeholder={c === 'sms' ? 'MSG91 flow / DLT template id' : 'WhatsApp template name'}
                      onChange={(x) => setField(e.key, `${c}_template`, x.target.value)} />
                    {c === 'whatsapp' && (
                      <Input className="w-20 py-1.5 text-xs" value={ev.whatsapp_language ?? 'en'} onChange={(x) => setField(e.key, 'whatsapp_language', x.target.value)} />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {CHANNEL_META[c].label} variables in order: {e.variables.map((v, i) => `{{${i + 1}}} ${v}`).join(' · ')}
                  </p>
                </div>
              ))}
            </td>
            {['in_app', 'email', 'sms', 'whatsapp'].map((c) => (
              <td key={c} className="px-3 py-3 text-center">
                <input type="checkbox" disabled={!on(c)} checked={on(c) && ev.channels.includes(c)} onChange={() => toggle(e.key, c)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 disabled:opacity-40" />
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}

// ── Delivery log ───────────────────────────────────────────────────────────

const STATUS_TONE = { sent: 'green', queued: 'amber', sending: 'blue', failed: 'red', skipped: 'slate' }

function DeliveryLog() {
  const [filters, setFilters] = useState({ channel: '', status: '' })
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['notification-logs', filters, page],
    queryFn: () => notificationApi.logs({ channel: filters.channel || undefined, status: filters.status || undefined, page }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select className="w-auto" value={filters.channel} onChange={(e) => { setFilters({ ...filters, channel: e.target.value }); setPage(1) }}>
          <option value="">All channels</option>
          {Object.entries(CHANNEL_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </Select>
        <Select className="w-auto" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </Select>
      </div>
      <Card padded={false}>
        {isLoading ? <div className="flex justify-center py-14"><Spinner className="h-7 w-7" /></div> : (
          <Table rows={data?.data ?? []}
            empty={<EmptyState icon={Send} title="Nothing sent yet" description="Email, SMS and WhatsApp messages appear here with their delivery status." />}
            columns={[
              { key: 'when', label: 'When', render: (l) => <span className="whitespace-nowrap text-xs text-slate-500">{new Date(l.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span> },
              { key: 'to', label: 'To', render: (l) => <div><p className="text-slate-800">{l.user?.name ?? '—'}</p><p className="font-mono text-[11px] text-slate-400">{l.recipient}</p></div> },
              { key: 'channel', label: 'Channel', render: (l) => CHANNEL_META[l.channel]?.label ?? l.channel },
              { key: 'event', label: 'Message', render: (l) => <div className="max-w-sm"><p className="truncate text-slate-700">{l.subject ?? l.body}</p><p className="text-[11px] text-slate-400">{l.event}{l.template && ` · template ${l.template}`}</p></div> },
              { key: 'status', label: 'Status', render: (l) => (
                <div>
                  <StatusPill tone={STATUS_TONE[l.status]} label={l.status[0].toUpperCase() + l.status.slice(1)} />
                  {l.error && <p className="mt-1 max-w-[220px] text-[11px] text-rose-600">{l.error}</p>}
                  {l.attempts > 1 && <p className="text-[11px] text-slate-400">{l.attempts} attempts</p>}
                </div>
              ) },
            ]} />
        )}
        <div className="px-4 pb-3"><Pagination meta={data?.meta} onPage={setPage} /></div>
      </Card>
    </div>
  )
}
