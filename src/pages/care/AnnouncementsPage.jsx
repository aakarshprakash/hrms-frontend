import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Pin, CheckCircle2, Plus, Pencil, Trash2, Users, CalendarDays, AlertTriangle } from 'lucide-react'
import { announcementApi } from '@/lib/api/care'
import { apiError } from '@/lib/api/axios'
import { useRole } from '@/hooks/useRole'
import { useAuthStore } from '@/store/authStore'
import { dateLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Table, StatusPill, EmptyState, Modal, Field, Input, Select, Toggle, ErrorBanner, Tabs, IconButton } from '@/components/ui/kit'
import { RichEditor } from '@/components/editor/RichEditor'

const CATEGORY_TONE = { general: 'slate', policy: 'indigo', event: 'teal', holiday: 'green', urgent: 'red' }
const CATEGORY_LABEL = { general: 'General', policy: 'Policy', event: 'Event', holiday: 'Holiday', urgent: 'Urgent' }

/** Company and branch announcements; HR publishes and tracks who has read them. */
export default function AnnouncementsPage() {
  const { can } = useRole()
  const manage = can('announcements.manage')
  const [tab, setTab] = useState('feed')

  return (
    <div className="space-y-6">
      <PageHeader icon={Megaphone} title="Announcements" subtitle="News, policies and notices from your organisation." />
      {manage && <Tabs value={tab} onChange={setTab} tabs={[{ key: 'feed', label: 'Feed' }, { key: 'manage', label: 'Manage' }]} />}
      {tab === 'feed' ? <Feed /> : <Manage />}
    </div>
  )
}

function Feed() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['announcements-feed'], queryFn: () => announcementApi.feed().then((r) => r.data) })
  const marked = useRef(false)
  const ack = useMutation({ mutationFn: (id) => announcementApi.acknowledge(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements-feed'] }) })

  // Opening the feed counts as reading what's in it (the "New" tag stays for this visit).
  useEffect(() => {
    if (!data || marked.current) return
    marked.current = true
    data.data.filter((a) => !a.read_at).forEach((a) => announcementApi.read(a.id).catch(() => {}))
  }, [data])

  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>
  if (!data?.data.length) return <Card><EmptyState icon={Megaphone} title="No announcements" description="Notices from HR will show up here." /></Card>

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {data.pending_ack > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"><AlertTriangle size={16} />
          {data.pending_ack} announcement{data.pending_ack > 1 ? 's need' : ' needs'} your acknowledgement.</p>
      )}
      {data.data.map((a) => (
        <Card key={a.id} className={cn(a.category === 'urgent' && 'border-rose-200', a.pinned && 'ring-1 ring-blue-200')}>
          <div className="flex flex-wrap items-center gap-2">
            {a.pinned && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700"><Pin size={12} /> Pinned</span>}
            <StatusPill tone={CATEGORY_TONE[a.category]} label={CATEGORY_LABEL[a.category]} dot={false} />
            {!a.read_at && <StatusPill tone="blue" label="New" />}
            <span className="ml-auto text-xs text-slate-400">{dateLabel(a.published_at)}{a.author && ` · ${a.author}`}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">{a.title}</h2>
          <div className="rich-text mt-2 text-slate-700" dangerouslySetInnerHTML={{ __html: a.body }} />
          {a.requires_ack && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              {a.acknowledged_at
                ? <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} /> You acknowledged this on {dateLabel(a.acknowledged_at)}</p>
                : <p className="text-sm text-slate-600">Please confirm you’ve read and understood this.</p>}
              {!a.acknowledged_at && <Button size="sm" icon={CheckCircle2} loading={ack.isPending && ack.variables === a.id} onClick={() => ack.mutate(a.id)}>I acknowledge</Button>}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

const STATE = { live: ['green', 'Live'], draft: ['slate', 'Draft'], scheduled: ['blue', 'Scheduled'], expired: ['slate', 'Expired'] }

function Manage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [readersOf, setReadersOf] = useState(null)
  const { data, isLoading } = useQuery({ queryKey: ['announcements-manage'], queryFn: () => announcementApi.manage().then((r) => r.data.data) })
  const remove = useMutation({ mutationFn: (id) => announcementApi.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements-manage'] }) })

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <p className="font-semibold text-slate-900">All announcements</p>
        <Button icon={Plus} onClick={() => setEditing({})}>New announcement</Button>
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div> : (
        <Table rows={data ?? []} empty={<EmptyState icon={Megaphone} title="Nothing published yet" />}
          columns={[
            { key: 'title', label: 'Announcement', render: (a) => (
              <div><p className="flex items-center gap-1.5 font-medium text-slate-900">{a.pinned && <Pin size={12} className="text-blue-600" />}{a.title}</p>
                <p className="text-xs text-slate-400">{CATEGORY_LABEL[a.category]} · {a.branch ?? 'Everyone'}</p></div>
            ) },
            { key: 'state', label: 'Status', render: (a) => <StatusPill tone={STATE[a.state][0]} label={STATE[a.state][1]} /> },
            { key: 'published_at', label: 'Published', render: (a) => (a.published_at ? dateLabel(a.published_at) : '—') },
            { key: 'reads', label: 'Read', align: 'right', render: (a) => (
              <button type="button" onClick={() => setReadersOf(a)} className="font-medium text-blue-600 hover:underline">{a.reads_count} / {a.audience}</button>
            ) },
            { key: 'ack', label: 'Acknowledged', align: 'right', render: (a) => (a.requires_ack ? `${a.acknowledged_count} / ${a.audience}` : '—') },
            { key: 'actions', label: '', align: 'right', render: (a) => (
              <div className="flex justify-end gap-1">
                <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(a)} />
                <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => { if (confirm(`Delete “${a.title}”?`)) remove.mutate(a.id) }} />
              </div>
            ) },
          ]} />
      )}
      {editing && <Editor announcement={editing} onClose={() => setEditing(null)} />}
      {readersOf && <Readers announcement={readersOf} onClose={() => setReadersOf(null)} />}
    </Card>
  )
}

function Editor({ announcement: a, onClose }) {
  const qc = useQueryClient()
  const branches = useAuthStore((s) => s.branches)
  const [form, setForm] = useState({
    title: a.title ?? '', body: a.body ?? '', category: a.category ?? 'general', branch_id: a.branch_id ?? '',
    pinned: a.pinned ?? false, requires_ack: a.requires_ack ?? false, expires_at: a.expires_at ? a.expires_at.slice(0, 10) : '',
  })
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const save = useMutation({
    mutationFn: (publish) => {
      const payload = { ...form, branch_id: form.branch_id || null, expires_at: form.expires_at || null, publish }
      return a.id ? announcementApi.update(a.id, payload) : announcementApi.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements-manage'] }); qc.invalidateQueries({ queryKey: ['announcements-feed'] }); onClose() },
  })
  const ok = form.title.trim() && form.body.replace(/<[^>]+>/g, '').trim()

  return (
    <Modal title={a.id ? 'Edit announcement' : 'New announcement'} onClose={onClose} size="xl"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" loading={save.isPending && save.variables === false} disabled={!ok} onClick={() => save.mutate(false)}>Save as draft</Button>
        <Button icon={Megaphone} loading={save.isPending && save.variables === true} disabled={!ok} onClick={() => save.mutate(true)}>{a.published_at ? 'Save' : 'Publish now'}</Button>
      </>}>
      <div className="space-y-4">
        <Field label="Title" required><Input value={form.title} maxLength={191} onChange={(e) => set({ title: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Category"><Select value={form.category} onChange={(e) => set({ category: e.target.value })}>{Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Audience"><Select value={form.branch_id} onChange={(e) => set({ branch_id: e.target.value })}>
            <option value="">Everyone</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name} only</option>)}
          </Select></Field>
          <Field label="Hide after (optional)"><Input type="date" value={form.expires_at} onChange={(e) => set({ expires_at: e.target.value })} /></Field>
        </div>
        <Field label="Message" required><RichEditor value={form.body} onChange={(html) => set({ body: html })} minHeight={200} /></Field>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={form.pinned} onChange={(v) => set({ pinned: v })} label="Pin to the top" />
          <Toggle checked={form.requires_ack} onChange={(v) => set({ requires_ack: v })} label="Ask everyone to acknowledge" description="For policies and rule changes" />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={13} /> Publishing notifies everyone in the audience in the app.</p>
        <ErrorBanner error={save.error} message={save.error ? apiError(save.error) : undefined} />
      </div>
    </Modal>
  )
}

function Readers({ announcement: a, onClose }) {
  const [view, setView] = useState('pending')
  const { data, isLoading } = useQuery({ queryKey: ['announcement-readers', a.id], queryFn: () => announcementApi.readers(a.id).then((r) => r.data.data) })
  const rows = (data ?? []).map((r) => ({ ...r, id: r.user_id }))
  const pending = rows.filter((r) => (a.requires_ack ? !r.acknowledged_at : !r.read_at))
  const shown = view === 'pending' ? pending : rows

  return (
    <Modal title={a.title} subtitle={`${a.reads_count} of ${a.audience} have read it${a.requires_ack ? ` · ${a.acknowledged_count} acknowledged` : ''}`} onClose={onClose} size="lg">
      <Tabs variant="pills" value={view} onChange={setView} className="mb-3" tabs={[{ key: 'pending', label: a.requires_ack ? 'Not acknowledged' : 'Not read', count: pending.length }, { key: 'all', label: 'Everyone', count: rows.length }]} />
      {isLoading ? <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div> : (
        <Table rows={shown} empty={<EmptyState icon={Users} title="Everyone’s done" />}
          columns={[
            { key: 'name', label: 'Employee', render: (r) => <div><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-400">{r.employee_code}</p></div> },
            { key: 'read_at', label: 'Read', render: (r) => (r.read_at ? dateLabel(r.read_at) : <span className="text-slate-400">—</span>) },
            ...(a.requires_ack ? [{ key: 'acknowledged_at', label: 'Acknowledged', render: (r) => (r.acknowledged_at ? dateLabel(r.acknowledged_at) : <span className="text-slate-400">—</span>) }] : []),
          ]} />
      )}
    </Modal>
  )
}
