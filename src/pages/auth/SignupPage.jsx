import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Building2, ArrowRight } from 'lucide-react'
import { billingApi } from '@/lib/api/billing'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { Button, Field, Input, Select, ErrorBanner } from '@/components/ui/kit'
import logo from '@/assets/brand/logo-white.png'

/** Self-serve sign-up: a new organisation on a free trial, signed straight in. */
export default function SignupPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ company_name: '', industry: 'automotive', state: '', admin_name: '', admin_email: '', admin_phone: '', admin_password: '' })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const { data: config, isLoading } = useQuery({ queryKey: ['public-config'], queryFn: () => billingApi.publicConfig().then((r) => r.data.data) })

  const signup = useMutation({
    mutationFn: () => billingApi.signup(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || undefined]))),
    onSuccess: (res) => {
      const { user, token, branches, company, features, subscription } = res.data.data
      setAuth(user, token, branches ?? [], { company, features, subscription })
      navigate('/settings/quick-setup')
    },
  })

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden w-[42%] flex-col justify-between bg-gradient-to-br from-brand-navy to-blue-800 p-10 text-white lg:flex">
        <img src={logo} alt="Peoplenex" className="h-9 w-auto self-start" />
        <div>
          <h1 className="text-3xl font-bold leading-tight">HR, attendance and payroll for every branch.</h1>
          <p className="mt-3 text-blue-100">Biometric punches, shifts, leave, PF / ESI / PT / TDS payroll and WhatsApp alerts — set up for your industry in minutes.</p>
        </div>
        <p className="text-sm text-blue-200">{config?.trial_days ?? 14}-day free trial · no card needed</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        {!config?.signup ? (
          <div className="max-w-sm text-center">
            <h2 className="text-xl font-bold text-slate-900">Sign-ups are by invitation</h2>
            <p className="mt-2 text-sm text-slate-500">Contact us to set up your organisation.</p>
            <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-blue-600">Back to sign in</Link>
          </div>
        ) : (
          <form className="w-full max-w-md space-y-4" onSubmit={(e) => { e.preventDefault(); signup.mutate() }}>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Start your free trial</h2>
              <p className="text-sm text-slate-500">Already have an account? <Link to="/login" className="font-semibold text-blue-600">Sign in</Link></p>
            </div>
            <ErrorBanner error={signup.error} />
            <Field label="Organisation name" required><Input value={form.company_name} onChange={(e) => set({ company_name: e.target.value })} placeholder="e.g. Velocity Motors" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry">
                <Select value={form.industry} onChange={(e) => set({ industry: e.target.value })}>
                  {Object.entries(config.industries).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="State"><Input value={form.state} onChange={(e) => set({ state: e.target.value })} placeholder="Kerala" /></Field>
            </div>
            <Field label="Your name" required><Input value={form.admin_name} onChange={(e) => set({ admin_name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Work email" required><Input type="email" value={form.admin_email} onChange={(e) => set({ admin_email: e.target.value })} /></Field>
              <Field label="Mobile"><Input value={form.admin_phone} onChange={(e) => set({ admin_phone: e.target.value })} /></Field>
            </div>
            <Field label="Password" required hint="At least 8 characters, letters and numbers."><Input type="password" value={form.admin_password} onChange={(e) => set({ admin_password: e.target.value })} /></Field>
            <Button type="submit" className="w-full" size="lg" icon={signup.isPending ? undefined : Building2} loading={signup.isPending}>
              Create my organisation <ArrowRight size={16} />
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
