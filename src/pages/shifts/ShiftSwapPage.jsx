import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Plus, Check, X, Ban } from 'lucide-react'
import { shiftApi } from '@/lib/api/shifts'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Tabs, Modal, Field, Input, Select, StatusPill, EmptyState, ErrorBanner, Avatar } from '@/components/ui/kit'

const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
const name = (e) => (e ? `${e.first_name} ${e.last_name ?? ''}`.trim() : '—')

function stage(s) {
  if (s.status === 'approved') return ['approved', 'Approved']
  if (s.status === 'cancelled') return ['cancelled', 'Cancelled']
  if (s.target_response === 'declined') return ['rejected', `Declined by ${s.target_employee?.first_name}`]
  if (s.status === 'rejected') return ['rejected', 'Not approved']
  if (s.target_response === 'accepted') return ['pending', 'Accepted · awaiting approval']
  return ['pending', `Waiting for ${s.target_employee?.first_name}`]
}

/** Propose a swap, the colleague accepts, a shift manager approves -- then the rosters swap. */
export default function ShiftSwapPage() {
  const { can, user } = useRole()
  const isApprover = can('shifts.manage')
  const [tab, setTab] = useState('mine')
  const [requesting, setRequesting] = useState(false)

  const { data: mine = [], isLoading: loadingMine } = useQuery({
    queryKey: ['swaps', 'mine'],
    queryFn: () => shiftApi.listSwaps({ scope: 'mine' }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })
  const { data: queue = [], isLoading: loadingQueue } = useQuery({
    queryKey: ['swaps', 'approvals'],
    queryFn: () => shiftApi.listSwaps({ scope: 'approvals' }).then((r) => r.data?.data ?? []),
    enabled: isApprover,
  })

  const rows = tab === 'mine' ? mine : queue
  const loading = tab === 'mine' ? loadingMine : loadingQueue

  return (
    <div className="space-y-5">
      <PageHeader icon={ArrowLeftRight} title="Shift swaps"
        subtitle="Trade a working day with a colleague: they accept, a shift manager approves, and both rosters update."
        actions={user?.employee_id && <Button icon={Plus} onClick={() => setRequesting(true)}>Request a swap</Button>} />

      {isApprover && (
        <Tabs value={tab} onChange={setTab} tabs={[
          { key: 'mine', label: 'My swaps', count: mine.length },
          { key: 'approvals', label: 'To approve', count: queue.filter((s) => s.can_decide).length },
        ]} />
      )}

      {loading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : rows.length === 0 ? (
        <Card><EmptyState icon={ArrowLeftRight} title={tab === 'mine' ? 'No swaps yet' : 'Nothing to approve'}
          description={tab === 'mine' ? 'Need a day off? Offer your shift to a colleague and take one of theirs.' : 'Swaps appear here once the colleague has accepted.'} /></Card>
      ) : (
        <div className="space-y-3">{rows.map((s) => <SwapCard key={s.id} swap={s} myEmployeeId={user?.employee_id} />)}</div>
      )}

      {requesting && <RequestModal onClose={() => setRequesting(false)} myEmployeeId={user?.employee_id} />}
    </div>
  )
}

function SwapCard({ swap, myEmployeeId }) {
  const qc = useQueryClient()
  const [tone, label] = stage(swap)
  const iAsked = swap.requester_id === myEmployeeId
  const done = () => { qc.invalidateQueries({ queryKey: ['swaps'] }); qc.invalidateQueries({ queryKey: ['me-home'] }) }
  const act = useMutation({
    mutationFn: ({ kind }) => ({
      accept: () => shiftApi.respondSwap(swap.id, 'accepted'),
      decline: () => shiftApi.respondSwap(swap.id, 'declined'),
      cancel: () => shiftApi.cancelSwap(swap.id),
      approve: () => shiftApi.approveSwap(swap.id, {}),
      reject: () => shiftApi.rejectSwap(swap.id, {}),
    })[kind](),
    onSuccess: done,
  })

  const sameDay = swap.my_date === swap.their_date
  const describe = iAsked
    ? (sameDay ? `You swap shifts on ${fmt(swap.my_date)}` : `You give ${fmt(swap.my_date)} · you take ${fmt(swap.their_date)}`)
    : (sameDay ? `Swap shifts on ${fmt(swap.my_date)}` : `${swap.requester?.first_name} gives ${fmt(swap.my_date)} · takes ${fmt(swap.their_date)}`)

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <Avatar name={name(swap.requester)} className="ring-2 ring-white" />
            <Avatar name={name(swap.target_employee)} className="ring-2 ring-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{name(swap.requester)} <span className="text-slate-400">↔</span> {name(swap.target_employee)}</p>
            <p className="text-sm text-slate-600">{describe}</p>
            {swap.reason && <p className="text-xs text-slate-400">“{swap.reason}”</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={tone === 'pending' ? 'amber' : undefined} status={tone} label={label} />
          {swap.can_respond && <>
            <Button size="sm" variant="secondary" icon={X} loading={act.isPending && act.variables?.kind === 'decline'} onClick={() => act.mutate({ kind: 'decline' })}>Decline</Button>
            <Button size="sm" variant="success" icon={Check} loading={act.isPending && act.variables?.kind === 'accept'} onClick={() => act.mutate({ kind: 'accept' })}>Accept</Button>
          </>}
          {swap.can_cancel && <Button size="sm" variant="ghost" icon={Ban} onClick={() => act.mutate({ kind: 'cancel' })}>Cancel</Button>}
          {swap.can_decide && <>
            <Button size="sm" variant="secondary" icon={X} onClick={() => act.mutate({ kind: 'reject' })}>Reject</Button>
            <Button size="sm" variant="success" icon={Check} loading={act.isPending && act.variables?.kind === 'approve'} onClick={() => act.mutate({ kind: 'approve' })}>Approve</Button>
          </>}
        </div>
      </div>
      <ErrorBanner error={act.error} className="mt-3" />
    </Card>
  )
}

function RequestModal({ onClose, myEmployeeId }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ with_employee_id: '', my_date: '', their_date: '', reason: '' })
  const [sameDay, setSameDay] = useState(true)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const { data: colleagues = [] } = useQuery({
    queryKey: ['employees', 'swap-colleagues'],
    queryFn: () => shiftApi.swapColleagues().then((r) => r.data?.data ?? []),
  })

  const submit = useMutation({
    mutationFn: () => shiftApi.requestSwap({ ...form, their_date: sameDay ? form.my_date : form.their_date }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }); onClose() },
  })

  const ready = form.with_employee_id && form.my_date && (sameDay || form.their_date)

  return (
    <Modal title="Request a shift swap" subtitle="Your colleague gets a request to accept; then a shift manager approves." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={submit.isPending} disabled={!ready} onClick={() => submit.mutate()}>Send request</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={submit.error} />
        <Field label="Colleague" required>
          <Select value={form.with_employee_id} onChange={(e) => set({ with_employee_id: e.target.value })}>
            <option value="">Choose…</option>
            {colleagues.filter((c) => c.id !== myEmployeeId).map((c) => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.designation ?? c.employee_code}</option>
            ))}
          </Select>
        </Field>
        <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
          <button type="button" onClick={() => setSameDay(true)} className={`flex-1 rounded-lg px-3 py-1.5 ${sameDay ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Swap shifts on one day</button>
          <button type="button" onClick={() => setSameDay(false)} className={`flex-1 rounded-lg px-3 py-1.5 ${!sameDay ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Trade two days</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={sameDay ? 'Date' : 'Day I give'} required hint={sameDay ? 'You work their shift, they work yours.' : 'They work your shift this day.'}>
            <Input type="date" value={form.my_date} onChange={(e) => set({ my_date: e.target.value })} />
          </Field>
          {!sameDay && (
            <Field label="Day I take" required hint="You work their shift this day.">
              <Input type="date" value={form.their_date} onChange={(e) => set({ their_date: e.target.value })} />
            </Field>
          )}
        </div>
        <Field label="Reason"><Input value={form.reason} maxLength={500} placeholder="Optional" onChange={(e) => set({ reason: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
