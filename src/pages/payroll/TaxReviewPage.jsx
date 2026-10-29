import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Landmark, Check, X, RotateCcw } from 'lucide-react'
import { taxApi } from '@/lib/api/payroll'
import { apiError } from '@/lib/api/axios'
import { money, dateLabel } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Table, StatusPill, EmptyState, Modal, Field, Input, Textarea, ErrorBanner, Tabs } from '@/components/ui/kit'

const STATUS = { draft: ['slate', 'Draft'], submitted: ['amber', 'To review'], approved: ['green', 'Approved'], rejected: ['red', 'Returned'] }

/** HR: review employees' income-tax declarations. */
export default function TaxReviewPage() {
  const [status, setStatus] = useState('submitted')
  const [open, setOpen] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['tax-declarations', status],
    queryFn: () => taxApi.list(status ? { status } : {}).then((r) => r.data),
  })
  const counts = data?.counts ?? {}

  return (
    <div className="space-y-6">
      <PageHeader icon={Landmark} title="Tax declarations" subtitle={`Financial year ${data?.financial_year ?? ''} — approve declarations so TDS uses them from the next payroll.`} />
      <Card padded={false}>
        <div className="border-b border-slate-100 px-5 pt-2">
          <Tabs value={status} onChange={setStatus} tabs={[
            { key: 'submitted', label: 'To review' }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Returned' }, { key: 'draft', label: 'Drafts' }, { key: '', label: 'All' },
          ].map((t) => ({ ...t, count: t.key ? counts[t.key] : undefined }))} />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div> : (
          <Table rows={data?.data ?? []} onRowClick={setOpen} empty={<EmptyState icon={Landmark} title="Nothing here" description="Employees submit declarations from Payroll → Tax declaration." />}
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => <div><p className="font-medium text-slate-900">{r.employee_name}</p><p className="text-xs text-slate-400">{r.employee?.employee_code}</p></div> },
              { key: 'regime', label: 'Regime', render: (r) => (r.regime === 'old' ? 'Old' : 'New') },
              { key: 'declared_total', label: 'Deductions claimed', align: 'right', render: (r) => money(r.declared_total) },
              { key: 'approved_total', label: 'Approved', align: 'right', render: (r) => (r.approved_total != null ? money(r.approved_total) : '—') },
              { key: 'submitted_at', label: 'Submitted', render: (r) => dateLabel(r.submitted_at) },
              { key: 'status', label: 'Status', render: (r) => <StatusPill tone={STATUS[r.status][0]} label={STATUS[r.status][1]} /> },
            ]} />
        )}
      </Card>
      {open && <ReviewModal declaration={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ReviewModal({ declaration: d, onClose }) {
  const qc = useQueryClient()
  const [approved, setApproved] = useState(String(d.approved_total ?? d.declared_total))
  const [note, setNote] = useState(d.review_note ?? '')
  const done = () => { qc.invalidateQueries({ queryKey: ['tax-declarations'] }); onClose() }
  const review = useMutation({ mutationFn: (decision) => taxApi.review(d.id, { decision, approved_total: decision === 'approve' ? approved : undefined, note: note || undefined }), onSuccess: done })
  const reopen = useMutation({ mutationFn: () => taxApi.reopen(d.id), onSuccess: done })
  const lines = (d.items ?? []).filter((i) => i.declared > 0)

  return (
    <Modal title={`${d.employee_name} · FY ${d.financial_year}`} subtitle={`${d.regime === 'old' ? 'Old' : 'New'} regime`} onClose={onClose} size="lg"
      footer={d.status === 'submitted' ? (
        <>
          <Button variant="secondary" icon={X} loading={review.isPending && review.variables === 'reject'} onClick={() => review.mutate('reject')}>Return</Button>
          <Button icon={Check} loading={review.isPending && review.variables === 'approve'} onClick={() => review.mutate('approve')}>Approve</Button>
        </>
      ) : ['approved', 'rejected'].includes(d.status) ? <Button variant="secondary" icon={RotateCcw} loading={reopen.isPending} onClick={() => reopen.mutate()}>Reopen</Button> : null}>
      <div className="space-y-4">
        <Table rows={lines.map((l) => ({ ...l, id: l.section }))} empty={<p className="px-4 py-6 text-center text-xs text-slate-400">No deductions declared{d.regime === 'new' ? ' — new regime.' : '.'}</p>}
          columns={[
            { key: 'label', label: 'Section', render: (l) => <div><p className="text-slate-800">{l.label}</p>{l.note && <p className="text-xs text-slate-400">{l.note}</p>}</div> },
            { key: 'declared', label: 'Declared', align: 'right', render: (l) => money(l.declared) },
            { key: 'eligible', label: 'Counts', align: 'right', render: (l) => <span className="font-semibold">{money(l.eligible)}</span> },
          ]} />
        {d.status === 'submitted' && (
          <>
            {d.regime === 'old' && <Field label="Approve deductions of (₹)" hint="Lower it if some proofs are missing."><Input type="number" min={0} value={approved} onChange={(e) => setApproved(e.target.value)} /></Field>}
            <Field label="Note to the employee" hint="Required when returning."><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </>
        )}
        <ErrorBanner error={review.error ?? reopen.error} message={(review.error ?? reopen.error) ? apiError(review.error ?? reopen.error) : undefined} />
      </div>
    </Modal>
  )
}
