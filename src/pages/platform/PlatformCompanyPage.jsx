import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Users, MapPin, LogIn, PauseCircle, PlayCircle, Ban, ShieldCheck } from 'lucide-react'
import { platformApi } from '@/lib/api/platform'
import SubscriptionPanel from './SubscriptionPanel'
import { enterSupportMode } from '@/lib/session'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, CardHeader, Button, Modal, Field, Textarea, StatusPill, StatCard, ErrorBanner, Table } from '@/components/ui/kit'

export default function PlatformCompanyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [statusModal, setStatusModal] = useState(null)
  const [reason, setReason] = useState('')
  const [entering, setEntering] = useState(false)

  const { data: company, isLoading } = useQuery({
    queryKey: ['platform-company', id],
    queryFn: () => platformApi.company(id).then((r) => r.data.data),
  })

  const statusMutation = useMutation({
    mutationFn: (payload) => platformApi.setStatus(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-company', id] })
      qc.invalidateQueries({ queryKey: ['platform-companies'] })
      qc.invalidateQueries({ queryKey: ['platform-stats'] })
      setStatusModal(null)
      setReason('')
    },
  })

  async function openSupport() {
    setEntering(true)
    try {
      await enterSupportMode(Number(id))
      navigate('/dashboard')
    } finally {
      setEntering(false)
    }
  }

  if (isLoading || !company) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>

  const statusActions = {
    active: [{ to: 'suspended', label: 'Suspend', icon: PauseCircle, variant: 'secondary' }, { to: 'cancelled', label: 'Close account', icon: Ban, variant: 'danger' }],
    suspended: [{ to: 'active', label: 'Reactivate', icon: PlayCircle, variant: 'success' }, { to: 'cancelled', label: 'Close account', icon: Ban, variant: 'danger' }],
    cancelled: [{ to: 'active', label: 'Reopen', icon: PlayCircle, variant: 'success' }],
  }[company.status] ?? []

  return (
    <div>
      <Link to="/platform" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> All organisations
      </Link>

      <PageHeader icon={Building2} title={company.name}
        subtitle={`${company.slug} · ${company.industry} · created ${new Date(company.created_at).toLocaleDateString()}`}
        actions={<>
          {statusActions.map((a) => (
            <Button key={a.to} variant={a.variant} icon={a.icon} onClick={() => setStatusModal(a)}>{a.label}</Button>
          ))}
          <Button icon={LogIn} loading={entering} disabled={company.status !== 'active'} onClick={openSupport}>Open in support mode</Button>
        </>}>
        <div className="mt-2"><StatusPill status={company.status} />
          {company.suspension_reason && <span className="ml-2 text-xs text-slate-500">Reason: {company.suspension_reason}</span>}
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Branches" value={company.branches_count} icon={MapPin} />
        <StatCard label="Active employees" value={company.active_employees_count} icon={Users} tone="purple" />
        <StatCard label="User accounts" value={company.users_count} icon={ShieldCheck} tone="teal" />
        <StatCard label="Last activity" value={company.last_activity_at ? new Date(company.last_activity_at).toLocaleDateString() : '—'} tone="slate" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padded={false}>
          <CardHeader title="Branches" icon={MapPin} />
          <Table columns={[
            { key: 'name', label: 'Branch' },
            { key: 'city', label: 'City', render: (b) => b.city ?? '—' },
            { key: 'employees_count', label: 'Employees', align: 'right' },
          ]} rows={company.branches ?? []} />
        </Card>
        <Card padded={false}>
          <CardHeader title="Tenant admins" icon={ShieldCheck} subtitle="Accounts with full control of this organisation" />
          <Table columns={[
            { key: 'name', label: 'Name', render: (u) => <div><p className="font-medium text-slate-800">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></div> },
            { key: 'last_login_at', label: 'Last sign-in', render: (u) => <span className="text-xs text-slate-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</span> },
            { key: 'is_active', label: 'Status', render: (u) => <StatusPill status={u.is_active ? 'active' : 'inactive'} /> },
          ]} rows={company.admins ?? []} />
        </Card>
      </div>

      <SubscriptionPanel companyId={id} />

      {statusModal && (
        <Modal size="sm" title={`${statusModal.label} ${company.name}?`} onClose={() => setStatusModal(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setStatusModal(null)}>Cancel</Button>
            <Button variant={statusModal.variant === 'danger' ? 'danger' : 'primary'} loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ status: statusModal.to, reason: reason || undefined })}>{statusModal.label}</Button>
          </>}>
          <div className="space-y-3">
            <ErrorBanner error={statusMutation.error} />
            <p className="text-sm text-slate-600">
              {statusModal.to === 'active'
                ? 'Users will be able to sign in again. No data was changed while it was inactive.'
                : 'Everyone in this organisation is signed out immediately and cannot sign in. Their data is kept intact.'}
            </p>
            {statusModal.to !== 'active' && (
              <Field label="Reason (internal)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Invoice overdue 30 days" /></Field>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
