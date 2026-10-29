import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LifeBuoy, Send, Lock, Star, EyeOff, Clock, CheckCircle2 } from 'lucide-react'
import { helpdeskApi } from '@/lib/api/care'
import { apiError } from '@/lib/api/axios'
import { TICKET_STATUS, PRIORITY, ago } from '@/lib/care'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, StatusPill, Select, Textarea, Toggle, ErrorBanner, Avatar } from '@/components/ui/kit'

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')

/** One ticket: the conversation, and for HR the controls to work it. */
export default function TicketPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { data: t, isLoading, error } = useQuery({ queryKey: ['ticket', id], queryFn: () => helpdeskApi.get(id).then((r) => r.data.data) })
  const { data: meta } = useQuery({ queryKey: ['helpdesk-meta'], queryFn: () => helpdeskApi.meta().then((r) => r.data.data) })
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const fresh = (res) => {
    qc.setQueryData(['ticket', id], res.data.data)
    qc.invalidateQueries({ queryKey: ['helpdesk'] })
    qc.invalidateQueries({ queryKey: ['helpdesk-meta'] })
  }
  const reply = useMutation({ mutationFn: () => helpdeskApi.reply(id, { body, internal }), onSuccess: (res) => { setBody(''); fresh(res) } })
  const update = useMutation({ mutationFn: (data) => helpdeskApi.update(id, data), onSuccess: fresh })
  const rate = useMutation({ mutationFn: () => helpdeskApi.rate(id, { rating, comment: comment || undefined }), onSuccess: fresh })

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>
  if (error) return <ErrorBanner error={error} message={apiError(error)} />

  const handler = t.can_handle
  const closed = t.status === 'closed'

  return (
    <div className="space-y-6">
      <PageHeader icon={LifeBuoy} title={t.subject} breadcrumbs={[{ label: 'Helpdesk', to: '/helpdesk' }, { label: t.number }]}
        actions={<div className="flex gap-1.5"><StatusPill tone={TICKET_STATUS[t.status][0]} label={TICKET_STATUS[t.status][1]} />{t.overdue && <StatusPill tone="red" label="Past target" dot={false} />}</div>} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* The original request */}
          <Card>
            <div className="flex items-center gap-3">
              {t.anonymous && !t.employee.employee_code ? <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"><EyeOff size={16} /></span> : <Avatar name={t.employee.name} />}
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.employee.name}{t.employee.employee_code && <span className="ml-1.5 text-xs font-normal text-slate-400">{t.employee.employee_code}</span>}</p>
                <p className="text-xs text-slate-500">{when(t.created_at)} · {t.category_label}{t.type === 'grievance' && ' · grievance'}</p>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{t.description}</p>
          </Card>

          {/* Conversation */}
          {t.messages.map((m) => m.event ? (
            <p key={m.id} className="flex items-center justify-center gap-2 text-xs text-slate-400"><span className="h-px w-8 bg-slate-200" />{m.author}: {m.body} · {ago(m.created_at)}<span className="h-px w-8 bg-slate-200" /></p>
          ) : (
            <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-[15px]',
                m.internal ? 'border border-dashed border-amber-300 bg-amber-50 text-amber-950' : m.mine ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-800')}>
                <p className={cn('mb-1 flex items-center gap-1.5 text-[12px] font-semibold', m.mine && !m.internal ? 'text-blue-100' : 'text-slate-500')}>
                  {m.internal && <Lock size={11} />}{m.author}{m.from_hr && !m.mine && ' · HR'}{m.internal && ' · internal note'}<span className="font-normal">· {ago(m.created_at)}</span>
                </p>
                <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
              </div>
            </div>
          ))}

          {/* Reply */}
          {!closed && (
            <Card className="space-y-3">
              <Textarea rows={3} placeholder={handler ? 'Reply to the employee, or add an internal note…' : 'Add a reply…'} value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {handler ? <Toggle checked={internal} onChange={setInternal} label="Internal note" description="Only HR sees it" /> : <span />}
                <Button icon={internal ? Lock : Send} variant={internal ? 'secondary' : 'primary'} loading={reply.isPending} disabled={!body.trim()} onClick={() => reply.mutate()}>
                  {internal ? 'Add note' : 'Send reply'}
                </Button>
              </div>
              <ErrorBanner error={reply.error} message={reply.error ? apiError(reply.error) : undefined} />
            </Card>
          )}

          {/* Rating, for the employee once resolved */}
          {!handler && t.status === 'resolved' && (
            <Card className="space-y-3 border-emerald-200 bg-emerald-50/40">
              <p className="flex items-center gap-2 font-semibold text-slate-900"><CheckCircle2 size={17} className="text-emerald-600" /> HR has marked this resolved. How did we do?</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                    <Star size={26} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                  </button>
                ))}
              </div>
              <Textarea rows={2} placeholder="Anything to add? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Not sorted? Just reply above and it reopens.</p>
                <Button disabled={!rating} loading={rate.isPending} onClick={() => rate.mutate()}>Rate & close</Button>
              </div>
            </Card>
          )}
          {t.rating && <p className="flex items-center gap-1.5 text-sm text-slate-600"><Star size={15} className="fill-amber-400 text-amber-400" /> Rated {t.rating}/5{t.rating_comment && ` — “${t.rating_comment}”`}</p>}
        </div>

        {/* Details / controls */}
        <div className="space-y-4">
          <Card className="space-y-3 text-[14px]">
            <Row label="Priority">{handler && !closed
              ? <Select value={t.priority} onChange={(e) => update.mutate({ priority: e.target.value })}>{Object.entries(PRIORITY).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</Select>
              : <StatusPill tone={PRIORITY[t.priority][0]} label={PRIORITY[t.priority][1]} dot={false} />}</Row>
            {handler && (
              <>
                <Row label="Status">
                  <Select value={t.status} onChange={(e) => update.mutate({ status: e.target.value })}>
                    {Object.entries(TICKET_STATUS).map(([k, [, l]]) => <option key={k} value={k}>{k === 'waiting' ? 'Waiting on employee' : l}</option>)}
                  </Select>
                </Row>
                <Row label="Assigned to">
                  <Select value={t.assignee?.id ?? ''} onChange={(e) => update.mutate({ assigned_to: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Unassigned</option>
                    {(meta?.handlers ?? []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </Select>
                </Row>
              </>
            )}
            {!handler && <Row label="With">{t.assignee?.name ?? 'HR team'}</Row>}
            <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p className="flex items-center gap-1.5"><Clock size={12} /> First response {t.first_response_at ? `given ${when(t.first_response_at)}` : `due ${when(t.response_due_at)}`}</p>
              <p className="flex items-center gap-1.5"><Clock size={12} /> {t.resolved_at ? `Resolved ${when(t.resolved_at)}` : `Resolution target ${when(t.resolution_due_at)}`}</p>
            </div>
            {t.anonymous && <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600"><EyeOff size={13} className="mt-0.5 shrink-0" />{handler ? 'Raised anonymously — the employee’s identity is hidden.' : 'Your name is hidden from HR on this grievance.'}</p>}
            <ErrorBanner error={update.error} message={update.error ? apiError(update.error) : undefined} />
          </Card>
          <Link to="/helpdesk" className="block text-center text-xs font-medium text-blue-600 hover:underline">← All tickets</Link>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 max-w-[60%]">{children}</span>
    </div>
  )
}
