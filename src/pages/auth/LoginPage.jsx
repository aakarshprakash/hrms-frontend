import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/lib/api/auth'
import { billingApi } from '@/lib/api/billing'
import { apiError } from '@/lib/api/axios'
import { homePathFor } from '@/lib/session'
import AuthLayout from '@/components/layout/AuthLayout'
import { Button, Field, Input, ErrorBanner } from '@/components/ui/kit'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const qc = useQueryClient()
  const { data: publicConfig } = useQuery({
    queryKey: ['public-config'],
    queryFn: () => billingApi.publicConfig().then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
  // Why the previous session ended (deactivated account, suspended organisation...).
  const [serverError, setServerError] = useState(() => {
    const reason = sessionStorage.getItem('hrms-logout-reason')
    sessionStorage.removeItem('hrms-logout-reason')
    return reason ?? ''
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data) {
    setServerError('')
    try {
      const res = await authApi.login(data)
      const { user, token, branches, company, features, subscription } = res.data.data ?? res.data
      qc.clear()
      setAuth(user, token, branches ?? [], { company, features, subscription })
      navigate(homePathFor(user), { replace: true })
    } catch (err) {
      setServerError(err.response?.status === 429
        ? 'Too many sign-in attempts. Please wait a minute and try again.'
        : apiError(err, 'Login failed. Please try again.'))
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your PeopleNex workspace."
      footer={publicConfig?.signup && <>New to PeopleNex? <Link to="/signup" className="font-semibold text-blue-600 hover:underline">Start a free trial</Link></>}>
      {params.get('reset') && !serverError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-700">
          <CheckCircle2 size={16} /> Password updated — sign in with your new password.
        </div>
      )}
      <ErrorBanner message={serverError || undefined} className="mb-4" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Work email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" className={cn('h-10', errors.email && 'border-rose-400')} {...register('email')} />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-[13px] font-medium text-slate-700">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-blue-600 hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
              className={cn('h-10 pr-10', errors.password && 'border-rose-400')} {...register('password')} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </AuthLayout>
  )
}
