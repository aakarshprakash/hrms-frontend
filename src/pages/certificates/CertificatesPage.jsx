import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, FileText, Pencil, Globe, Copy, Send, Award, Eye, Download, Check, X } from 'lucide-react'
import { certificateApi, openIssuedCertificatePdf } from '@/lib/api/certificates'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { dateLabel } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Button, Modal, Tabs, Table, StatusPill, EmptyState, Avatar } from '@/components/ui/kit'

const TYPE_LABELS = { experience: 'Experience', joining: 'Joining', salary_hike: 'Salary hike', relieving: 'Relieving', noc: 'NOC', custom: 'Custom' }
const typeLabel = (t) => TYPE_LABELS[t] ?? t
const loading = <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>

function useFlash() {
  const [flash, setFlash] = useState(null)
  const show = (msg, type = 'success') => { setFlash({ msg, type }); setTimeout(() => setFlash(null), 4000) }
  const node = flash && (
    <div className={flash.type === 'success'
      ? 'mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-700'
      : 'mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-700'}>{flash.msg}</div>
  )
  return [node, show]
}

function TemplatesTab({ templates, isLoading, notify, onRequest }) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['certificate-templates'] })
  const publish = useMutation({ mutationFn: (id) => certificateApi.publishTemplate(id), onSuccess: () => { refresh(); notify('Template published — employees can now request it.') } })
  const clone = useMutation({ mutationFn: (id) => certificateApi.cloneTemplate(id), onSuccess: () => { refresh(); notify('Template copied as a draft.') } })

  if (isLoading) return loading
  if (!templates.length) {
    return <Card><EmptyState icon={FileText} title="No templates yet" description="Design a letter once — joining, experience, relieving — and issue it to anyone in a click."
      action={<Link to="/certificates/templates/new"><Button icon={Plus}>New template</Button></Link>} /></Card>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((t) => {
        const published = t.status === 'published'
        return (
          <Card key={t.id} padded={false} className="flex flex-col">
            <div className="flex items-start gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100"><FileText size={18} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-500">{typeLabel(t.type)} letter</p>
              </div>
              <StatusPill status={published ? 'published' : 'draft'} />
            </div>
            <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
              <Link to={`/certificates/templates/${t.id}/edit`}><Button variant="secondary" size="sm" icon={Pencil}>Edit</Button></Link>
              {published
                ? <Button variant="soft" size="sm" icon={Send} onClick={() => onRequest(t)}>Request</Button>
                : <Button variant="soft" size="sm" icon={Globe} loading={publish.isPending && publish.variables === t.id} onClick={() => publish.mutate(t.id)}>Publish</Button>}
              <Button variant="ghost" size="sm" icon={Copy} onClick={() => clone.mutate(t.id)}>Duplicate</Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function PendingTab({ notify }) {
  const qc = useQueryClient()
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['cert-requests', 'pending'],
    queryFn: () => certificateApi.listRequests({ status: 'pending' }).then((r) => r.data?.data ?? []),
  })
  const done = (msg) => () => { qc.invalidateQueries({ queryKey: ['cert-requests'] }); notify(msg) }
  const approve = useMutation({ mutationFn: (id) => certificateApi.approveRequest(id), onSuccess: done('Certificate issued.'), onError: () => notify('Couldn’t issue the certificate.', 'error') })
  const reject = useMutation({ mutationFn: (id) => certificateApi.rejectRequest(id), onSuccess: done('Request declined.') })

  if (isLoading) return loading
  return (
    <Card padded={false}>
      <Table rows={requests} empty={<EmptyState icon={Award} title="No pending requests" description="Requests from employees show up here for you to issue." />}
        columns={[
          { key: 'employee', label: 'Employee', render: (r) => {
            const name = `${r.employee?.first_name ?? ''} ${r.employee?.last_name ?? ''}`.trim()
            return <div className="flex items-center gap-2.5"><Avatar name={name} size="sm" /><span className="font-medium text-slate-900">{name}</span></div>
          } },
          { key: 'template', label: 'Document', render: (r) => r.template?.name ?? '—' },
          { key: 'requested', label: 'Requested', render: (r) => dateLabel(r.created_at) },
          { key: 'actions', label: '', align: 'right', render: (r) => (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="success" icon={Check} loading={approve.isPending && approve.variables === r.id} onClick={() => approve.mutate(r.id)}>Issue</Button>
              <Button size="sm" variant="secondary" icon={X} onClick={() => reject.mutate(r.id)}>Decline</Button>
            </div>
          ) },
        ]} />
    </Card>
  )
}

function MyRequestsTab({ templates, onRequest }) {
  const user = useAuthStore((s) => s.user)
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['cert-requests', 'my', user?.employee_id],
    queryFn: () => certificateApi.listRequests({ employee_id: user?.employee_id }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })
  const available = templates.filter((t) => t.status === 'published')

  if (isLoading) return loading
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-[13px] font-semibold text-slate-700">Request a document</h2>
        {available.length === 0 ? (
          <Card><p className="text-center text-[13px] text-slate-500">HR hasn’t published any letters for request yet.</p></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {available.map((t) => (
              <button key={t.id} onClick={() => onRequest(t)}
                className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-xs transition-all hover:border-blue-300 hover:shadow-md">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><FileText size={17} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900 group-hover:text-blue-700">{t.name}</p>
                  <p className="text-xs text-slate-500">{typeLabel(t.type)}</p>
                </div>
                <Send size={15} className="text-slate-300 group-hover:text-blue-500" />
              </button>
            ))}
          </div>
        )}
      </div>
      <Card padded={false}>
        <div className="border-b border-slate-100 px-5 py-3.5"><h3 className="text-[15px] font-semibold text-slate-900">My requests</h3></div>
        <Table rows={requests} empty={<EmptyState icon={Send} title="No requests yet" />}
          columns={[
            { key: 'template', label: 'Document', render: (r) => <span className="font-medium text-slate-900">{r.template?.name}</span> },
            { key: 'date', label: 'Requested', render: (r) => dateLabel(r.created_at) },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
          ]} />
      </Card>
    </div>
  )
}

function IssuedTab({ employeeId }) {
  const { data: certs = [], isLoading } = useQuery({
    queryKey: ['issued-certificates', employeeId],
    queryFn: () => certificateApi.listIssued({ employee_id: employeeId }).then((r) => r.data?.data ?? []),
    enabled: !!employeeId,
  })
  if (isLoading) return loading
  return (
    <Card padded={false}>
      <Table rows={certs} empty={<EmptyState icon={Award} title="No documents issued to you yet" />}
        columns={[
          { key: 'name', label: 'Document', render: (c) => <span className="font-medium text-slate-900">{c.request?.template?.name ?? 'Certificate'}</span> },
          { key: 'number', label: 'Number', render: (c) => <span className="font-mono text-xs text-slate-600">{c.certificate_number}</span> },
          { key: 'issued', label: 'Issued', render: (c) => dateLabel(c.issued_at) },
          { key: 'actions', label: '', align: 'right', render: (c) => (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" icon={Eye} onClick={() => openIssuedCertificatePdf(c.id).catch(() => {})}>View</Button>
              <Button size="sm" icon={Download} onClick={() => openIssuedCertificatePdf(c.id, { download: true, filename: `${c.certificate_number}.pdf` }).catch(() => {})}>Download</Button>
            </div>
          ) },
        ]} />
    </Card>
  )
}

/** Letter templates (HR), requests and the documents issued to me. */
export default function CertificatesPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { can } = useRole()
  const isHR = can('certificates.manage')
  const [tab, setTab] = useState(isHR ? 'templates' : 'requests')
  const [requestTarget, setRequestTarget] = useState(null)
  const [flash, notify] = useFlash()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['certificate-templates'],
    queryFn: () => certificateApi.listTemplates().then((r) => r.data?.data ?? []),
  })
  const request = useMutation({
    mutationFn: (templateId) => certificateApi.submitRequest({ template_id: templateId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cert-requests'] }); setRequestTarget(null); notify('Request sent to HR.') },
    onError: () => notify('Couldn’t send the request.', 'error'),
  })

  const tabs = [
    ...(isHR ? [{ key: 'templates', label: 'Templates', count: templates.length }, { key: 'pending', label: 'Pending requests' }] : []),
    ...(user?.employee_id ? [{ key: 'requests', label: 'Request a document' }, { key: 'issued', label: 'My documents' }] : []),
  ]

  return (
    <div>
      <PageHeader icon={Award} title="Letters & certificates" subtitle="Joining, experience, relieving and custom letters — verifiable with a QR code."
        actions={isHR && <Link to="/certificates/templates/new"><Button icon={Plus}>New template</Button></Link>} />
      {flash}
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'templates' && isHR && <TemplatesTab templates={templates} isLoading={isLoading} notify={notify} onRequest={setRequestTarget} />}
      {tab === 'pending' && isHR && <PendingTab notify={notify} />}
      {tab === 'requests' && <MyRequestsTab templates={templates} onRequest={setRequestTarget} />}
      {tab === 'issued' && <IssuedTab employeeId={user?.employee_id} />}

      {requestTarget && (
        <Modal size="sm" title={`Request ${requestTarget.name}`} onClose={() => setRequestTarget(null)}
          footer={<><Button variant="secondary" onClick={() => setRequestTarget(null)}>Cancel</Button><Button icon={Send} loading={request.isPending} onClick={() => request.mutate(requestTarget.id)}>Send request</Button></>}>
          <p className="text-[13px] text-slate-600">HR reviews the request and issues the {typeLabel(requestTarget.type).toLowerCase()} letter. You’ll find it under <strong>My documents</strong> once issued.</p>
        </Modal>
      )}
    </div>
  )
}
