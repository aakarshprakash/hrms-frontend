import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, FileText, Edit, Globe, Copy, Trash2, Send } from 'lucide-react'
import { certificateApi } from '@/lib/api/certificates'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const TYPE_LABELS = {
  experience: 'Experience', joining: 'Joining', salary_hike: 'Salary Hike',
  relieving: 'Relieving', noc: 'NOC', custom: 'Custom',
}

function TemplateCard({ template, onPublish, onClone, onDelete, onRequest }) {
  const isPublished = template.status === 'published'
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('h-2 w-2 rounded-full', isPublished ? 'bg-emerald-500' : 'bg-slate-300')} />
            <p className="text-sm font-semibold text-slate-900">{template.name}</p>
          </div>
          <p className="text-xs text-slate-500">{TYPE_LABELS[template.type] ?? template.type} Certificate</p>
        </div>
        <Badge label={isPublished ? 'Published' : 'Draft'} variant={isPublished ? 'active' : 'inactive'} />
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
        <Link to={`/certificates/templates/${template.id}/edit`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <Edit size={12} /> Edit
        </Link>
        {!isPublished && (
          <button onClick={() => onPublish(template.id)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
            <Globe size={12} /> Publish
          </button>
        )}
        {isPublished && (
          <button onClick={() => onRequest(template)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            <Send size={12} /> Request
          </button>
        )}
        <button onClick={() => onClone(template.id)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <Copy size={12} /> Clone
        </button>
      </div>
    </div>
  )
}

function RequestModal({ template, onClose, onSubmit }) {
  const [submitting, setSubmitting] = useState(false)
  async function handleSubmit() {
    setSubmitting(true)
    await onSubmit(template.id)
    setSubmitting(false)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="rounded-2xl border bg-white shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-2">Request Certificate</h3>
        <p className="text-sm text-slate-500 mb-4">
          You are requesting a <strong>{template.name}</strong>. HR will review and issue the certificate.
        </p>
        <div className="flex gap-3">
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {submitting && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            Submit Request
          </button>
          <button onClick={onClose} className="rounded-xl border px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function PendingRequestsPanel({ onRefresh }) {
  const qc = useQueryClient()
  const [toast, setToast] = useState(null)
  function notify(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['cert-requests', 'pending'],
    queryFn: () => certificateApi.listRequests({ status: 'pending' }).then((r) => r.data?.data ?? []),
  })

  const approveMutation = useMutation({
    mutationFn: (id) => certificateApi.approveRequest(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cert-requests'] }); notify('Certificate issued.') },
    onError: () => notify('Failed to issue.', 'error'),
  })

  const rejectMutation = useMutation({
    mutationFn: (id) => certificateApi.rejectRequest(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cert-requests'] }); notify('Request rejected.') },
  })

  if (isLoading) return <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
  if (!requests.length) return (
    <div className="rounded-2xl border border-dashed py-8 text-center text-sm text-slate-400">No pending certificate requests.</div>
  )

  return (
    <div className="space-y-3">
      {toast && (
        <div className={cn('rounded-xl px-4 py-3 text-sm font-medium',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.msg}
        </div>
      )}
      {requests.map((req) => (
        <div key={req.id} className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {req.employee?.first_name} {req.employee?.last_name}
            </p>
            <p className="text-xs text-slate-500">{req.template?.name} · Requested {new Date(req.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => approveMutation.mutate(req.id)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              Issue
            </button>
            <button onClick={() => rejectMutation.mutate(req.id)}
              className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CertificatesPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { hasRole } = useRole()
  const isHR = hasRole('hr') || hasRole('branch_admin') || hasRole('super_admin')
  const [tab, setTab] = useState(isHR ? 'templates' : 'requests')
  const [requestTarget, setRequestTarget] = useState(null)
  const [toast, setToast] = useState(null)

  function notify(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['certificate-templates'],
    queryFn: () => certificateApi.listTemplates().then((r) => r.data?.data ?? []),
  })

  const { data: myRequests = [], isLoading: myLoading } = useQuery({
    queryKey: ['cert-requests', 'my', user?.employee_id],
    queryFn: () => certificateApi.listRequests({ employee_id: user?.employee_id }).then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })

  const publishMutation = useMutation({
    mutationFn: (id) => certificateApi.publishTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificate-templates'] }); notify('Published!') },
  })

  const cloneMutation = useMutation({
    mutationFn: (id) => certificateApi.cloneTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificate-templates'] }); notify('Cloned.') },
  })

  const requestMutation = useMutation({
    mutationFn: (templateId) => certificateApi.submitRequest({ template_id: templateId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cert-requests'] }); notify('Request submitted.') },
    onError: () => notify('Request failed.', 'error'),
  })

  const tabs = [
    ...(isHR ? [{ key: 'templates', label: 'Templates' }, { key: 'pending', label: 'Pending Requests' }] : []),
    { key: 'requests', label: 'My Requests' },
    { key: 'issued', label: 'My Certificates' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Certificates</h1>
        {isHR && (
          <Link to="/certificates/templates/new"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20">
            <Plus size={16} /> New Template
          </Link>
        )}
      </div>

      {toast && (
        <div className={cn('rounded-xl px-4 py-3 text-sm font-medium',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Templates grid */}
      {tab === 'templates' && isHR && (
        isLoading ? <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div> : (
          templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-16 text-center">
              <FileText size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No templates yet.</p>
              <Link to="/certificates/templates/new" className="mt-3 inline-block text-sm text-blue-600 hover:underline">Create your first template</Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t}
                  onPublish={(id) => publishMutation.mutate(id)}
                  onClone={(id) => cloneMutation.mutate(id)}
                  onRequest={(tmpl) => setRequestTarget(tmpl)}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )
        )
      )}

      {/* Pending approval */}
      {tab === 'pending' && isHR && <PendingRequestsPanel />}

      {/* My requests */}
      {tab === 'requests' && (
        myLoading ? <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div> : (
          <div className="space-y-6">
            {/* Published templates to request from */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Available Certificate Types</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.filter((t) => t.status === 'published').map((t) => (
                  <button key={t.id} onClick={() => setRequestTarget(t)}
                    className="rounded-2xl border bg-white p-4 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all group">
                    <div className="flex items-center gap-2.5 mb-1">
                      <FileText size={16} className="text-blue-500" />
                      <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    </div>
                    <p className="text-xs text-slate-500">{TYPE_LABELS[t.type] ?? t.type}</p>
                    <p className="text-xs text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to request →</p>
                  </button>
                ))}
                {templates.filter((t) => t.status === 'published').length === 0 && (
                  <p className="text-sm text-slate-400 col-span-full py-4">No published certificate types available yet.</p>
                )}
              </div>
            </div>
            {/* Previous requests */}
            {myRequests.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-700 mb-3">My Requests</h2>
                <div className="space-y-2">
                  {myRequests.map((req) => (
                    <div key={req.id} className="rounded-xl border bg-white px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{req.template?.name}</p>
                        <p className="text-xs text-slate-400">{new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge label={req.status} variant={req.status === 'approved' ? 'active' : req.status === 'rejected' ? 'terminated' : 'default'} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* My issued certificates */}
      {tab === 'issued' && <IssuedCertsTab employeeId={user?.employee_id} />}

      {/* Request modal */}
      {requestTarget && (
        <RequestModal
          template={requestTarget}
          onClose={() => setRequestTarget(null)}
          onSubmit={(tid) => requestMutation.mutateAsync(tid)}
        />
      )}
    </div>
  )
}

function IssuedCertsTab({ employeeId }) {
  const { data: certs = [], isLoading } = useQuery({
    queryKey: ['issued-certificates', employeeId],
    queryFn: () => certificateApi.listIssued({ employee_id: employeeId }).then((r) => r.data?.data ?? []),
    enabled: !!employeeId,
  })

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>

  if (!certs.length) return (
    <div className="rounded-2xl border border-dashed py-16 text-center">
      <FileText size={32} className="mx-auto text-slate-300 mb-3" />
      <p className="text-sm text-slate-400">No issued certificates yet.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {certs.map((cert) => (
        <div key={cert.id} className="rounded-2xl border bg-white p-5 shadow-sm flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-slate-900">{cert.request?.template?.name ?? 'Certificate'}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{cert.certificate_number}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Issued {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : '—'}
            </p>
          </div>
          <div className="flex gap-2">
            <a href={certificateApi.issuedPdfUrl(cert.id)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              View PDF
            </a>
            <a href={certificateApi.issuedPdfUrl(cert.id)} download={`${cert.certificate_number}.pdf`}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20">
              Download
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
