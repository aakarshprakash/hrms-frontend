import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, Check, User, Briefcase, KeyRound, Sparkles,
  Cake, PencilLine, Mail, Copy, CheckCircle2, PartyPopper, RefreshCw,
} from 'lucide-react'
import { employeeApi } from '@/lib/api/employees'
import { departmentApi, designationApi, branchApi } from '@/lib/api/departments'
import { shiftApi } from '@/lib/api/shifts'
import { userApi } from '@/lib/api/users'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { cn } from '@/lib/utils'

const optional = (s) => s.optional().or(z.literal(''))

const schema = z.object({
  // Step 1 — basic details (required)
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Valid email required'),
  employee_code: z.string().min(1, 'Required'),
  branch_id: z.coerce.number().min(1, 'Required'),
  date_of_joining: z.string().min(1, 'Required'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  // Step 2 — job details (optional)
  department_id: optional(z.coerce.number()),
  designation_id: optional(z.coerce.number()),
  reporting_manager_id: optional(z.coerce.number()),
  shift_id: optional(z.coerce.number()),
  work_location: optional(z.string()),
  // Step 3 — personal details (optional)
  phone: optional(z.string()),
  date_of_birth: optional(z.string()),
  gender: optional(z.enum(['male', 'female', 'other'])),
  marital_status: optional(z.enum(['single', 'married', 'divorced', 'widowed'])),
  // Step 4 — account & access
  create_login: z.boolean(),
  password_option: z.enum(['auto', 'dob', 'manual']),
  password: optional(z.string()),
  role: optional(z.string()),
  send_welcome_email: z.boolean(),
}).superRefine((data, ctx) => {
  if (!data.create_login) return
  if (data.password_option === 'manual' && (!data.password || data.password.length < 6)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'Password must be at least 6 characters.' })
  }
  if (data.password_option === 'dob' && !data.date_of_birth) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date_of_birth'], message: 'Add a date of birth in Personal Details to use this option.' })
  }
})

const STEPS = [
  { key: 'basic', label: 'Basic Details', icon: User, fields: ['first_name', 'last_name', 'email', 'employee_code', 'branch_id', 'date_of_joining', 'employment_type'] },
  { key: 'job', label: 'Job Details', icon: Briefcase, fields: ['department_id', 'designation_id', 'reporting_manager_id', 'shift_id', 'work_location'] },
  { key: 'personal', label: 'Personal Info', icon: Cake, fields: ['phone', 'date_of_birth', 'gender', 'marital_status'] },
  { key: 'account', label: 'Account & Access', icon: KeyRound, fields: ['create_login', 'password_option', 'password', 'role', 'send_welcome_email'] },
]

const inputCls = (hasError) => cn(
  'w-full rounded-xl border-0 bg-slate-100/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/60',
  hasError && 'ring-2 ring-rose-400/60'
)

export default function AddEmployeeWizard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const { isSuperAdmin, hasRole } = useRole()
  const canAssignRole = isSuperAdmin || hasRole('branch_admin')

  const [step, setStep] = useState(0)
  const [result, setResult] = useState(null) // { employee, credentials } after success
  const [copied, setCopied] = useState(false)

  const {
    register, handleSubmit, watch, setValue, trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      employment_type: 'full_time',
      branch_id: activeBranchId ?? '',
      date_of_joining: new Date().toISOString().slice(0, 10),
      create_login: true,
      password_option: 'auto',
      send_welcome_email: true,
      role: '',
    },
  })

  const values = watch()

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data),
  })

  const { data: deptsData } = useQuery({
    queryKey: ['departments', values.branch_id],
    queryFn: () => departmentApi.list({ branch_id: values.branch_id }).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!values.branch_id,
  })

  const { data: desigData } = useQuery({
    queryKey: ['designations', values.department_id, values.branch_id],
    queryFn: () => designationApi.list({ department_id: values.department_id || undefined, branch_id: values.branch_id }).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!values.branch_id,
  })

  const { data: managersData } = useQuery({
    queryKey: ['employees', 'managers', values.branch_id],
    queryFn: () => employeeApi.list({ branch_id: values.branch_id, status: 'active' }).then((r) => r.data?.data ?? []),
    enabled: !!values.branch_id,
  })

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userApi.roles().then((r) => r.data?.data ?? []),
    enabled: canAssignRole,
  })

  const { data: shiftsData } = useQuery({
    queryKey: ['shifts', values.branch_id],
    queryFn: () => shiftApi.list({ branch_id: values.branch_id }).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!values.branch_id,
  })

  const mutation = useMutation({
    mutationFn: async ({ shift_id, ...data }) => {
      const res = await employeeApi.create(data)
      const newEmployee = res.data?.data
      if (shift_id && newEmployee) {
        await shiftApi.assign(shift_id, { employee_id: newEmployee.id, effective_from: data.date_of_joining })
      }
      return res
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      setResult({ employee: res.data?.data, credentials: res.data?.credentials ?? null })
    },
  })

  async function goNext() {
    const valid = await trigger(STEPS[step].fields)
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function onSubmit(data) {
    const optionalIds = ['department_id', 'designation_id', 'reporting_manager_id', 'shift_id']
    const payload = {}
    for (const [key, value] of Object.entries(data)) {
      if (value === '' || value === undefined || Number.isNaN(value)) continue
      if (optionalIds.includes(key) && !value) continue
      if (!data.create_login && ['password_option', 'password', 'role', 'send_welcome_email'].includes(key)) continue
      payload[key] = value
    }
    await mutation.mutateAsync(payload)
  }

  function copyPassword() {
    if (!result?.credentials) return
    navigator.clipboard?.writeText(result.credentials.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function resetWizard() {
    setResult(null)
    setStep(0)
  }

  // ── Success screen ──────────────────────────────────
  if (result) {
    const { employee, credentials } = result
    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {employee?.first_name} {employee?.last_name} has been added!
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Employee code <span className="font-mono font-semibold text-slate-700">{employee?.employee_code}</span> is ready in the directory.
        </p>

        {credentials && (
          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 text-left">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound size={15} className="text-blue-600" />
              <p className="text-[13px] font-bold text-slate-800">Login Credentials</p>
            </div>
            <div className="space-y-2.5">
              <div className="rounded-xl bg-white px-3.5 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</p>
                <p className="text-[13.5px] font-medium text-slate-800">{credentials.email}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Temporary Password</p>
                  <p className="font-mono text-[14px] font-semibold text-slate-800">{credentials.password}</p>
                </div>
                <button onClick={copyPassword}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className={cn(
              'mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px]',
              credentials.email_sent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            )}>
              <Mail size={14} className="shrink-0" />
              {credentials.email_sent
                ? `Emailed to ${credentials.email}.`
                : 'Could not send automatically — please share these credentials securely.'}
            </div>
          </div>
        )}

        <div className="mt-7 flex justify-center gap-3">
          <button onClick={resetWizard}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <RefreshCw size={14} /> Add Another
          </button>
          <button onClick={() => navigate(`/employees/${employee.id}`)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700">
            View Profile <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  const current = STEPS[step]

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Add Employee</h1>
          <p className="text-[13px] text-slate-500">A few quick steps — only the essentials are required.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border-2 text-[13px] font-bold transition-all',
                i < step ? 'border-blue-600 bg-blue-600 text-white' :
                i === step ? 'border-blue-600 bg-white text-blue-600' :
                'border-slate-200 bg-white text-slate-300'
              )}>
                {i < step ? <Check size={15} /> : i + 1}
              </div>
              <span className={cn('hidden text-[11px] font-medium sm:block', i === step ? 'text-blue-600' : 'text-slate-400')}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('mx-1.5 h-0.5 flex-1 rounded-full transition-colors', i < step ? 'bg-blue-600' : 'bg-slate-200')} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <current.icon size={16} />
            </div>
            <h2 className="text-[15px] font-bold text-slate-900">{current.label}</h2>
          </div>

          {mutation.isError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-600">
              {mutation.error?.response?.data?.message ?? 'Something went wrong.'}
              {mutation.error?.response?.data?.errors && (
                <ul className="mt-1 list-disc list-inside">
                  {Object.values(mutation.error.response.data.errors).flat().map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Step 1 — Basic Details */}
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First Name" error={errors.first_name} required>
                <input {...register('first_name')} className={inputCls(errors.first_name)} />
              </Field>
              <Field label="Last Name" error={errors.last_name} required>
                <input {...register('last_name')} className={inputCls(errors.last_name)} />
              </Field>
              <Field label="Work Email" error={errors.email} required className="sm:col-span-2">
                <input type="email" {...register('email')} className={inputCls(errors.email)} placeholder="name@company.com" />
              </Field>
              <Field label="Employee Code" error={errors.employee_code} required>
                <input {...register('employee_code')} className={inputCls(errors.employee_code)} placeholder="e.g. EMP010" />
              </Field>
              <Field label="Date of Joining" error={errors.date_of_joining} required>
                <input type="date" {...register('date_of_joining')} className={inputCls(errors.date_of_joining)} />
              </Field>
              <Field label="Branch" error={errors.branch_id} required>
                <select {...register('branch_id')} className={inputCls(errors.branch_id)}>
                  <option value="">Select branch</option>
                  {(branchesData?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Employment Type" error={errors.employment_type} required>
                <select {...register('employment_type')} className={inputCls(errors.employment_type)}>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </Field>
            </div>
          )}

          {/* Step 2 — Job Details */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[13px] text-slate-400">All optional — you can fill these in later from the employee profile.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department">
                  <select {...register('department_id')} className={inputCls()}>
                    <option value="">Select department</option>
                    {(Array.isArray(deptsData) ? deptsData : []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Designation">
                  <select {...register('designation_id')} className={inputCls()}>
                    <option value="">Select designation</option>
                    {(Array.isArray(desigData) ? desigData : []).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </Field>
                <Field label="Reporting Manager">
                  <select {...register('reporting_manager_id')} className={inputCls()}>
                    <option value="">None</option>
                    {(Array.isArray(managersData) ? managersData : []).map((m) => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.employee_code})</option>
                    ))}
                  </select>
                </Field>
                <Field label="Shift">
                  <select {...register('shift_id')} className={inputCls()}>
                    <option value="">No shift assigned</option>
                    {(Array.isArray(shiftsData) ? shiftsData : []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)})</option>
                    ))}
                  </select>
                </Field>
                <Field label="Work Location">
                  <input {...register('work_location')} className={inputCls()} placeholder="e.g. Head Office, Remote" />
                </Field>
              </div>
            </div>
          )}

          {/* Step 3 — Personal Info */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-[13px] text-slate-400">Optional — adding a date of birth also unlocks the "use DOB as password" option next.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone">
                  <input type="tel" {...register('phone')} className={inputCls()} />
                </Field>
                <Field label="Date of Birth" error={errors.date_of_birth}>
                  <input type="date" {...register('date_of_birth')} className={inputCls(errors.date_of_birth)} />
                </Field>
                <Field label="Gender">
                  <select {...register('gender')} className={inputCls()}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Marital Status">
                  <select {...register('marital_status')} className={inputCls()}>
                    <option value="">Select</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* Step 4 — Account & Access */}
          {step === 3 && (
            <div className="space-y-5">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5">
                <div>
                  <p className="text-[13.5px] font-semibold text-slate-800">Create a login for this employee</p>
                  <p className="text-[12px] text-slate-400">Lets them sign in to view attendance, apply for leave, download payslips.</p>
                </div>
                <ToggleSwitch checked={values.create_login} onChange={(v) => setValue('create_login', v, { shouldValidate: true })} />
              </label>

              {values.create_login && (
                <>
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-slate-700">Password</p>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <OptionCard
                        icon={Sparkles}
                        title="Auto-generate"
                        desc="Random secure password"
                        active={values.password_option === 'auto'}
                        onClick={() => setValue('password_option', 'auto', { shouldValidate: true })}
                      />
                      <OptionCard
                        icon={Cake}
                        title="Use date of birth"
                        desc={values.date_of_birth ? 'DDMMYYYY format' : 'Add DOB in step 3 first'}
                        active={values.password_option === 'dob'}
                        disabled={!values.date_of_birth}
                        onClick={() => setValue('password_option', 'dob', { shouldValidate: true })}
                      />
                      <OptionCard
                        icon={PencilLine}
                        title="Set manually"
                        desc="Choose it yourself"
                        active={values.password_option === 'manual'}
                        onClick={() => setValue('password_option', 'manual', { shouldValidate: true })}
                      />
                    </div>
                    {values.password_option === 'manual' && (
                      <div className="mt-3">
                        <input type="text" {...register('password')} className={inputCls(errors.password)}
                          placeholder="Minimum 6 characters" />
                        {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>}
                      </div>
                    )}
                    {values.password_option === 'dob' && errors.date_of_birth && (
                      <p className="mt-2 text-xs text-rose-500">{errors.date_of_birth.message}</p>
                    )}
                  </div>

                  {canAssignRole && (
                    <Field label="Role">
                      <select {...register('role')} className={inputCls()}>
                        <option value="">Employee (default)</option>
                        {(rolesData ?? []).filter((r) => isSuperAdmin || r !== 'super_admin').map((r) => (
                          <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Mail size={15} className="text-slate-400" />
                      <div>
                        <p className="text-[13.5px] font-semibold text-slate-800">Email credentials to the employee</p>
                        <p className="text-[12px] text-slate-400">Sends the login email and password automatically.</p>
                      </div>
                    </div>
                    <ToggleSwitch checked={values.send_welcome_email} onChange={(v) => setValue('send_welcome_email', v)} />
                  </label>
                </>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-5 flex justify-between">
          <button type="button" onClick={step === 0 ? () => navigate(-1) : goBack}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={goNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700">
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button type="submit" disabled={mutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60">
              <PartyPopper size={14} /> {mutation.isPending ? 'Creating…' : 'Create Employee'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, error, children, className }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[13px] font-medium text-slate-700">
        {label}{required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-500">{error.message}</p>}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-blue-600' : 'bg-slate-200')}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  )
}

function OptionCard({ icon: Icon, title, desc, active, disabled, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn(
        'rounded-xl border-2 p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200 hover:border-slate-300'
      )}>
      <Icon size={16} className={active ? 'text-blue-600' : 'text-slate-400'} />
      <p className="mt-1.5 text-[13px] font-semibold text-slate-800">{title}</p>
      <p className="text-[11px] leading-snug text-slate-400">{desc}</p>
    </button>
  )
}
