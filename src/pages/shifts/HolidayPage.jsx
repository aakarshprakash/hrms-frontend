import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Pencil, Trash2, Repeat, PartyPopper } from 'lucide-react'
import { holidayApi } from '@/lib/api/shifts'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { PageHeader, Card, CardHeader, Button, IconButton, Modal, Field, Input, Select, Toggle, EmptyState, ErrorBanner } from '@/components/ui/kit'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Holiday dates come back as ISO timestamps; the calendar day is the first ten characters.
const dayKey = (h) => String(h.date ?? '').slice(0, 10)
const asDate = (key) => new Date(`${key}T00:00:00`)

function buildCalendar(year, month, holidays) {
  const byDate = {}
  for (const h of holidays) byDate[dayKey(h)] = h
  const cells = Array.from({ length: new Date(year, month, 1).getDay() }, () => null)
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, date: key, dow: new Date(year, month, d).getDay(), holiday: byDate[key] ?? null })
  }
  return cells
}

function HolidayModal({ initial, branches, activeBranchId, onSave, onClose, saving, error }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial ? dayKey(initial) : '')
  const [branchId, setBranchId] = useState(initial?.branch_id ?? activeBranchId ?? '')
  const [recurring, setRecurring] = useState(initial?.recurring ?? false)

  function submit(e) {
    e.preventDefault()
    if (!name.trim() || !date || !branchId) return
    onSave({ name: name.trim(), date, branch_id: Number(branchId), recurring })
  }

  return (
    <Modal title={initial ? 'Edit holiday' : 'Add holiday'} subtitle="Check-ins on a holiday are flagged automatically." onClose={onClose} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="holiday-form" loading={saving}>{initial ? 'Save changes' : 'Add holiday'}</Button>
      </>}>
      <form id="holiday-form" onSubmit={submit} className="space-y-4">
        <ErrorBanner error={error} />
        <Field label="Holiday name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Diwali, Republic Day" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Branch" required>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        </div>
        <Toggle checked={recurring} onChange={setRecurring} label="Repeats every year" description="Carried forward to the same date next year." />
      </form>
    </Modal>
  )
}

/** The holiday calendar: a month view plus the list, managed by HR. */
export default function HolidayPage() {
  const qc = useQueryClient()
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const { canManageEmployees } = useRole()

  const now = new Date()
  const todayKey = now.toLocaleDateString('en-CA')
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [editing, setEditing] = useState(null) // null | 'new' | holiday
  const [filterBranch, setFilterBranch] = useState(activeBranch?.id ?? '')
  const { year, month } = cursor

  const shift = (n) => setCursor(({ year: y, month: m }) => { const d = new Date(y, m + n, 1); return { year: d.getFullYear(), month: d.getMonth() } })

  const { data: branchesRaw } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })
  const branches = Array.isArray(branchesRaw) ? branchesRaw : (branchesRaw?.data ?? [])

  // The whole year: the calendar shows the month, the lists show what's ahead and the year.
  const { data: holidayResp, isLoading } = useQuery({
    queryKey: ['holidays', year, filterBranch],
    queryFn: () => holidayApi.list({ year, ...(filterBranch ? { branch_id: filterBranch } : {}) }).then((r) => r.data),
    staleTime: 60_000,
  })
  const holidays = [...(holidayResp?.data ?? [])]
    .filter((h) => dayKey(h).startsWith(String(year)))
    .sort((a, b) => dayKey(a).localeCompare(dayKey(b)))
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const inMonth = holidays.filter((h) => dayKey(h).startsWith(monthPrefix))

  const done = () => { qc.invalidateQueries({ queryKey: ['holidays'] }); setEditing(null) }
  const createMut = useMutation({ mutationFn: (d) => holidayApi.create(d), onSuccess: done })
  const updateMut = useMutation({ mutationFn: ({ id, ...d }) => holidayApi.update(id, d), onSuccess: done })
  const deleteMut = useMutation({
    mutationFn: (id) => holidayApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })

  const cells = buildCalendar(year, month, inMonth)
  const monthName = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const upcoming = holidays.filter((h) => dayKey(h) >= todayKey)
  const branchName = (id) => branches.find((b) => b.id === id)?.name
  const remove = (h) => { if (confirm(`Delete "${h.name}"?`)) deleteMut.mutate(h.id) }

  return (
    <div>
      <PageHeader icon={CalendarDays} title="Holiday calendar"
        subtitle="Holidays feed attendance and payroll — check-ins on a holiday are flagged automatically."
        actions={<>
          {branches.length > 1 && (
            <Select className="w-auto min-w-44" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          {canManageEmployees && <Button icon={Plus} onClick={() => setEditing('new')}>Add holiday</Button>}
        </>} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">{monthName}</p>
              <p className="text-xs text-slate-500">{inMonth.length ? `${inMonth.length} holiday${inMonth.length === 1 ? '' : 's'} this month` : 'No holidays this month'}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => shift(-1)} aria-label="Previous month" />
              <Button variant="secondary" size="sm" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}>Today</Button>
              <Button variant="secondary" size="sm" icon={ChevronRight} onClick={() => shift(1)} aria-label="Next month" />
            </div>
          </div>

          {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> : (
            <div className="p-4">
              <div className="mb-2 grid grid-cols-7 gap-1.5">
                {DAY_NAMES.map((d) => <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((c, i) => {
                  if (!c) return <div key={`b${i}`} />
                  const weekend = c.dow === 0 || c.dow === 6
                  const today = c.date === todayKey
                  const clickable = c.holiday && canManageEmployees
                  return (
                    <div key={c.date} title={c.holiday?.name}
                      onClick={clickable ? () => setEditing(c.holiday) : undefined}
                      className={cn('relative flex min-h-[76px] flex-col rounded-lg p-2 ring-1 ring-inset transition-colors',
                        c.holiday ? 'bg-rose-50 ring-rose-200' : weekend ? 'bg-slate-50 ring-slate-100' : 'bg-white ring-slate-100',
                        clickable && 'cursor-pointer hover:bg-rose-100',
                        today && 'ring-2 ring-blue-500')}>
                      <span className={cn('text-[13px] font-semibold',
                        today ? 'text-blue-700' : c.holiday ? 'text-rose-700' : weekend ? 'text-slate-400' : 'text-slate-700')}>{c.day}</span>
                      {c.holiday && (
                        <span className="mt-auto line-clamp-2 text-[10.5px] font-medium leading-tight text-rose-700">{c.holiday.name}</span>
                      )}
                      {c.holiday?.recurring && <Repeat size={10} className="absolute right-1.5 top-2 text-rose-400" />}
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-rose-50 ring-1 ring-inset ring-rose-200" />Holiday{canManageEmployees && ' (click to edit)'}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-slate-50 ring-1 ring-inset ring-slate-200" />Weekend</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded ring-2 ring-blue-500" />Today</span>
                <span className="flex items-center gap-1.5"><Repeat size={10} className="text-rose-400" />Repeats yearly</span>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card padded={false}>
            <CardHeader icon={PartyPopper} title="Coming up" subtitle={year === now.getFullYear() ? 'Next holidays' : `From ${year}`} />
            {upcoming.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-slate-400">No more holidays in {year}.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcoming.slice(0, 5).map((h) => {
                  const d = asDate(dayKey(h))
                  return (
                    <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-rose-50 py-1 ring-1 ring-inset ring-rose-100">
                        <span className="text-[10px] font-semibold uppercase text-rose-500">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                        <span className="text-base font-semibold leading-5 text-rose-700">{d.getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-slate-900">{h.name}</p>
                        <p className="text-xs text-slate-500">{d.toLocaleDateString('en-IN', { weekday: 'long' })}{h.recurring && ' · yearly'}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card padded={false}>
            <CardHeader title={`All holidays in ${year}`} subtitle={`${holidays.length} holiday${holidays.length === 1 ? '' : 's'}`} />
            {holidays.length === 0 ? (
              <EmptyState icon={CalendarDays} title={`No holidays in ${year}`}
                action={canManageEmployees && <Button size="sm" variant="soft" icon={Plus} onClick={() => setEditing('new')}>Add holiday</Button>} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {holidays.map((h) => {
                  const d = asDate(dayKey(h))
                  return (
                    <li key={h.id} className="group flex items-center gap-3 px-5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-slate-800">
                          {h.name}{h.recurring && <Repeat size={11} className="shrink-0 text-slate-400" />}
                        </p>
                        <p className="text-xs text-slate-500">
                          {d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {!filterBranch && branchName(h.branch_id) && ` · ${branchName(h.branch_id)}`}
                        </p>
                      </div>
                      {canManageEmployees && (
                        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditing(h)} />
                          <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => remove(h)} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {editing && (
        <HolidayModal
          initial={editing === 'new' ? null : editing}
          branches={branches}
          activeBranchId={activeBranchId}
          saving={createMut.isPending || updateMut.isPending}
          error={createMut.error || updateMut.error}
          onSave={(d) => (editing === 'new' ? createMut.mutate(d) : updateMut.mutate({ id: editing.id, ...d }))}
          onClose={() => { setEditing(null); createMut.reset(); updateMut.reset() }}
        />
      )}
    </div>
  )
}
