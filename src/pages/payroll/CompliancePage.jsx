import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Landmark, Download, AlertTriangle, CalendarClock, ShieldCheck, HeartPulse, Receipt, FileSpreadsheet, FileText } from 'lucide-react'
import { complianceApi } from '@/lib/api/compliance'
import { saveBlob } from '@/lib/api/payroll'
import { useAuthStore } from '@/store/authStore'
import { money, number, MONTHS, dateLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Select, Tabs, Table, EmptyState, ErrorBanner } from '@/components/ui/kit'

const REPORTS = [
  { key: 'pf-ecr', label: 'PF ECR file', hint: 'Upload on the EPFO portal', icon: FileText, ext: 'txt' },
  { key: 'pf', label: 'PF register', hint: 'Member-wise contributions', icon: FileSpreadsheet },
  { key: 'esi', label: 'ESIC upload', hint: 'Monthly contribution template', icon: FileSpreadsheet },
  { key: 'pt', label: 'PT register', hint: 'Professional tax by employee', icon: FileSpreadsheet },
  { key: 'tds', label: 'TDS details', hint: 'Section 192, for Form 24Q', icon: FileSpreadsheet },
  { key: 'salary-register', label: 'Salary register', hint: 'Register of wages', icon: FileSpreadsheet },
]

function lastMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function daysUntil(date) {
  const ms = new Date(date + 'T23:59:59') - new Date()
  return Math.ceil(ms / 86400000)
}

/** Statutory compliance for a month: challans due, gaps to fix, and the upload files. */
export default function CompliancePage() {
  const branchId = useAuthStore((s) => s.activeBranchId)
  const [period, setPeriod] = useState(lastMonth)
  const params = { ...period, branch_id: branchId || undefined }
  const years = [period.year + 1, period.year, period.year - 1, period.year - 2].filter((y) => y <= new Date().getFullYear() + 1)

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['compliance-summary', params],
    queryFn: () => complianceApi.summary(params).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="space-y-5">
      <PageHeader icon={Landmark} title="Statutory compliance"
        subtitle="PF, ESI, professional tax and TDS for a month — from finalized payroll only."
        actions={(
          <div className="flex gap-2">
            <Select className="w-auto" value={period.month} onChange={(e) => setPeriod({ ...period, month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
            <Select className="w-auto" value={period.year} onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        )} />

      <ErrorBanner error={error} />

      {isLoading || !summary ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
        <>
          {summary.unfinalized_runs.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                Payroll isn’t finalized yet for {summary.unfinalized_runs.map((r) => r.branch).join(', ')} — those employees are left out until it is.{' '}
                <Link to="/payroll/runs" className="font-semibold underline">Go to payroll runs</Link>
              </div>
            </div>
          )}

          {summary.employees === 0 ? (
            <Card><EmptyState icon={Landmark} title={`No finalized payroll for ${summary.period.label}`}
              description="Process and finalize the month’s payroll; the statutory figures and files appear here." /></Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DueCard icon={ShieldCheck} tone="blue" title="Provident Fund" amount={summary.pf.total} due={summary.pf.due_date}
                  lines={[
                    ['Members', number(summary.pf.members)],
                    ['Employee share', money(summary.pf.employee_share)],
                    ['Employer EPF + EPS', money(summary.pf.employer_epf + summary.pf.employer_eps)],
                    ['EDLI + admin charges', money(summary.pf.edli_charges + summary.pf.admin_charges)],
                  ]}
                  warning={summary.pf.missing_uan.length > 0 && `${summary.pf.missing_uan.length} member(s) without a UAN are left out of the ECR: ${summary.pf.missing_uan.slice(0, 4).join(', ')}${summary.pf.missing_uan.length > 4 ? '…' : ''}`} />
                <DueCard icon={HeartPulse} tone="teal" title="ESI" amount={summary.esi.total} due={summary.esi.due_date}
                  lines={[
                    ['Insured persons', number(summary.esi.members)],
                    ['Employee share', money(summary.esi.employee_share, { paise: true })],
                    ['Employer share', money(summary.esi.employer_share, { paise: true })],
                  ]}
                  warning={summary.esi.missing_ip_number.length > 0 && `${summary.esi.missing_ip_number.length} employee(s) without an ESI IP number.`} />
                <DueCard icon={Receipt} tone="purple" title="Professional tax" amount={summary.pt.total}
                  lines={summary.pt.by_state.length ? summary.pt.by_state.map((s) => [`${s.state} (${s.employees})`, money(s.total)]) : [['No PT this month', '']]} />
                <DueCard icon={Landmark} tone="amber" title="TDS on salary" amount={summary.tds.total} due={summary.tds.due_date}
                  lines={[
                    ['Employees taxed', number(summary.tds.employees)],
                    ...(summary.tds.return_due ? [['24Q return due', dateLabel(summary.tds.return_due)]] : []),
                  ]}
                  warning={summary.tds.missing_pan.length > 0 && `${summary.tds.missing_pan.length} employee(s) with TDS but no PAN (higher TDS applies).`} />
              </div>

              <Card>
                <p className="mb-3 font-semibold text-slate-900">Files for {summary.period.label}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {REPORTS.map((r) => <DownloadTile key={r.key} report={r} params={params} />)}
                </div>
                <p className="mt-3 text-xs text-slate-400">Every download is recorded in the audit trail. PAN appears in full only for people allowed to see sensitive employee data.</p>
              </Card>

              <Previews params={params} />
            </>
          )}
        </>
      )}
    </div>
  )
}

const TONES = {
  blue: 'bg-blue-50 text-blue-600', teal: 'bg-teal-50 text-teal-600', purple: 'bg-purple-50 text-purple-600', amber: 'bg-amber-50 text-amber-600',
}

function DueCard({ icon: Icon, tone, title, amount, due, lines, warning }) {
  const left = due ? daysUntil(due) : null
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{money(amount)}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', TONES[tone])}><Icon size={19} /></div>
      </div>
      {due && (
        <p className={cn('mt-1 flex items-center gap-1.5 text-xs font-medium', left < 0 ? 'text-slate-400' : left <= 3 ? 'text-rose-600' : 'text-slate-500')}>
          <CalendarClock size={13} /> Due {dateLabel(due)}{left >= 0 && ` · ${left === 0 ? 'today' : `in ${left} day${left === 1 ? '' : 's'}`}`}
        </p>
      )}
      <dl className="mt-3 flex-1 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-800">{v}</dd></div>
        ))}
      </dl>
      {warning && <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{warning}</p>}
    </Card>
  )
}

function DownloadTile({ report, params }) {
  const Icon = report.icon
  const download = useMutation({
    mutationFn: () => complianceApi.download(report.key, params).then((res) => {
      const stamp = `${params.year}${String(params.month).padStart(2, '0')}`
      saveBlob(res.data, report.key === 'pf-ecr' ? `ECR_${stamp}.txt` : `${report.key}-${stamp}.csv`, res.data.type)
    }),
  })
  return (
    <button onClick={() => download.mutate()} disabled={download.isPending}
      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-60">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {download.isPending ? <Spinner className="h-4 w-4" /> : <Icon size={17} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{report.label}</span>
        <span className="block truncate text-xs text-slate-500">{download.isError ? 'Could not download — try again' : report.hint}</span>
      </span>
      <Download size={15} className="text-slate-400" />
    </button>
  )
}

const PREVIEW_COLUMNS = {
  pf: [
    ['employee_code', 'Code'], ['uan', 'UAN'], ['name', 'Member'], ['epf_wages', 'EPF wages', 'num'], ['eps_wages', 'EPS wages', 'num'],
    ['epf_contribution', 'EE share', 'num'], ['eps_contribution', 'EPS', 'num'], ['epf_eps_difference', 'ER EPF', 'num'], ['ncp_days', 'NCP days', 'num'],
  ],
  esi: [['employee_code', 'Code'], ['ip_number', 'IP number'], ['ip_name', 'Name'], ['days', 'Days', 'num'], ['wages', 'Wages', 'num'],
    ['employee_contribution', 'EE (0.75%)', 'money'], ['employer_contribution', 'ER (3.25%)', 'money']],
  pt: [['employee_code', 'Code'], ['name', 'Name'], ['state', 'State'], ['gross', 'Gross', 'money'], ['professional_tax', 'PT', 'money']],
  tds: [['employee_code', 'Code'], ['name', 'Name'], ['pan', 'PAN'], ['amount_paid', 'Paid / credited', 'money'], ['tds', 'TDS', 'money'], ['tax_regime', 'Regime']],
}

function Previews({ params }) {
  const [tab, setTab] = useState('pf')
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-preview', tab, params],
    queryFn: () => complianceApi.preview(tab, params).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  })

  const columns = (PREVIEW_COLUMNS[tab] ?? []).map(([key, label, kind]) => ({
    key, label, align: kind ? 'right' : undefined,
    render: (row) => {
      const v = row[key]
      if (v === null || v === undefined || v === '') return <span className="text-rose-500">missing</span>
      return kind === 'money' ? money(v, { paise: true }) : kind === 'num' ? number(v) : v
    },
  }))

  return (
    <Card padded={false}>
      <div className="border-b border-slate-100 px-4 py-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'pf', label: 'PF' }, { key: 'esi', label: 'ESI' }, { key: 'pt', label: 'Professional tax' }, { key: 'tds', label: 'TDS' }]} />
      </div>
      {isLoading || !Array.isArray(data) ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div> : (
        <Table rows={data.map((r, i) => ({ ...r, _k: `${r.employee_code}-${i}` }))} rowKey="_k" columns={columns}
          empty={<EmptyState title="Nobody in this return this month" />} />
      )}
    </Card>
  )
}
