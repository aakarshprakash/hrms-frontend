import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, User, MapPin, Briefcase, Landmark, PhoneCall, Pencil, Check } from 'lucide-react'
import { employeeApi } from '@/lib/api/employees'
import { departmentApi, designationApi, branchApi } from '@/lib/api/departments'
import { shiftApi } from '@/lib/api/shifts'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import AddEmployeeWizard from './AddEmployeeWizard'

const optional = (s) => s.optional().or(z.literal(''))

const schema = z.object({
  // Personal
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Valid email required'),
  personal_email: optional(z.string().email('Valid email required')),
  phone: optional(z.string()),
  date_of_birth: optional(z.string()),
  gender: optional(z.enum(['male', 'female', 'other'])),
  marital_status: optional(z.enum(['single', 'married', 'divorced', 'widowed'])),
  blood_group: optional(z.string()),
  nationality: optional(z.string()),
  national_id: optional(z.string()),
  tax_id: optional(z.string()),
  // Address
  address_line1: optional(z.string()),
  address_line2: optional(z.string()),
  city: optional(z.string()),
  state: optional(z.string()),
  country: optional(z.string()),
  postal_code: optional(z.string()),
  // Emergency
  emergency_contact_name: optional(z.string()),
  emergency_contact_phone: optional(z.string()),
  emergency_contact_relation: optional(z.string()),
  // Bank
  bank_name: optional(z.string()),
  bank_branch: optional(z.string()),
  bank_account_number: optional(z.string()),
  bank_ifsc_code: optional(z.string()),
  payment_method: optional(z.enum(['bank_transfer', 'cash', 'cheque'])),
  // Employment
  employee_code: z.string().min(1, 'Required'),
  biometric_emp_code: optional(z.string()),
  date_of_joining: z.string().min(1, 'Required'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  probation_end_date: optional(z.string()),
  notice_period_days: optional(z.coerce.number().min(0).max(365)),
  work_location: optional(z.string()),
  status: z.enum(['active', 'inactive', 'terminated']).default('active'),
  notes: optional(z.string()),
  // Organisation
  branch_id: z.coerce.number().min(1, 'Required'),
  department_id: optional(z.coerce.number()),
  designation_id: optional(z.coerce.number()),
  reporting_manager_id: optional(z.coerce.number()),
  shift_id: optional(z.coerce.number()),
})

const SECTION_COLORS = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  purple: 'bg-purple-50 text-purple-600',
  rose: 'bg-rose-50 text-rose-600',
}

function Section({ id, icon: Icon, title, subtitle, color = 'blue', children }) {
  return (
    <div id={id} className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', SECTION_COLORS[color])}>
          <Icon size={16} />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-[12px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  )
}

export default function EmployeeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)

  if (!isEdit) {
    return <AddEmployeeWizard />
  }

  return <EditEmployeeForm id={id} />
}

function EditEmployeeForm({ id }) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeApi.get(id).then((r) => r.data.data),
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data),
  })

  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { employment_type: 'full_time', status: 'active' },
  })

  const selectedBranch = watch('branch_id')
  const selectedDept = watch('department_id')

  const { data: deptsData } = useQuery({
    queryKey: ['departments', selectedBranch],
    queryFn: () => departmentApi.list({ branch_id: selectedBranch }).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!selectedBranch,
  })

  const { data: desigData } = useQuery({
    queryKey: ['designations', selectedDept, selectedBranch],
    queryFn: () => designationApi.list({ department_id: selectedDept || undefined, branch_id: selectedBranch }).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!selectedBranch,
  })

  const { data: managersData } = useQuery({
    queryKey: ['employees', 'managers', selectedBranch],
    queryFn: () => employeeApi.list({ branch_id: selectedBranch, status: 'active' }).then((r) => r.data?.data ?? []),
    enabled: !!selectedBranch,
  })

  const { data: shiftsData } = useQuery({
    queryKey: ['shifts', selectedBranch],
    queryFn: () => shiftApi.list({ branch_id: selectedBranch }).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!selectedBranch,
  })

  const { data: currentShift } = useQuery({
    queryKey: ['employee-shift', id],
    queryFn: () => shiftApi.employeeAssignments(id).then((r) => r.data?.data?.current ?? null),
  })

  useEffect(() => {
    if (existing) {
      const str = (v) => v ?? ''
      reset({
        shift_id: currentShift?.shift_id ?? '',
        first_name: str(existing.first_name),
        last_name: str(existing.last_name),
        email: str(existing.email),
        personal_email: str(existing.personal_email),
        phone: str(existing.phone),
        date_of_birth: existing.date_of_birth?.slice(0, 10) ?? '',
        gender: str(existing.gender),
        marital_status: str(existing.marital_status),
        blood_group: str(existing.blood_group),
        nationality: str(existing.nationality),
        national_id: str(existing.national_id),
        tax_id: str(existing.tax_id),
        address_line1: str(existing.address_line1),
        address_line2: str(existing.address_line2),
        city: str(existing.city),
        state: str(existing.state),
        country: str(existing.country),
        postal_code: str(existing.postal_code),
        emergency_contact_name: str(existing.emergency_contact_name),
        emergency_contact_phone: str(existing.emergency_contact_phone),
        emergency_contact_relation: str(existing.emergency_contact_relation),
        bank_name: str(existing.bank_name),
        bank_branch: str(existing.bank_branch),
        bank_account_number: str(existing.bank_account_number),
        bank_ifsc_code: str(existing.bank_ifsc_code),
        payment_method: str(existing.payment_method),
        employee_code: str(existing.employee_code),
        biometric_emp_code: str(existing.biometric_emp_code),
        date_of_joining: existing.date_of_joining?.slice(0, 10) ?? '',
        employment_type: existing.employment_type,
        probation_end_date: existing.probation_end_date?.slice(0, 10) ?? '',
        notice_period_days: existing.notice_period_days ?? '',
        work_location: str(existing.work_location),
        status: existing.status,
        notes: str(existing.notes),
        branch_id: existing.branch_id,
        department_id: existing.department_id ?? '',
        designation_id: existing.designation_id ?? '',
        reporting_manager_id: existing.reporting_manager_id ?? '',
      })
    }
  }, [existing, currentShift, reset])

  const mutation = useMutation({
    mutationFn: (data) => employeeApi.update(id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employee', id] })
      const empId = res.data?.data?.id ?? id
      navigate(`/employees/${empId}`)
    },
  })

  async function onSubmit(data) {
    const optionalIds = ['department_id', 'designation_id', 'reporting_manager_id']
    const required = ['first_name', 'last_name', 'email', 'employee_code', 'date_of_joining', 'employment_type', 'branch_id', 'status']
    const { shift_id, ...rest } = data // shift isn't an employee field — handled separately below
    const payload = {}
    for (const [key, value] of Object.entries(rest)) {
      if (Number.isNaN(value)) continue
      const isEmpty = value === '' || value === undefined || (optionalIds.includes(key) && !value)
      if (isEmpty) {
        // An emptied field clears the stored value rather than being omitted.
        if (!required.includes(key)) payload[key] = null
        continue
      }
      payload[key] = value
    }
    await mutation.mutateAsync(payload)

    if (shift_id && Number(shift_id) !== currentShift?.shift_id) {
      await shiftApi.assign(shift_id, { employee_id: id, effective_from: new Date().toISOString().slice(0, 10) })
      qc.invalidateQueries({ queryKey: ['employee-shift', id] })
    }
  }

  if (loadingExisting) {
    return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
  }

  const fieldCls = (name) => cn(
    'w-full rounded-xl border-0 bg-slate-100/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/60',
    errors[name] && 'ring-2 ring-rose-400/60'
  )

  const input = (name, opts = {}) => (
    <input type={opts.type ?? 'text'} placeholder={opts.placeholder} {...register(name)} className={fieldCls(name)} />
  )

  const select = (name, options) => (
    <select {...register(name)} className={fieldCls(name)}>
      {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
    </select>
  )

  const Field = ({ label, name, required, children, className }) => (
    <div className={className}>
      <label className="mb-1 block text-[13px] font-medium text-slate-700">
        {label}{required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {errors[name] && <p className="mt-1 text-xs text-rose-500">{errors[name].message}</p>}
    </div>
  )

  const initials = `${existing?.first_name?.[0] ?? ''}${existing?.last_name?.[0] ?? ''}`.toUpperCase()
  const NAV_SECTIONS = [
    { id: 'sec-personal', icon: User, label: 'Personal Details', color: 'blue' },
    { id: 'sec-address', icon: MapPin, label: 'Address', color: 'emerald' },
    { id: 'sec-employment', icon: Briefcase, label: 'Employment', color: 'indigo' },
    { id: 'sec-bank', icon: Landmark, label: 'Bank & Payment', color: 'purple' },
    { id: 'sec-emergency', icon: PhoneCall, label: 'Emergency Contact', color: 'rose' },
  ]

  function jumpTo(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-xl p-1.5 text-slate-500 transition-colors hover:bg-slate-100">
            <ArrowLeft size={18} />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
            <Pencil size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Edit Employee</h1>
            <p className="text-[13px] text-slate-500">
              Updating {existing?.first_name} {existing?.last_name}'s profile
            </p>
          </div>
        </div>
      </div>

      {mutation.isError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {mutation.error?.response?.data?.message ?? 'Something went wrong.'}
          {mutation.error?.response?.data?.errors && (
            <ul className="mt-1 list-disc list-inside">
              {Object.values(mutation.error.response.data.errors).flat().map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr] items-start">
        {/* Sticky profile + section nav */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-center shadow-sm">
            {existing?.avatar_url ? (
              <img src={existing.avatar_url} alt="" className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-sm" />
            ) : (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-sm">
                {initials}
              </div>
            )}
            <p className="mt-3 text-[14px] font-bold text-slate-900">{existing?.first_name} {existing?.last_name}</p>
            <p className="font-mono text-[11px] text-slate-400">{existing?.employee_code}</p>
          </div>

          <nav className="hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm lg:block">
            {NAV_SECTIONS.map((s) => (
              <button key={s.id} type="button" onClick={() => jumpTo(s.id)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', SECTION_COLORS[s.color])}>
                  <s.icon size={12} />
                </div>
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 min-w-0">
        <Section id="sec-personal" color="blue" icon={User} title="Personal Details" subtitle="Identity and personal information">
          <Field label="First Name" name="first_name" required>{input('first_name')}</Field>
          <Field label="Last Name" name="last_name" required>{input('last_name')}</Field>
          <Field label="Work Email" name="email" required>{input('email', { type: 'email' })}</Field>
          <Field label="Personal Email" name="personal_email">{input('personal_email', { type: 'email' })}</Field>
          <Field label="Phone" name="phone">{input('phone', { type: 'tel' })}</Field>
          <Field label="Date of Birth" name="date_of_birth">{input('date_of_birth', { type: 'date' })}</Field>
          <Field label="Gender" name="gender">
            {select('gender', [['', 'Select'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other']])}
          </Field>
          <Field label="Marital Status" name="marital_status">
            {select('marital_status', [['', 'Select'], ['single', 'Single'], ['married', 'Married'], ['divorced', 'Divorced'], ['widowed', 'Widowed']])}
          </Field>
          <Field label="Blood Group" name="blood_group">
            {select('blood_group', [['', 'Select'], ['A+', 'A+'], ['A-', 'A-'], ['B+', 'B+'], ['B-', 'B-'], ['AB+', 'AB+'], ['AB-', 'AB-'], ['O+', 'O+'], ['O-', 'O-']])}
          </Field>
          <Field label="Nationality" name="nationality">{input('nationality')}</Field>
          <Field label="National ID (Aadhaar / SSN)" name="national_id">{input('national_id')}</Field>
          <Field label="Tax ID (PAN)" name="tax_id">{input('tax_id')}</Field>
        </Section>

        <Section id="sec-address" color="emerald" icon={MapPin} title="Address" subtitle="Current residential address">
          <Field label="Address Line 1" name="address_line1" className="sm:col-span-2">{input('address_line1')}</Field>
          <Field label="Address Line 2" name="address_line2">{input('address_line2')}</Field>
          <Field label="City" name="city">{input('city')}</Field>
          <Field label="State" name="state">{input('state')}</Field>
          <Field label="Country" name="country">{input('country')}</Field>
          <Field label="Postal Code" name="postal_code">{input('postal_code')}</Field>
        </Section>

        <Section id="sec-employment" color="indigo" icon={Briefcase} title="Employment" subtitle="Job, organisation and reporting line">
          <Field label="Employee Code" name="employee_code" required>{input('employee_code')}</Field>
          <Field label="Biometric Device Code" name="biometric_emp_code">
            {input('biometric_emp_code', { placeholder: 'ID on the biometric device, e.g. 22' })}
          </Field>
          <Field label="Date of Joining" name="date_of_joining" required>{input('date_of_joining', { type: 'date' })}</Field>
          <Field label="Employment Type" name="employment_type" required>
            {select('employment_type', [['full_time', 'Full Time'], ['part_time', 'Part Time'], ['contract', 'Contract'], ['intern', 'Intern']])}
          </Field>
          <Field label="Branch" name="branch_id" required>
            {select('branch_id', [['', 'Select branch'], ...(branchesData?.data ?? []).map((b) => [b.id, b.name])])}
          </Field>
          <Field label="Department" name="department_id">
            {select('department_id', [['', 'Select department'], ...(Array.isArray(deptsData) ? deptsData : []).map((d) => [d.id, d.name])])}
          </Field>
          <Field label="Designation" name="designation_id">
            {select('designation_id', [['', 'Select designation'], ...(Array.isArray(desigData) ? desigData : []).map((d) => [d.id, d.title])])}
          </Field>
          <Field label="Shift" name="shift_id">
            {select('shift_id', [
              ['', 'No shift assigned'],
              ...(Array.isArray(shiftsData) ? shiftsData : []).map((s) => [s.id, `${s.name} (${s.start_time?.slice(0, 5)}–${s.end_time?.slice(0, 5)})`]),
            ])}
            <p className="mt-1 text-[11px] text-slate-400">Used to detect late arrivals and half-days automatically.</p>
          </Field>
          <Field label="Reporting Manager" name="reporting_manager_id">
            {select('reporting_manager_id', [
              ['', 'None'],
              ...(Array.isArray(managersData) ? managersData : [])
                .filter((m) => String(m.id) !== String(id))
                .map((m) => [m.id, `${m.first_name} ${m.last_name} (${m.employee_code})`]),
            ])}
          </Field>
          <Field label="Probation End Date" name="probation_end_date">{input('probation_end_date', { type: 'date' })}</Field>
          <Field label="Notice Period (days)" name="notice_period_days">{input('notice_period_days', { type: 'number' })}</Field>
          <Field label="Work Location" name="work_location">{input('work_location', { placeholder: 'e.g. Head Office, Remote' })}</Field>
          <Field label="Status" name="status">
            {select('status', [['active', 'Active'], ['inactive', 'Inactive'], ['terminated', 'Terminated']])}
          </Field>
          <Field label="Notes" name="notes" className="sm:col-span-2 lg:col-span-3">
            <textarea rows={2} {...register('notes')} className={fieldCls('notes')}
              placeholder="Internal HR notes (not visible to the employee)" />
          </Field>
        </Section>

        <Section id="sec-bank" color="purple" icon={Landmark} title="Bank & Payment" subtitle="Used for payroll disbursement">
          <Field label="Payment Method" name="payment_method">
            {select('payment_method', [['', 'Select'], ['bank_transfer', 'Bank Transfer'], ['cash', 'Cash'], ['cheque', 'Cheque']])}
          </Field>
          <Field label="Bank Name" name="bank_name">{input('bank_name')}</Field>
          <Field label="Bank Branch" name="bank_branch">{input('bank_branch')}</Field>
          <Field label="Account Number" name="bank_account_number">{input('bank_account_number')}</Field>
          <Field label="IFSC / Routing Code" name="bank_ifsc_code">{input('bank_ifsc_code')}</Field>
        </Section>

        <Section id="sec-emergency" color="rose" icon={PhoneCall} title="Emergency Contact" subtitle="Who to reach in an emergency">
          <Field label="Contact Name" name="emergency_contact_name">{input('emergency_contact_name')}</Field>
          <Field label="Contact Phone" name="emergency_contact_phone">{input('emergency_contact_phone', { type: 'tel' })}</Field>
          <Field label="Relationship" name="emergency_contact_relation">{input('emergency_contact_relation', { placeholder: 'e.g. Spouse, Parent' })}</Field>
        </Section>

        <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-3.5 shadow-lg shadow-slate-900/5 backdrop-blur">
          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-blue-600/40 disabled:opacity-60">
            <Check size={15} />
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
      </div>
    </div>
  )
}
