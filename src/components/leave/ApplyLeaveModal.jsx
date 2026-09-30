import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Paperclip, Search, X, XCircle } from 'lucide-react'
import { leaveApi } from '@/lib/api/leaves'
import { employeeApi } from '@/lib/api/employees'
import { useRole } from '@/hooks/useRole'
import { dayCount, num, typeColor } from '@/lib/leave'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Modal, Button, Field, Input, Textarea, Toggle, ErrorBanner, Avatar } from '@/components/ui/kit'

const localToday = () => new Date().toLocaleDateString('en-CA')

function EmployeePicker({ value, onChange }) {
  const [search, setSearch] = useState('')
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['employees', 'leave-picker', search],
    queryFn: () => employeeApi.list({ search, per_page: 8, status: 'active' }).then((r) => r.data?.data ?? []),
    enabled: search.trim().length >= 2,
  })

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2.5">
          <Avatar name={value.name} size="sm" />
          <div>
            <p className="text-sm font-medium text-slate-900">{value.name}</p>
            <p className="text-xs text-slate-500">{value.employee_code}</p>
          </div>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"><X size={15} /></button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input autoFocus className="pl-8" placeholder="Search by name or employee code…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {search.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {isFetching && results.length === 0 && <div className="flex justify-center py-3"><Spinner className="h-4 w-4" /></div>}
          {!isFetching && results.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No matching employees</p>}
          {results.map((e) => (
            <button key={e.id} type="button" onClick={() => onChange({ id: e.id, name: `${e.first_name} ${e.last_name}`, employee_code: e.employee_code })}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50">
              <Avatar name={`${e.first_name} ${e.last_name}`} size="sm" />
              <span className="text-sm text-slate-800">{e.first_name} {e.last_name}</span>
              <span className="ml-auto text-xs text-slate-400">{e.employee_code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Apply for leave (or, for HR/approvers, record it for an employee). The
 * server quotes every change -- working days, sandwich days, balance after,
 * and any policy the request would break -- so the form never disagrees
 * with what submission will accept.
 */
export function ApplyLeaveModal({ onClose, onDone, onBehalf = false, presetEmployee = null, initialDate = '' }) {
  const qc = useQueryClient()
  const { can } = useRole()
  const [employee, setEmployee] = useState(presetEmployee)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState(() => ({
    leave_type_id: '', start_date: initialDate || localToday(), end_date: initialDate || localToday(),
    half: false, session: 'first_half', reason: '', approve_now: true,
  }))
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const employeeId = onBehalf ? employee?.id : undefined
  const ready = !onBehalf || !!employee

  const { data: summary = [], isLoading: loadingTypes } = useQuery({
    queryKey: ['leave-summary', employeeId ?? 'me'],
    queryFn: () => leaveApi.summary(employeeId ? { employee_id: employeeId } : {}).then((r) => r.data?.data ?? []),
    enabled: ready,
  })
  const types = summary.filter((r) => r.leave_type.is_active)
  const selected = types.find((r) => String(r.leave_type.id) === String(form.leave_type_id))
  const half = form.half && selected?.leave_type.allow_half_day

  const params = {
    leave_type_id: form.leave_type_id,
    start_date: form.start_date,
    end_date: half ? form.start_date : form.end_date,
    half_day_session: half ? form.session : undefined,
    employee_id: employeeId,
  }
  const canQuote = ready && !!form.leave_type_id && !!params.start_date && !!params.end_date && params.end_date >= params.start_date

  const { data: quote, isFetching: quoting } = useQuery({
    queryKey: ['leave-quote', params],
    queryFn: () => leaveApi.quote(params).then((r) => r.data.data),
    enabled: canQuote,
    placeholderData: (prev) => prev,
  })
  const current = canQuote ? quote : null

  const submit = useMutation({
    mutationFn: () => {
      const payload = { ...params, reason: form.reason.trim() || undefined }
      if (onBehalf) payload.approve_now = form.approve_now && can('leaves.approve')
      if (!file) return leaveApi.submit(payload)
      const fd = new FormData()
      Object.entries(payload).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return
        fd.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v))
      })
      fd.append('attachment', file)
      return leaveApi.submit(fd)
    },
    onSuccess: (res) => {
      ['leaves', 'leave-summary', 'leave-calendar', 'approvals', 'approvals-count', 'leave-overview'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      onDone?.(res.data)
      onClose()
    },
  })

  const needsDocument = !!current?.requires_document
  const blocked = !current || !current.ok || quoting || (needsDocument && !file) || !ready

  return (
    <Modal size="lg" onClose={onClose}
      title={onBehalf ? 'Record leave for an employee' : 'Apply for leave'}
      subtitle={onBehalf ? 'Applied on their behalf — notice periods don’t apply.' : 'It goes straight to your approver’s inbox.'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={submit.isPending} disabled={blocked} onClick={() => submit.mutate()}>
          {onBehalf && form.approve_now && can('leaves.approve') ? 'Record & approve' : 'Submit request'}
          {current?.ok && current.days > 0 ? ` · ${dayCount(current.days)}` : ''}
        </Button>
      </>}>
      <div className="space-y-5">
        <ErrorBanner error={submit.error} />

        {onBehalf && (
          <Field label="Employee" required>
            <EmployeePicker value={employee} onChange={(e) => { setEmployee(e); set({ leave_type_id: '' }) }} />
          </Field>
        )}

        {ready && (
          <Field label="Leave type" required>
            {loadingTypes ? <div className="flex justify-center py-6"><Spinner className="h-5 w-5" /></div> : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {types.map((row) => {
                  const active = String(row.leave_type.id) === String(form.leave_type_id)
                  const empty = !row.unlimited && row.available <= 0 && !row.leave_type.allow_negative
                  return (
                    <button key={row.leave_type.id} type="button" onClick={() => set({ leave_type_id: row.leave_type.id, half: form.half && row.leave_type.allow_half_day })}
                      className={cn('rounded-xl border px-3 py-2.5 text-left transition-all',
                        active ? 'border-blue-500 bg-blue-50 ring-3 ring-blue-500/15' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                        empty && !active && 'opacity-60')}>
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: typeColor(row.leave_type) }} />
                        <span className="truncate">{row.leave_type.name}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {row.unlimited ? (row.leave_type.paid ? 'No limit' : 'Unpaid') : `${num(row.available)} available`}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </Field>
        )}

        {selected && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={half ? 'Date' : 'From'} required>
                <Input type="date" value={form.start_date}
                  onChange={(e) => set({ start_date: e.target.value, end_date: form.end_date < e.target.value ? e.target.value : form.end_date })} />
              </Field>
              {!half && (
                <Field label="To" required>
                  <Input type="date" value={form.end_date} min={form.start_date} onChange={(e) => set({ end_date: e.target.value })} />
                </Field>
              )}
            </div>

            {selected.leave_type.allow_half_day && (
              <div className="flex flex-wrap items-center gap-4">
                <Toggle checked={!!form.half} onChange={(v) => set({ half: v })} label="Half day" />
                {half && (
                  <div className="flex rounded-xl bg-slate-100 p-0.5">
                    {[['first_half', 'First half'], ['second_half', 'Second half']].map(([key, label]) => (
                      <button key={key} type="button" onClick={() => set({ session: key })}
                        className={cn('rounded-lg px-3 py-1 text-xs font-semibold', form.session === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <QuotePanel quote={current} loading={quoting && !current} />

            {needsDocument && (
              <Field label="Supporting document" required hint="PDF or image, up to 5 MB — e.g. a medical certificate.">
                <label className={cn('flex cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm',
                  file ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-500 hover:bg-slate-50')}>
                  <Paperclip size={15} />
                  <span className="truncate">{file ? file.name : 'Choose a file…'}</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </Field>
            )}

            <Field label="Reason">
              <Textarea rows={2} value={form.reason} maxLength={1000} placeholder="A line for your approver (optional)"
                onChange={(e) => set({ reason: e.target.value })} />
            </Field>

            {onBehalf && can('leaves.approve') && (
              <Toggle checked={form.approve_now} onChange={(v) => set({ approve_now: v })}
                label="Approve immediately" description="Records it as approved by you. Turn off to send it through the normal approval steps." />
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function QuotePanel({ quote, loading }) {
  if (loading) return <div className="flex justify-center rounded-xl bg-slate-50 py-5"><Spinner className="h-5 w-5" /></div>
  if (!quote) return null

  const dates = Object.entries(quote.dates ?? {})

  return (
    <div className={cn('space-y-3 rounded-xl border p-4', quote.ok ? 'border-slate-200 bg-slate-50/70' : 'border-rose-200 bg-rose-50/60')}>
      {quote.days > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Leave days</p>
            <p className="text-2xl font-bold text-slate-900">{dayCount(quote.days)}</p>
          </div>
          {quote.balance && (
            <div className="text-right text-sm">
              <p className="text-slate-500">Available <span className="font-semibold text-slate-800">{num(quote.balance.available)}</span></p>
              <p className="text-slate-500">After this <span className={cn('font-semibold', quote.balance.after < 0 ? 'text-rose-600' : 'text-emerald-700')}>{num(quote.balance.after)}</span></p>
            </div>
          )}
        </div>
      )}

      {dates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dates.slice(0, 16).map(([date, fraction]) => (
            <span key={date} className="rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
              {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              {fraction < 1 && ' · ½'}
            </span>
          ))}
          {dates.length > 16 && <span className="px-1 py-1 text-[11px] text-slate-400">+{dates.length - 16} more</span>}
        </div>
      )}

      {quote.errors?.map((e) => (
        <p key={e} className="flex items-start gap-2 text-sm text-rose-700"><XCircle size={15} className="mt-0.5 shrink-0" />{e}</p>
      ))}
      {quote.warnings?.map((w) => (
        <p key={w} className="flex items-start gap-2 text-sm text-amber-700"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{w}</p>
      ))}
      {quote.ok && !quote.warnings?.length && (
        <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15} />Looks good — ready to submit.</p>
      )}
    </div>
  )
}
