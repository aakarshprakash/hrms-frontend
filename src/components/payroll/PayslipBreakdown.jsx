import { AlertTriangle, Info } from 'lucide-react'
import { money, days } from '@/lib/format'

/**
 * A payslip's figures, for either breakdown version the API may return:
 * v2 (current engine: earned vs rate, attendance, statutory, employer cost)
 * or v1 (older payslips: earnings, deductions, LOP as a deduction).
 */
export default function PayslipBreakdown({ row }) {
  const b = row.breakdown_json ?? {}
  const v2 = (b.version ?? 1) >= 2
  const att = b.attendance

  const earnings = v2
    ? (b.earnings ?? []).map((e) => ({ name: e.name, rate: e.monthly, amount: e.earned, note: e.note }))
    : [
        ...(b.earnings ?? []).map((e) => ({ name: e.name, amount: e.amount, note: e.note })),
        ...(Number(b.ot_pay) > 0 ? [{ name: 'Overtime', amount: b.ot_pay }] : []),
      ]

  const deductions = v2
    ? (b.deductions ?? []).map((d) => ({ name: d.name, amount: d.amount, note: d.note }))
    : [
        ...(b.deductions ?? []).map((d) => ({ name: d.name, amount: d.amount, note: d.note })),
        ...(b.statutory_deductions ?? []).map((s) => ({ name: { PF: 'Provident Fund', ESI: 'ESI', TAX: 'Income Tax (TDS)' }[s.rule_type] ?? s.rule_type, amount: s.amount })),
        ...(Number(b.lop?.amount) > 0 ? [{ name: `Loss of pay (${b.lop.days} days)`, amount: b.lop.amount }] : []),
      ]

  const gross = row.gross_pay
  const totalDeductions = row.total_deductions
  const net = row.net_pay
  const warnings = row.warnings ?? b.warnings ?? []
  const tds = b.statutory?.tds

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warnings.map((w) => <p key={w} className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{w}</p>)}
        </div>
      )}

      {(att || row.payable_days !== undefined) && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            ['Pay days', att?.basis_days ?? row.days_in_period],
            ['Payable', att?.payable_days ?? row.payable_days],
            ['LOP', att?.lop_days ?? row.lop_days],
            ['Absent', att?.absent_days],
            ['Half days', att?.half_days],
            ['Late marks', att?.late_marks],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-3 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="text-base font-bold text-slate-800">{days(value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <LineTable title="Earnings" rows={earnings} total={gross} totalLabel="Gross earnings" tone="emerald" showRate={v2} />
        <LineTable title="Deductions" rows={deductions} total={totalDeductions} totalLabel="Total deductions" tone="rose" />
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white">
        <span className="text-sm font-medium text-slate-300">Net pay</span>
        <span className="text-2xl font-bold">{money(net, { paise: true })}</span>
      </div>

      {v2 && (b.employer_contributions ?? []).length > 0 && (
        <LineTable title="Employer contributions" rows={b.employer_contributions} total={b.totals?.employer_cost} totalLabel="Cost to company" tone="slate" />
      )}

      {tds?.mode === 'income_tax' && (
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <Info size={13} className="mt-0.5 shrink-0" />
          TDS ({tds.regime} regime): projected taxable income {money(tds.taxable_income)}, annual tax {money(tds.annual_tax)},
          deducted so far {money(tds.tds_to_date)}, spread over {tds.months_remaining} remaining month(s).
        </p>
      )}
    </div>
  )
}

function LineTable({ title, rows, total, totalLabel, tone, showRate }) {
  const tones = { emerald: 'text-emerald-700', rose: 'text-rose-700', slate: 'text-slate-700' }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${tones[tone]}`}>{title}</span>
        {showRate && <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rate · Earned</span>}
      </div>
      <div className="divide-y divide-slate-50">
        {rows.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">None</p>}
        {rows.map((r, i) => (
          <div key={`${r.name}-${i}`} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
            <div className="min-w-0">
              <p className="text-slate-700">{r.name}</p>
              {r.note && <p className="text-[11px] text-slate-400">{r.note}</p>}
            </div>
            <div className="text-right">
              {showRate && r.rate !== null && r.rate !== undefined && Number(r.rate) !== Number(r.amount) && (
                <span className="mr-2 text-xs text-slate-400 line-through">{money(r.rate)}</span>
              )}
              <span className="font-medium text-slate-900">{money(r.amount, { paise: true })}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold">
        <span>{totalLabel}</span>
        <span>{money(total, { paise: true })}</span>
      </div>
    </div>
  )
}
