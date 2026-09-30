import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus } from 'lucide-react'
import { leaveApi } from '@/lib/api/leaves'
import { dateLabel } from '@/lib/format'
import { leaveRange, num } from '@/lib/leave'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Modal, Button, Field, Input, ErrorBanner, EmptyState } from '@/components/ui/kit'
import { LeaveTypeChip } from './BalanceCards'

/**
 * Every credit and debit behind one balance (accruals, carry forward,
 * leave taken, cancellations, adjustments), with a running total. Leave
 * managers can post an adjustment from here.
 */
export function LedgerModal({ balanceId, title, canAdjust = false, onClose }) {
  const qc = useQueryClient()
  const [adjusting, setAdjusting] = useState(false)
  const [form, setForm] = useState({ direction: 1, days: '1', note: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['leave-ledger', balanceId],
    queryFn: () => leaveApi.transactions(balanceId).then((r) => r.data),
    enabled: !!balanceId,
  })
  const balance = data?.balance
  // Running balance after each entry.
  const rows = (data?.data ?? []).reduce((acc, t) => {
    const before = acc.length ? acc[acc.length - 1].running : 0
    return [...acc, { ...t, running: before + Number(t.days) }]
  }, [])

  const adjust = useMutation({
    mutationFn: () => leaveApi.adjust({
      employee_id: balance.employee_id, leave_type_id: balance.leave_type_id, year: balance.year,
      days: form.direction * Number(form.days), note: form.note,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-ledger', balanceId] })
      qc.invalidateQueries({ queryKey: ['leave-summary'] })
      qc.invalidateQueries({ queryKey: ['leave-overview'] })
      setAdjusting(false)
      setForm({ direction: 1, days: '1', note: '' })
    },
  })

  return (
    <Modal size="lg" onClose={onClose}
      title={title ?? 'Leave balance history'}
      subtitle={balance ? `Leave year ${balance.year} · every credit and debit, oldest first` : undefined}
      footer={canAdjust && balance && !adjusting ? <Button variant="secondary" icon={Plus} onClick={() => setAdjusting(true)}>Adjust balance</Button> : undefined}>
      {isLoading ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div> : (
        <div className="space-y-4">
          {balance && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <LeaveTypeChip type={balance.leave_type} />
              <div className="flex gap-5 text-center text-xs text-slate-500">
                <div><p className="text-base font-bold text-slate-900">{num(balance.allocated)}</p>credited</div>
                <div><p className="text-base font-bold text-slate-900">{num(balance.used)}</p>used</div>
                {Number(balance.lapsed) + Number(balance.carried_forward) > 0 && (
                  <div><p className="text-base font-bold text-slate-900">{num(Number(balance.lapsed) + Number(balance.carried_forward))}</p>closed</div>
                )}
                <div><p className="text-base font-bold text-blue-700">{num(balance.balance)}</p>balance</div>
              </div>
            </div>
          )}

          {adjusting && (
            <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <ErrorBanner error={adjust.error} />
              <div className="grid gap-3 sm:grid-cols-[auto_110px_1fr]">
                <Field label="Type">
                  <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
                    {[[1, 'Credit', Plus], [-1, 'Debit', Minus]].map(([dir, label, Icon]) => (
                      <button key={dir} type="button" onClick={() => setForm({ ...form, direction: dir })}
                        className={cn('flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold',
                          form.direction === dir ? (dir > 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'text-slate-500')}>
                        <Icon size={13} />{label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Days"><Input type="number" min="0.5" step="0.5" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></Field>
                <Field label="Reason" required><Input value={form.note} placeholder="e.g. Comp-off for working on 15 Aug" onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAdjusting(false)}>Cancel</Button>
                <Button loading={adjust.isPending} disabled={!form.note.trim() || !(Number(form.days) > 0)} onClick={() => adjust.mutate()}>
                  {form.direction > 0 ? 'Credit' : 'Debit'} {form.days || 0} day(s)
                </Button>
              </div>
            </div>
          )}

          {rows.length === 0 ? <EmptyState title="No movements yet" description="Credits appear here as the leave policy adds them." /> : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Entry</th>
                    <th className="px-4 py-2.5 text-right">Days</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((t) => {
                    const positive = Number(t.days) >= 0
                    return (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{dateLabel(t.period ?? t.created_at)}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-800">{t.label}</p>
                          <p className="text-xs text-slate-500">
                            {t.leave ? leaveRange(t.leave, { year: true }) : t.note}
                            {t.creator && <span className="text-slate-400"> · by {t.creator.name}</span>}
                          </p>
                        </td>
                        <td className={cn('whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums', positive ? 'text-emerald-600' : 'text-rose-600')}>
                          {positive ? '+' : ''}{num(t.days)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-700">{num(t.running)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
