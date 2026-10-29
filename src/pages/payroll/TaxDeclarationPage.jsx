import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Landmark, Send, Save, CheckCircle2, AlertTriangle, Sparkles, FileDown } from 'lucide-react'
import { taxApi, saveBlob } from '@/lib/api/payroll'
import { complianceApi } from '@/lib/api/compliance'
import { apiError } from '@/lib/api/axios'
import { money, dateLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Input, Toggle, StatusPill, ErrorBanner, Select } from '@/components/ui/kit'

const STATUS = { draft: ['slate', 'Draft'], submitted: ['amber', 'With HR'], approved: ['green', 'Approved'], rejected: ['red', 'Returned'] }

/** The employee's income-tax regime and investment declarations for the year. */
export default function TaxDeclarationPage() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['my-tax'], queryFn: () => taxApi.mine().then((r) => r.data.data) })

  if (isLoading) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>
  if (error) return <ErrorBanner error={error} message={apiError(error)} />

  return <Declaration key={data.declaration?.updated_at ?? 'new'} data={data} onSaved={() => qc.invalidateQueries({ queryKey: ['my-tax'] })} />
}

/** The employee's own Form 16 Part B, for this or last financial year. */
function Form16Button({ financialYear }) {
  const start = Number(financialYear.slice(0, 4))
  const years = [financialYear, `${start - 1}-${String(start % 100).padStart(2, '0')}`]
  const [fy, setFy] = useState(years[1])
  const get = useMutation({
    mutationFn: () => complianceApi.myForm16({ financial_year: fy }).then((res) => saveBlob(res.data, `Form16-PartB-${fy}.pdf`, 'application/pdf')),
  })
  return (
    <div className="flex items-center gap-1.5">
      <Select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[14px]" value={fy} onChange={(e) => setFy(e.target.value)}>
        {years.map((y) => <option key={y} value={y}>FY {y}</option>)}
      </Select>
      <Button variant="secondary" icon={FileDown} loading={get.isPending} onClick={() => get.mutate()}>Form 16</Button>
      {get.error && <span className="text-xs text-rose-600">{get.error.response?.status === 422 ? 'No finalized payroll that year' : 'Couldn’t download'}</span>}
    </div>
  )
}

function Declaration({ data, onSaved }) {
  const d = data.declaration
  const locked = d?.status === 'approved' || d?.status === 'submitted'
  const [regime, setRegime] = useState(d?.regime ?? data.current_regime ?? 'new')
  const [metro, setMetro] = useState(Boolean(d?.items?.[0]?.metro))
  const [amounts, setAmounts] = useState(() => Object.fromEntries((d?.items ?? []).map((i) => [i.section, { amount: String(i.declared), note: i.note ?? '', senior: i.senior }])))
  const [live, setLive] = useState(null)
  const items = Object.entries(amounts).filter(([, v]) => Number(v.amount) > 0).map(([section, v]) => ({ section, amount: Number(v.amount), note: v.note || undefined, senior: v.senior || undefined }))

  // Re-evaluate caps and the regime comparison as amounts change.
  const itemsKey = JSON.stringify(items)
  useEffect(() => {
    const t = setTimeout(() => {
      taxApi.preview({ regime: 'old', metro, items }).then((r) => setLive(r.data.data)).catch(() => {})
    }, 350)
    return () => clearTimeout(t)
  }, [itemsKey, metro]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({ mutationFn: (submit) => taxApi.save({ regime, metro, items, submit }).then((r) => r.data), onSuccess: onSaved })
  const comparison = live?.comparison ?? data.comparison
  const eligible = Object.fromEntries((live?.evaluation?.lines ?? []).map((l) => [l.section, l.eligible]))
  const setAmount = (section, patch) => setAmounts((a) => ({ ...a, [section]: { amount: '', note: '', ...a[section], ...patch } }))

  return (
    <div className="space-y-6">
      <PageHeader icon={Landmark} title="Income tax declaration" subtitle={`Financial year ${data.financial_year} — choose your regime and declare investments so the right TDS is deducted each month.`}
        actions={<>
          <Form16Button financialYear={data.financial_year} />
          {d && <StatusPill tone={STATUS[d.status][0]} label={STATUS[d.status][1]} />}
        </>} />

      {d?.status === 'rejected' && d.review_note && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span><b>HR returned this:</b> {d.review_note}</span></div>
      )}
      {d?.status === 'approved' && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          Approved {dateLabel(d.reviewed_at)} — {d.regime === 'old' ? `${money(d.approved_total)} of deductions are` : 'the new regime is'} used for your TDS. Ask HR to reopen it to change anything.</div>
      )}

      {/* Regime choice with the comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        {['new', 'old'].map((r) => {
          const c = comparison[r]
          const better = comparison.better === r
          return (
            <button key={r} type="button" disabled={locked} onClick={() => setRegime(r)}
              className={cn('relative rounded-2xl border bg-white p-5 text-left transition-all disabled:cursor-default',
                regime === r ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300')}>
              {better && <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20"><Sparkles size={11} /> Lower tax</span>}
              <p className="text-lg font-semibold text-slate-900">{r === 'new' ? 'New regime' : 'Old regime'}</p>
              <p className="text-xs text-slate-500">{r === 'new' ? 'Lower slab rates; only the standard deduction' : 'Higher slab rates; claim 80C, 80D, HRA, home-loan interest…'}</p>
              <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-900">{money(c.annual_tax)}<span className="text-sm font-medium text-slate-400"> tax / year</span></p>
              <p className="text-xs text-slate-500">on {money(c.taxable_income)} taxable · standard deduction {money(c.standard_deduction)}{r === 'old' ? ` · deductions ${money(c.deductions)}` : ''}</p>
            </button>
          )
        })}
      </div>
      <p className="-mt-3 text-xs text-slate-500">Estimate on projected salary of {money(comparison.projected_gross)} for the year (current salary × 12). {comparison.saving > 0 && <>The {comparison.better} regime saves about <b>{money(comparison.saving)}</b>.</>}</p>

      {/* Sections */}
      <Card padded={false} className={cn(regime === 'new' && 'opacity-60')}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <p className="text-[16px] font-semibold text-slate-900">Investments & deductions</p>
            <p className="text-xs text-slate-500">{regime === 'new' ? 'Not used under the new regime — fill them in to compare.' : 'Annual amounts. Caps are applied for you.'}</p>
          </div>
          <Toggle checked={metro} onChange={setMetro} disabled={locked} label="I live in a metro city" description="Delhi, Mumbai, Kolkata or Chennai (50% HRA limit)" />
        </div>
        <div className="divide-y divide-slate-100">
          {data.sections.map((s) => {
            const v = amounts[s.key] ?? { amount: '', note: '' }
            return (
              <div key={s.key} className="grid items-center gap-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_160px_140px]">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-slate-800">{s.label}</p>
                  <p className="text-xs text-slate-500">{s.hint}{s.cap ? ` · up to ${money(s.cap)}` : ''}{s.senior_cap ? ` (${money(s.senior_cap)} senior citizen)` : ''}</p>
                  {s.senior_cap && (
                    <label className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" disabled={locked} checked={!!v.senior} onChange={(e) => setAmount(s.key, { senior: e.target.checked })} /> Senior citizen
                    </label>
                  )}
                </div>
                <Input type="number" min={0} disabled={locked} placeholder="0" value={v.amount} onChange={(e) => setAmount(s.key, { amount: e.target.value })} />
                <p className="text-right text-xs text-slate-500">Counts: <span className="font-semibold text-slate-900">{money(eligible[s.key] ?? 0)}</span></p>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="text-sm text-slate-600">Total deductions counted: <span className="font-semibold text-slate-900">{money(live?.evaluation?.total ?? d?.declared_total ?? 0)}</span></p>
        </div>
      </Card>

      <ErrorBanner error={save.error} message={save.error ? apiError(save.error) : undefined} />
      {save.data?.message && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15} />{save.data.message}</p>}
      {!locked && (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" icon={Save} loading={save.isPending && !save.variables} onClick={() => save.mutate(false)}>Save draft</Button>
          <Button icon={Send} loading={save.isPending && save.variables} onClick={() => save.mutate(true)}>Submit to HR</Button>
        </div>
      )}
    </div>
  )
}
