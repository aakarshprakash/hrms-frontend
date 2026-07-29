import { useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Pencil, UserX, Upload, FileText, X, Camera,
  Mail, Phone, Landmark, PhoneCall, User, Briefcase,
  Building2, CalendarDays, Wallet, FolderOpen, Clock, StickyNote,
  Users as UsersIcon,
} from 'lucide-react'
import { employeeApi } from '@/lib/api/employees'
import { attendanceApi } from '@/lib/api/attendance'
import { leaveApi } from '@/lib/api/leaves'
import { payrollApi, salaryApi, openPayslipPdf } from '@/lib/api/payroll'
import { shiftApi } from '@/lib/api/shifts'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const BASE_TABS = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'documents', label: 'Documents', icon: FolderOpen },
  { key: 'attendance', label: 'Attendance', icon: Clock },
  { key: 'leave', label: 'Leave', icon: CalendarDays },
]

const STATUS_PILL = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  inactive: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  terminated: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}

const STATUS_DOT = {
  active: 'bg-emerald-500',
  inactive: 'bg-amber-500',
  terminated: 'bg-rose-500',
}

function fmtDate(d) {
  if (!d) return null
  const date = new Date(d)
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(d) {
  return d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
}

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const { canManageEmployees, isSuperAdmin, hasRole, can } = useRole()
  const [activeTab, setActiveTab] = useState('overview')
  const [uploading, setUploading] = useState(false)
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const avatarInputRef = useRef(null)

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeApi.get(id).then((r) => r.data.data),
  })

  const { data: shiftAssignment } = useQuery({
    queryKey: ['employee-shift', id],
    queryFn: () => shiftApi.employeeAssignments(id).then((r) => r.data?.data?.current ?? null),
  })

  const { data: docsData, refetch: refetchDocs } = useQuery({
    queryKey: ['employee-docs', id],
    queryFn: () => employeeApi.listDocuments(id).then((r) => r.data?.data ?? r.data ?? []),
    enabled: activeTab === 'documents',
  })

  const { data: attendanceData, isLoading: loadingAttendance } = useQuery({
    queryKey: ['employee-attendance', id],
    queryFn: () => attendanceApi.list({ employee_id: id, per_page: 30 }).then((r) => r.data),
    enabled: activeTab === 'attendance',
  })

  const { data: leaveData, isLoading: loadingLeave } = useQuery({
    queryKey: ['employee-leaves', id],
    queryFn: () => leaveApi.list({ employee_id: id }).then((r) => r.data),
    enabled: activeTab === 'leave',
  })

  const { data: payslipData, isLoading: loadingPayroll } = useQuery({
    queryKey: ['employee-payslips', id],
    queryFn: () => payrollApi.listPayslips({ employee_id: id }).then((r) => r.data),
    enabled: activeTab === 'payroll',
  })

  const { data: salaryData, isLoading: loadingSalary } = useQuery({
    queryKey: ['employee-salary-structure', id],
    queryFn: () => salaryApi.listStructures({ employee_id: id }).then((r) => r.data?.data ?? []),
    enabled: activeTab === 'payroll',
  })

  const terminateMutation = useMutation({
    mutationFn: () => employeeApi.terminate(id),
    onSuccess: () => navigate('/employees'),
  })

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('avatar', file)
    try {
      await employeeApi.uploadAvatar(id, fd)
      qc.invalidateQueries({ queryKey: ['employee', id] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    } finally {
      e.target.value = ''
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', 'general')
    setUploading(true)
    try {
      await employeeApi.uploadDocument(id, fd)
      refetchDocs()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDeleteDoc(mediaId) {
    await employeeApi.deleteDocument(id, mediaId)
    refetchDocs()
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
  if (!emp) return <p className="py-20 text-center text-slate-400">Employee not found.</p>

  const tenure = emp.date_of_joining
    ? Math.floor((Date.now() - new Date(emp.date_of_joining).getTime()) / (365.25 * 24 * 3600 * 1000) * 10) / 10
    : null

  // Salary is sensitive: branch admin/HR/super admin can see it for anyone in
  // their branch, and an employee can always see their own — but a manager
  // or coworker viewing someone else's profile should not.
  const canManageSalary = isSuperAdmin || hasRole('branch_admin', 'hr') || can('payroll.manage')
  const canViewSalary = canManageSalary || can('payroll.view') || currentUser?.employee_id === emp.id

  const TABS = canViewSalary
    ? [...BASE_TABS, { key: 'payroll', label: 'Payroll', icon: Wallet }]
    : BASE_TABS

  return (
    <div className="mx-auto max-w-7xl">
      {/* Breadcrumb bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/employees')}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft size={15} /> All Employees
        </button>
        {canManageEmployees && (
          <div className="flex gap-2">
            <Link
              to={`/employees/${emp.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98]"
            >
              <Pencil size={13} /> Edit Profile
            </Link>
            {isSuperAdmin && emp.status !== 'terminated' && (
              <button
                onClick={() => { if (window.confirm(`Terminate ${emp.first_name} ${emp.last_name}? Their status will be set to terminated.`)) terminateMutation.mutate() }}
                disabled={terminateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2 text-[13px] font-semibold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-40"
              >
                <UserX size={13} /> Terminate
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ══ Left: profile sidebar ══════════════════════ */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Identity card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="h-20 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600" />
            <div className="px-5 pb-5">
              <div className="relative -mt-10 mb-3 inline-block">
                {emp.avatar_url ? (
                  <img src={emp.avatar_url} alt={emp.full_name}
                    className="h-20 w-20 rounded-2xl border-4 border-white bg-white object-cover shadow-md" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white shadow-md">
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </div>
                )}
                {canManageEmployees && (
                  <>
                    <button onClick={() => avatarInputRef.current?.click()}
                      className="absolute -bottom-1.5 -right-1.5 rounded-full bg-slate-900 p-1.5 text-white shadow-lg transition-transform hover:scale-110"
                      title="Change photo">
                      <Camera size={11} />
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </>
                )}
              </div>

              <h1 className="text-lg font-bold tracking-tight text-slate-900">{emp.first_name} {emp.last_name}</h1>
              <p className="text-[13px] font-medium text-slate-500">{emp.designation?.title ?? 'No designation'}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset',
                  STATUS_PILL[emp.status] ?? 'bg-slate-50 text-slate-600 ring-slate-500/20'
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[emp.status] ?? 'bg-slate-400')} />
                  {emp.status}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-500">
                  {emp.employee_code}
                </span>
              </div>

              {/* Quick contact actions */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a href={`mailto:${emp.email}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700">
                  <Mail size={13} /> Email
                </a>
                <a href={emp.phone ? `tel:${emp.phone}` : undefined}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-[12px] font-semibold transition-colors',
                    emp.phone ? 'text-slate-700 hover:bg-blue-50 hover:text-blue-700' : 'cursor-default text-slate-300'
                  )}>
                  <Phone size={13} /> Call
                </a>
              </div>
            </div>
          </div>

          {/* At-a-glance card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">At a Glance</p>
            <div className="space-y-3">
              <GlanceRow icon={Building2} label="Branch" value={emp.branch?.name} />
              <GlanceRow icon={UsersIcon} label="Department" value={emp.department?.name} />
              <GlanceRow icon={Briefcase} label="Employment" value={emp.employment_type?.replace(/_/g, ' ')} capitalize />
              <GlanceRow icon={CalendarDays} label="Joined" value={fmtDate(emp.date_of_joining)} sub={tenure != null ? `${tenure} yrs with the company` : null} />
              <GlanceRow
                icon={User}
                label="Reports to"
                value={emp.reporting_manager ? `${emp.reporting_manager.first_name} ${emp.reporting_manager.last_name}` : 'No manager'}
                link={emp.reporting_manager ? `/employees/${emp.reporting_manager.id}` : null}
              />
            </div>
          </div>

          {/* Direct reports */}
          {(emp.direct_reports?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Direct Reports · {emp.direct_reports.length}
              </p>
              <div className="space-y-1">
                {emp.direct_reports.map((r) => (
                  <Link key={r.id} to={`/employees/${r.id}`}
                    className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-blue-50/60">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white">
                      {r.first_name?.[0]}{r.last_name?.[0]}
                    </span>
                    <span className="text-[13px] font-medium text-slate-700 group-hover:text-blue-700">
                      {r.first_name} {r.last_name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ══ Right: tabbed content ══════════════════════ */}
        <div className="min-w-0">
          {/* Tabs */}
          <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all',
                  activeTab === key
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <DetailCard icon={User} title="Personal Information">
                <FieldGrid fields={[
                  ['Full Name', `${emp.first_name} ${emp.last_name}`],
                  ['Date of Birth', fmtDate(emp.date_of_birth)],
                  ['Gender', emp.gender, true],
                  ['Marital Status', emp.marital_status, true],
                  ['Blood Group', emp.blood_group],
                  ['Nationality', emp.nationality],
                  ['National ID', emp.national_id],
                  ['Tax ID (PAN)', emp.tax_id],
                ]} />
              </DetailCard>

              <DetailCard icon={Mail} title="Contact & Address">
                <FieldGrid fields={[
                  ['Work Email', emp.email],
                  ['Personal Email', emp.personal_email],
                  ['Phone', emp.phone],
                  ['Address', [emp.address_line1, emp.address_line2].filter(Boolean).join(', ') || null],
                  ['City / State', [emp.city, emp.state].filter(Boolean).join(', ') || null],
                  ['Country / Postal Code', [emp.country, emp.postal_code].filter(Boolean).join(' — ') || null],
                ]} />
              </DetailCard>

              <DetailCard icon={Briefcase} title="Employment Details">
                <FieldGrid fields={[
                  ['Employee Code', emp.employee_code],
                  ['Biometric Device Code', emp.biometric_emp_code],
                  ['Branch', emp.branch?.name],
                  ['Department', emp.department?.name],
                  ['Designation', emp.designation?.title],
                  ['Employment Type', emp.employment_type?.replace(/_/g, ' '), true],
                  ['Date of Joining', fmtDate(emp.date_of_joining)],
                  ['Probation Ends', fmtDate(emp.probation_end_date)],
                  ['Notice Period', emp.notice_period_days != null ? `${emp.notice_period_days} days` : null],
                  ['Work Location', emp.work_location],
                  ['Reporting Manager', emp.reporting_manager ? `${emp.reporting_manager.first_name} ${emp.reporting_manager.last_name}` : null],
                ]} />
              </DetailCard>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Clock size={15} />
                    </div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Work Shift</h3>
                  </div>
                  {canManageEmployees && (
                    <button onClick={() => setShiftModalOpen(true)}
                      className="text-[12px] font-semibold text-blue-600 hover:underline">
                      {shiftAssignment ? 'Change Shift' : 'Assign Shift'}
                    </button>
                  )}
                </div>
                {shiftAssignment ? (
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
                    <p className="text-[14px] font-bold text-slate-800">{shiftAssignment.shift.name}</p>
                    <p className="text-[13px] text-slate-500">
                      {shiftAssignment.shift.start_time?.slice(0, 5)} – {shiftAssignment.shift.end_time?.slice(0, 5)}
                    </p>
                    <p className="text-[12px] text-slate-400">Since {fmtDate(shiftAssignment.effective_from)}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] text-slate-400">
                    No shift assigned — attendance won't be checked for lateness until one is set.
                  </p>
                )}
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <DetailCard icon={Landmark} title="Bank & Payment">
                  <FieldGrid cols={1} fields={[
                    ['Payment Method', emp.payment_method?.replace(/_/g, ' '), true],
                    ['Bank', [emp.bank_name, emp.bank_branch].filter(Boolean).join(' — ') || null],
                    ['Account Number', emp.bank_account_number],
                    ['IFSC / Routing Code', emp.bank_ifsc_code],
                  ]} />
                </DetailCard>

                <DetailCard icon={PhoneCall} title="Emergency Contact">
                  <FieldGrid cols={1} fields={[
                    ['Name', emp.emergency_contact_name],
                    ['Phone', emp.emergency_contact_phone],
                    ['Relationship', emp.emergency_contact_relation, true],
                  ]} />
                </DetailCard>
              </div>

              {emp.notes && canManageEmployees && (
                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <StickyNote size={14} className="text-amber-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">HR Notes — internal only</p>
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{emp.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Documents ── */}
          {activeTab === 'documents' && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <SectionTitle icon={FolderOpen} title="Documents" />
                {canManageEmployees && (
                  <label className={cn(
                    'inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700',
                    uploading && 'cursor-not-allowed opacity-60'
                  )}>
                    {uploading ? <Spinner className="h-3.5 w-3.5 border-white border-t-transparent" /> : <Upload size={13} />}
                    Upload
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                )}
              </div>
              <div className="space-y-2">
                {(Array.isArray(docsData) ? docsData : []).length === 0 && (
                  <EmptyState icon={FolderOpen} text="No documents uploaded yet." />
                )}
                {(Array.isArray(docsData) ? docsData : []).map((doc) => (
                  <div key={doc.id}
                    className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:border-blue-100 hover:bg-blue-50/40">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-500 shadow-sm">
                      <FileText size={15} />
                    </div>
                    <a href={doc.original_url} target="_blank" rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700 hover:text-blue-700 hover:underline">
                      {doc.file_name}
                    </a>
                    <span className="text-[11px] text-slate-400">{(doc.size / 1024).toFixed(1)} KB</span>
                    {canManageEmployees && (
                      <button onClick={() => handleDeleteDoc(doc.id)}
                        className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Attendance ── */}
          {activeTab === 'attendance' && (
            <DataTableCard
              icon={Clock}
              title="Recent Attendance"
              loading={loadingAttendance}
              headers={['Date', 'Check In', 'Check Out', 'Hours', 'Status']}
              empty="No attendance records yet."
              rows={(attendanceData?.data ?? []).map((a) => [
                <span key="d" className="font-medium text-slate-800">{fmtDate(a.date)}</span>,
                fmtTime(a.check_in),
                fmtTime(a.check_out),
                a.worked_minutes != null ? `${Math.round(a.worked_minutes / 60 * 10) / 10}h` : '—',
                <div key="s" className="flex items-center gap-1.5">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset', {
                    'bg-emerald-50 text-emerald-700 ring-emerald-600/20': a.status === 'present',
                    'bg-amber-50 text-amber-700 ring-amber-600/20': a.status === 'late',
                    'bg-rose-50 text-rose-700 ring-rose-600/20': a.status === 'absent',
                    'bg-blue-50 text-blue-700 ring-blue-600/20': a.status === 'half_day',
                  })}>
                    {a.status?.replace('_', ' ')}
                  </span>
                  {a.late_by_minutes > 0 && <span className="text-[10px] font-medium text-amber-600">+{a.late_by_minutes}m</span>}
                </div>,
              ])}
            />
          )}

          {/* ── Leave ── */}
          {activeTab === 'leave' && (
            <DataTableCard
              icon={CalendarDays}
              title="Leave History"
              loading={loadingLeave}
              headers={['Type', 'From', 'To', 'Days', 'Status', 'Reason']}
              empty="No leave records yet."
              rows={(leaveData?.data ?? []).map((l) => [
                <span key="t" className="font-medium text-slate-800">{l.leave_type?.name ?? '—'}</span>,
                fmtDate(l.start_date),
                fmtDate(l.end_date),
                l.days_requested ?? '—',
                <span key="s" className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset', {
                  'bg-emerald-50 text-emerald-700 ring-emerald-600/20': l.status === 'approved',
                  'bg-amber-50 text-amber-700 ring-amber-600/20': l.status === 'pending',
                  'bg-rose-50 text-rose-700 ring-rose-600/20': l.status === 'rejected',
                  'bg-slate-50 text-slate-600 ring-slate-500/20': !['approved', 'pending', 'rejected'].includes(l.status),
                })}>{l.status}</span>,
                <span key="r" className="block max-w-[180px] truncate text-slate-500">{l.reason ?? '—'}</span>,
              ])}
            />
          )}

          {/* ── Payroll ── */}
          {activeTab === 'payroll' && canViewSalary && (
            <div className="space-y-4">
              {canManageSalary && (
                <div className="flex items-center justify-end">
                  <Link to={`/employees/${id}/salary`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                    <Wallet size={13} /> Manage Salary Structure
                  </Link>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5 pb-4">
                  <SectionTitle icon={Landmark} title="Salary Structure" />
                </div>
                {loadingSalary ? (
                  <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
                ) : !salaryData?.length ? (
                  <EmptyState icon={Landmark} text="No salary structure configured yet." />
                ) : (
                  <div className="p-5 pt-0">
                    <div className="divide-y divide-slate-50">
                      {salaryData.map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-2.5">
                          <div>
                            <p className="text-[13px] font-semibold text-slate-800">{s.component?.name ?? '—'}</p>
                            <p className="text-[11px] text-slate-400">
                              Effective {fmtDate(s.effective_from)}{s.effective_to ? ` – ${fmtDate(s.effective_to)}` : ''}
                            </p>
                          </div>
                          <span className={cn('text-[13.5px] font-bold', s.component?.type === 'deduction' ? 'text-rose-600' : 'text-emerald-700')}>
                            {s.component?.type === 'deduction' ? '−' : ''}₹{Number(s.amount ?? 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
                      <p className="text-[13px] font-bold text-slate-700">Net Monthly</p>
                      <p className="text-[15px] font-extrabold text-slate-900">
                        ₹{salaryData.reduce((sum, s) => sum + (s.component?.type === 'deduction' ? -Number(s.amount ?? 0) : Number(s.amount ?? 0)), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <DataTableCard
                icon={Wallet}
                title="Payslips"
                loading={loadingPayroll}
                headers={['Period', 'Gross Pay', 'Deductions', 'Net Pay', 'Status', '']}
                empty="No payslips generated yet."
                rows={(payslipData?.data ?? []).map((p) => [
                  <span key="p" className="font-medium text-slate-800">
                    {p.payroll_run?.month ? new Date(p.payroll_run.year, p.payroll_run.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) : '—'}
                  </span>,
                  `₹${Number(p.gross_pay ?? 0).toLocaleString()}`,
                  <span key="d" className="text-rose-600">₹{Number(p.total_deductions ?? 0).toLocaleString()}</span>,
                  <span key="n" className="font-bold text-emerald-700">₹{Number(p.net_pay ?? 0).toLocaleString()}</span>,
                  <span key="s" className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset',
                    p.status === 'paid' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                  )}>{p.status}</span>,
                  <button key="l" onClick={() => openPayslipPdf(p.id).catch(() => {})}
                    className="text-[12px] font-semibold text-blue-600 hover:underline">PDF</button>,
                ])}
              />
            </div>
          )}
        </div>
      </div>

      {shiftModalOpen && (
        <AssignShiftModal
          employee={emp}
          current={shiftAssignment}
          onClose={() => setShiftModalOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['employee-shift', id] })
            setShiftModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ── building blocks ─────────────────────────────────── */

function AssignShiftModal({ employee, current, onClose, onSaved }) {
  const [shiftId, setShiftId] = useState(current?.shift_id ?? '')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))

  const { data: shifts } = useQuery({
    queryKey: ['shifts', employee.branch_id],
    queryFn: () => shiftApi.list({ branch_id: employee.branch_id }).then((r) => r.data?.data ?? r.data ?? []),
  })

  const mutation = useMutation({
    mutationFn: () => shiftApi.assign(shiftId, { employee_id: employee.id, effective_from: effectiveFrom }),
    onSuccess: onSaved,
  })

  function submit(e) {
    e.preventDefault()
    if (!shiftId) return
    mutation.mutate()
  }

  const field = 'w-full rounded-xl border-0 bg-slate-100/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-slate-900">{current ? 'Change' : 'Assign'} Shift</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          {mutation.isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-600">
              {mutation.error?.response?.data?.message ?? 'Could not assign the shift.'}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Shift <span className="text-rose-500">*</span></label>
            <select required value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={field}>
              <option value="">Select a shift…</option>
              {(Array.isArray(shifts) ? shifts : []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)})</option>
              ))}
            </select>
            {(Array.isArray(shifts) ? shifts : []).length === 0 && (
              <p className="mt-1 text-[11px] text-amber-600">No shifts exist for this branch yet — create one in Shift Settings first.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Effective From</label>
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={field} />
            {current && <p className="mt-1 text-[11px] text-slate-400">The current shift will end the day before this date.</p>}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending || !shiftId}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60">
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GlanceRow({ icon: Icon, label, value, sub, link, capitalize }) {
  const content = (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <Icon size={13} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className={cn('truncate text-[13px] font-semibold text-slate-800', capitalize && 'capitalize', link && 'text-blue-600')}>
          {value ?? '—'}
        </p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  )
  return link ? <Link to={link} className="block rounded-lg transition-colors hover:bg-blue-50/50">{content}</Link> : content
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon size={15} />
      </div>
      <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
    </div>
  )
}

function DetailCard({ icon, title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 border-b border-slate-100 pb-3.5">
        <SectionTitle icon={icon} title={title} />
      </div>
      {children}
    </div>
  )
}

function FieldGrid({ fields, cols = 2 }) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-4', cols === 2 && 'sm:grid-cols-2')}>
      {fields.map(([label, value, capitalize]) => (
        <div key={label}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
          <dd className={cn('mt-1 text-[13.5px] font-medium text-slate-800 break-words', capitalize && value && 'capitalize', !value && 'font-normal text-slate-300')}>
            {value || 'Not added'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
        <Icon size={20} />
      </div>
      <p className="text-[13px] text-slate-400">{text}</p>
    </div>
  )
}

function DataTableCard({ icon, title, loading, headers, rows, empty }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 pb-4">
        <SectionTitle icon={icon} title={title} />
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={icon} text={empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {headers.map((h, i) => <th key={i} className="px-5 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((cells, i) => (
                <tr key={i} className="transition-colors hover:bg-blue-50/30">
                  {cells.map((c, j) => <td key={j} className="px-5 py-3.5 text-[13px] text-slate-600">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
