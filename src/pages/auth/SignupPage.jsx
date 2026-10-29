import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, Mail, Lock, User, Building2, Phone, MapPin, Zap, Crown, Rocket, Gift,
  ShieldCheck, Pencil,
} from 'lucide-react'
import { billingApi, FEATURE_LABELS, DEFAULT_CYCLES, CYCLE_NOUN, planPrice } from '@/lib/api/billing'
import { apiError } from '@/lib/api/axios'
import { useAuthStore } from '@/store/authStore'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Button, Field, Input, Select, Textarea, ErrorBanner } from '@/components/ui/kit'
import CycleToggle from '@/components/billing/CycleToggle'
import logoIcon from '@/assets/brand/icon.png'
import logoFull from '@/assets/brand/logo-full.png'

const STEPS = [
  { title: 'Admin account', hint: 'Create your primary login.' },
  { title: 'Workspace', hint: 'Tell us about your organisation.' },
  { title: 'Choose plan', hint: 'Pick what fits your team.' },
  { title: 'Ready to go', hint: 'Review and launch.' },
]

const PLAN_ICONS = { starter: Zap, growth: Rocket, enterprise: Crown }

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

const DRAFT_KEY = 'hrms-signup-draft'
const EMPTY = {
  first_name: '', last_name: '', email: '', password: '',
  company_name: '', industry: 'general', company_phone: '', state: '', city: '', postal_code: '', address_line1: '',
  plan_code: '', billing_cycle: 'monthly',
}

function readDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) ?? {}
  } catch {
    return {}
  }
}

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const passwordOk = (v) => v.length >= 8 && /[a-z]/i.test(v) && /\d/.test(v)

/**
 * Self-serve onboarding: admin account (email verified by OTP) →
 * workspace details → plan and billing cycle → review, then the workspace
 * is created on a free trial of the chosen plan and the admin is signed in.
 */
export default function SignupPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [draft] = useState(readDraft)
  const [step, setStep] = useState(draft.step ?? 0)
  const [formState, setForm] = useState({ ...EMPTY, ...draft.form, password: '' })
  const [verified, setVerified] = useState(draft.verified ?? null) // { email, token }
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const { data: config, isLoading } = useQuery({
    queryKey: ['public-config'],
    queryFn: () => billingApi.publicConfig().then((r) => r.data.data),
  })
  const cycles = config?.cycles?.length ? config.cycles : DEFAULT_CYCLES

  // Until a plan is picked, the trial plan is pre-selected.
  const defaultPlan = config?.plans?.find((p) => p.code === config.trial_plan)?.code ?? config?.plans?.[0]?.code ?? ''
  const form = formState.plan_code ? formState : { ...formState, plan_code: defaultPlan }

  // Keep progress across a refresh (never the password).
  useEffect(() => {
    try {
      const rest = { ...formState }
      delete rest.password
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, form: rest, verified }))
    } catch { /* storage unavailable */ }
  }, [step, formState, verified])

  const isVerified = verified && verified.email === form.email.trim().toLowerCase()

  const signup = useMutation({
    mutationFn: () => billingApi.signup({
      company_name: form.company_name.trim(),
      industry: form.industry || undefined,
      company_phone: form.company_phone ? `+91 ${form.company_phone.trim()}` : undefined,
      address_line1: form.address_line1.trim() || undefined,
      state: form.state || undefined,
      city: form.city.trim() || undefined,
      postal_code: form.postal_code.trim() || undefined,
      admin_name: `${form.first_name} ${form.last_name}`.trim(),
      admin_email: form.email.trim().toLowerCase(),
      admin_password: form.password,
      plan_code: form.plan_code,
      billing_cycle: form.billing_cycle,
      verification_token: verified?.token,
    }),
    onSuccess: (res) => {
      const { user, token, branches, company, features, subscription } = res.data.data
      try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      setAuth(user, token, branches ?? [], { company, features, subscription })
      navigate('/settings/quick-setup', { replace: true })
    },
    onError: (err) => {
      const data = err.response?.data
      if (/verif/i.test(data?.message ?? '') || data?.errors?.verification_token) {
        setVerified(null)
        setStep(0)
      } else if (data?.errors?.admin_email || data?.errors?.admin_password || data?.errors?.admin_name) {
        setStep(0)
      }
    },
  })

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>

  if (!config?.signup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm text-center">
          <img src={logoFull} alt="PeopleNex HRMS" className="mx-auto mb-6 h-10 w-auto" />
          <h2 className="text-xl font-semibold text-slate-900">Sign-ups are by invitation</h2>
          <p className="mt-2 text-sm text-slate-500">Contact us to set up your organisation.</p>
          <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-blue-600">Back to sign in</Link>
        </div>
      </div>
    )
  }

  const plan = config.plans.find((p) => p.code === form.plan_code)
  const cycle = cycles.find((c) => c.key === form.billing_cycle) ?? cycles[0]
  const canContinue = [
    form.first_name.trim() && isVerified && passwordOk(form.password),
    form.company_name.trim().length >= 2,
    Boolean(plan),
    true,
  ][step]

  return (
    <div className="flex min-h-screen bg-white">
      <StepRail step={step} trialDays={config.trial_days} onJump={(i) => i < step && setStep(i)} />

      <main className="flex flex-1 flex-col bg-slate-50/60">
        <div className="flex items-center justify-between px-6 pt-6 lg:hidden">
          <img src={logoFull} alt="PeopleNex HRMS" className="h-8 w-auto" />
          <span className="text-xs font-medium text-slate-500">Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="mx-6 mt-3 h-1 overflow-hidden rounded-full bg-slate-200 lg:hidden">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="flex flex-1 items-start justify-center px-6 py-10 lg:items-center">
          <form className={cn('w-full', step === 2 ? 'max-w-2xl' : 'max-w-lg')}
            onSubmit={(e) => {
              e.preventDefault()
              if (!canContinue) return
              if (step < STEPS.length - 1) setStep(step + 1)
              else signup.mutate()
            }}>
            {step === 0 && <AccountStep form={form} set={set} verified={isVerified} onVerified={setVerified} onResetVerification={() => setVerified(null)} />}
            {step === 1 && <WorkspaceStep form={form} set={set} industries={config.industries} />}
            {step === 2 && <PlanStep form={form} set={set} plans={config.plans} cycles={cycles} trialPlan={config.trial_plan} trialDays={config.trial_days} />}
            {step === 3 && <ReviewStep form={form} plan={plan} cycle={cycle} trialDays={config.trial_days} gstRate={config.gst_rate ?? 18} onEdit={setStep} />}

            <ErrorBanner error={signup.error} message={signup.error ? apiError(signup.error) : undefined} className="mt-5" />

            <div className="mt-8 flex items-center justify-between gap-3">
              {step > 0
                ? <Button type="button" variant="secondary" size="lg" icon={ArrowLeft} onClick={() => setStep(step - 1)}>Back</Button>
                : <p className="text-sm text-slate-500">Have an account? <Link to="/login" className="font-semibold text-blue-600 hover:underline">Sign in</Link></p>}
              <Button type="submit" size="lg" disabled={!canContinue} loading={signup.isPending} className="min-w-[150px]">
                {step < STEPS.length - 1 ? <>Continue <ArrowRight size={16} /></> : <>Start free trial <Rocket size={16} /></>}
              </Button>
            </div>
          </form>
        </div>
        <p className="pb-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} PeopleNex HRMS · Powered by Sysnac</p>
      </main>
    </div>
  )
}

function StepRail({ step, trialDays, onJump }) {
  return (
    <aside className="relative hidden w-[38%] max-w-[520px] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-navy via-[#0b2a5c] to-blue-800 p-10 text-white lg:flex">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-400/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white"><img src={logoIcon} alt="" className="h-6 w-6" /></span>
        <span className="text-lg font-semibold tracking-tight">PeopleNex <span className="font-normal text-blue-200">HRMS</span></span>
      </div>

      <div className="relative">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight">Let’s get you set up</h1>
        <p className="mt-2 text-sm text-blue-200">Four quick steps — your workspace is ready in under two minutes.</p>
        <ol className="mt-10">
          {STEPS.map((s, i) => {
            const done = i < step
            const current = i === step
            return (
              <li key={s.title} className="relative flex gap-4 pb-9 last:pb-0">
                {i < STEPS.length - 1 && <span className={cn('absolute left-[17px] top-10 h-[calc(100%-2.75rem)] w-0.5 rounded-full', done ? 'bg-emerald-400/70' : 'bg-white/15')} />}
                <button type="button" onClick={() => onJump(i)} disabled={!done}
                  className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 transition-colors',
                    done ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/60 hover:bg-emerald-500/30'
                      : current ? 'bg-white text-blue-700 ring-white shadow-lg shadow-blue-900/40' : 'bg-white/5 text-blue-200/60 ring-white/15')}>
                  {done ? <Check size={16} /> : i + 1}
                </button>
                <div className={cn('pt-1', !done && !current && 'opacity-50')}>
                  <p className="text-[15px] font-semibold">{s.title}</p>
                  <p className="text-[13px] text-blue-200">{s.hint}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="relative flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 text-[13px] text-blue-100 ring-1 ring-white/15">
        <Gift size={18} className="shrink-0 text-emerald-300" />
        <span><span className="font-semibold text-white">{trialDays}-day free trial</span> on every plan · no card needed today</span>
      </div>
    </aside>
  )
}

function StepHeading({ title, subtitle }) {
  return (
    <div className="mb-7">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  )
}

function IconInput({ icon: Icon, className, ...props }) {
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input className={cn('h-10 pl-9', className)} {...props} />
    </div>
  )
}

function AccountStep({ form, set, verified, onVerified, onResetVerification }) {
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(null) // { email, devCode }
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const email = form.email.trim().toLowerCase()
  const sendCode = useMutation({
    mutationFn: () => billingApi.sendSignupCode(email),
    onSuccess: (res) => {
      setSent({ email, devCode: res.data.data?.dev_code })
      setCode('')
      setCooldown(res.data.data?.resend_in ?? 60)
    },
  })
  const verify = useMutation({
    mutationFn: () => billingApi.verifySignupCode(email, code),
    onSuccess: (res) => { onVerified({ email, token: res.data.data.verification_token }); setSent(null) },
  })

  const awaitingCode = sent && sent.email === email && !verified

  return (
    <>
      <StepHeading title="Create your admin account" subtitle="This will be your primary login for the workspace." />
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required>
            <IconInput icon={User} value={form.first_name} autoComplete="given-name" onChange={(e) => set({ first_name: e.target.value })} autoFocus />
          </Field>
          <Field label="Last name">
            <IconInput icon={User} value={form.last_name} autoComplete="family-name" onChange={(e) => set({ last_name: e.target.value })} />
          </Field>
        </div>

        <Field label="Work email" required error={sendCode.error ? apiError(sendCode.error) : undefined}>
          <div className="flex gap-2">
            <div className="flex-1">
              <IconInput icon={Mail} type="email" value={form.email} autoComplete="email" placeholder="you@company.com" readOnly={verified}
                className={cn(verified && 'border-emerald-300 bg-emerald-50/40')}
                onChange={(e) => { set({ email: e.target.value }); setSent(null) }} />
            </div>
            {verified ? (
              <Button type="button" variant="secondary" size="lg" icon={Pencil} onClick={() => { onResetVerification(); setSent(null) }}>Change</Button>
            ) : (
              <Button type="button" variant={awaitingCode ? 'secondary' : 'primary'} size="lg" className="min-w-[118px]"
                disabled={!emailOk(form.email) || cooldown > 0} loading={sendCode.isPending} onClick={() => sendCode.mutate()}>
                {awaitingCode ? (cooldown > 0 ? `Resend ${cooldown}s` : 'Resend code') : 'Verify email'}
              </Button>
            )}
          </div>
        </Field>

        {verified && (
          <p className="-mt-1 flex items-center gap-1.5 text-[13px] font-medium text-emerald-600"><CheckCircle2 size={16} /> Email verified</p>
        )}

        {awaitingCode && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-[13px] text-slate-700">We sent a 6-digit code to <span className="font-semibold">{sent.email}</span>. It expires in 10 minutes.</p>
            {sent.devCode && <p className="mt-1 text-xs text-amber-700">Development mode — your code is <span className="font-mono font-semibold">{sent.devCode}</span></p>}
            <div className="mt-3 flex gap-2">
              <Input value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" autoFocus
                className="h-10 max-w-[180px] text-center font-mono text-lg tracking-[0.4em]"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (code.length === 6) verify.mutate() } }} />
              <Button type="button" size="lg" disabled={code.length !== 6} loading={verify.isPending} onClick={() => verify.mutate()}>Confirm code</Button>
            </div>
            {verify.error && <p className="mt-2 text-xs text-rose-600">{apiError(verify.error)}</p>}
          </div>
        )}

        <Field label="Password" required hint="At least 8 characters, with letters and numbers.">
          <div className="relative">
            <IconInput icon={Lock} type={showPassword ? 'text' : 'password'} value={form.password} autoComplete="new-password" className="pr-10"
              onChange={(e) => set({ password: e.target.value })} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.password && <PasswordMeter value={form.password} />}
        </Field>
      </div>
    </>
  )
}

function PasswordMeter({ value }) {
  const score = [value.length >= 8, /[a-z]/i.test(value) && /\d/.test(value), value.length >= 12, /[^a-z0-9]/i.test(value)].filter(Boolean).length
  const tones = ['bg-rose-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500']
  return (
    <div className="mt-2 flex gap-1">
      {[0, 1, 2, 3].map((i) => <span key={i} className={cn('h-1 flex-1 rounded-full', i < score ? tones[score - 1] : 'bg-slate-200')} />)}
    </div>
  )
}

function WorkspaceStep({ form, set, industries }) {
  return (
    <>
      <StepHeading title="Workspace details" subtitle="What should we call your workspace? You can change these later." />
      <div className="space-y-4">
        <Field label="Organisation name" required>
          <IconInput icon={Building2} value={form.company_name} placeholder="e.g. Velocity Motors" onChange={(e) => set({ company_name: e.target.value })} autoFocus />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Industry" hint="We’ll set up departments, shifts and leave types to match.">
            <Select className="h-10" value={form.industry} onChange={(e) => set({ industry: e.target.value })}>
              {Object.entries(industries).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Contact phone">
            <div className="flex">
              <span className="flex h-10 items-center gap-1.5 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-600">
                <Phone size={14} className="text-slate-400" />+91
              </span>
              <Input className="h-10 rounded-l-none" inputMode="tel" value={form.company_phone} placeholder="98765 43210"
                onChange={(e) => set({ company_phone: e.target.value.replace(/[^\d ]/g, '').slice(0, 14) })} />
            </div>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="State" hint="Decides GST on invoices." className="sm:col-span-1">
            <Select className="h-10" value={form.state} onChange={(e) => set({ state: e.target.value })}>
              <option value="">Select…</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="City"><Input className="h-10" value={form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label="PIN code"><Input className="h-10" inputMode="numeric" maxLength={6} value={form.postal_code} onChange={(e) => set({ postal_code: e.target.value.replace(/\D/g, '') })} /></Field>
        </div>
        <Field label="Address">
          <div className="relative">
            <MapPin size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
            <Textarea className="pl-9" rows={3} value={form.address_line1} placeholder="Building, street, area" onChange={(e) => set({ address_line1: e.target.value })} />
          </div>
        </Field>
      </div>
    </>
  )
}

function PlanStep({ form, set, plans, cycles, trialPlan, trialDays }) {
  const cycle = cycles.find((c) => c.key === form.billing_cycle) ?? cycles[0]
  return (
    <>
      <StepHeading title="Choose your plan" subtitle={`Every plan starts with a ${trialDays}-day free trial. Switch or cancel any time.`} />
      <CycleToggle cycles={cycles} value={cycle.key} onChange={(key) => set({ billing_cycle: key })} className="mb-5" />
      <div className="space-y-3">
        {plans.map((p) => {
          const selected = form.plan_code === p.code
          const price = planPrice(p, cycle)
          const Icon = PLAN_ICONS[p.code] ?? Zap
          const limits = p.limits ?? {}
          return (
            <button key={p.code} type="button" onClick={() => set({ plan_code: p.code })}
              className={cn('relative w-full rounded-2xl border bg-white p-5 text-left transition-all',
                selected ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm')}>
              <div className="flex items-start gap-4">
                <div className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')}>
                  <Icon size={20} />
                  {selected && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                      <Check size={11} className="text-white" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-lg font-semibold text-slate-900">{p.name}</p>
                    {p.code === trialPlan && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-600/20">Most popular</span>}
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">{trialDays} days free</span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-slate-500">{p.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{money(price.perMonth)}<span className="text-xs font-medium text-slate-400">/mo</span></p>
                  {cycle.discount_percent > 0 && <p className="text-xs text-slate-400 line-through tabular-nums">{money(price.listPerMonth)}/mo</p>}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 pl-[60px]">
                {p.features.filter((f) => FEATURE_LABELS[f]).map((f) => (
                  <span key={f} className={cn('rounded-md px-2 py-1 text-[11px] font-medium', selected ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-600')}>{FEATURE_LABELS[f]}</span>
                ))}
              </div>
              <p className="mt-3 pl-[60px] text-xs text-slate-500">
                {cycle.months > 1 && <><span className="font-medium text-slate-700">{money(price.perPeriod)}</span> billed every {CYCLE_NOUN[cycle.key]} · </>}
                Includes {p.included_employees} employees, then {money(p.per_employee_price)}/employee/month ·{' '}
                {limits.branches ? `${limits.branches} branch${limits.branches > 1 ? 'es' : ''}` : 'unlimited branches'} · + GST
              </p>
            </button>
          )
        })}
      </div>
    </>
  )
}

function ReviewRow({ label, children, tone, onEdit }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-[14px]">
      <span className="text-slate-500">{label}</span>
      <span className={cn('flex items-center gap-2 text-right font-medium', tone ?? 'text-slate-900')}>
        {children}
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-slate-300 hover:text-blue-600" aria-label={`Edit ${label}`}><Pencil size={13} /></button>
        )}
      </span>
    </div>
  )
}

function ReviewStep({ form, plan, cycle, trialDays, gstRate, onEdit }) {
  const [now] = useState(() => Date.now())
  const price = planPrice(plan, cycle)
  const gst = Math.round(price.perPeriod * gstRate) / 100
  const firstCharge = new Date(now + trialDays * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <>
      <StepHeading title="Confirm & launch" subtitle={<>Review your details for <span className="font-semibold text-slate-700">{form.company_name}</span>.</>} />
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-2 shadow-xs">
        <div className="divide-y divide-slate-100">
          <div>
            <ReviewRow label="Admin" onEdit={() => onEdit(0)}>{`${form.first_name} ${form.last_name}`.trim()}</ReviewRow>
            <ReviewRow label="Email"><span className="flex items-center gap-1.5">{form.email.trim().toLowerCase()}<ShieldCheck size={14} className="text-emerald-500" /></span></ReviewRow>
            <ReviewRow label="Workspace" onEdit={() => onEdit(1)}>{form.company_name}</ReviewRow>
          </div>
          <div>
            <ReviewRow label="Plan" tone="text-blue-700" onEdit={() => onEdit(2)}>{plan.name} ({cycle.label})</ReviewRow>
            <ReviewRow label="Free trial" tone="text-emerald-600">{trialDays} days</ReviewRow>
            <ReviewRow label="Taxable value">{money(price.perPeriod, { paise: true })}</ReviewRow>
            <ReviewRow label={`GST (${gstRate}%)`}>{money(gst, { paise: true })}</ReviewRow>
          </div>
          <div>
            <ReviewRow label={<>Due on {firstCharge} <span className="text-xs text-slate-400">incl. GST</span></>}>{money(price.perPeriod + gst, { paise: true })}</ReviewRow>
            <div className="flex items-center justify-between py-3">
              <span className="text-[15px] font-semibold text-slate-900">Due today</span>
              <span className="text-2xl font-semibold text-emerald-600">₹0</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
        <Gift size={18} className="mt-0.5 shrink-0 text-emerald-600" />
        <p>
          <span className="font-semibold">Your first {trialDays} days are free.</span> Nothing is charged today. We’ll email an invoice when the trial
          ends — pay online by UPI, card or net banking. Price shown is for up to {plan.included_employees} employees; cancel any time from Plan & Billing.
        </p>
      </div>
    </>
  )
}
