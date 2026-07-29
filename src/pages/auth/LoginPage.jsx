import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/lib/api/auth'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data) {
    setServerError('')
    try {
      const res = await authApi.login(data)
      const { user, token, branches } = res.data.data ?? res.data
      setAuth(user, token, branches ?? [])
      navigate('/dashboard')
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Login failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-500/10" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-blue-400/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full border border-blue-500/10" />

        <div className="relative z-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30">
            <span className="text-white font-bold text-2xl">A</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">AutoStaff</h2>
          <p className="text-blue-200 text-base max-w-xs leading-relaxed">
            Showroom HR Platform — built for vehicle dealerships and automotive sales teams.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            {[
              { emoji: '🚗', label: 'Showroom Ready', desc: 'Built for dealerships' },
              { emoji: '📅', label: 'Attendance', desc: 'Track with offline sync' },
              { emoji: '🌴', label: 'Leave mgmt', desc: 'Smart approval flow' },
              { emoji: '💰', label: 'Payroll', desc: 'Incentives & commissions' },
            ].map((f) => (
              <div key={f.label} className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-xl mb-1">{f.emoji}</p>
                <p className="text-sm font-semibold text-white">{f.label}</p>
                <p className="text-xs text-blue-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">AutoStaff HRMS</h1>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">AutoStaff — Showroom HR Platform</h1>
            <p className="mt-1 text-sm text-slate-500">Built for vehicle dealerships</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {serverError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  placeholder="you@company.com"
                  className={cn(
                    'w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all',
                    'focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15',
                    errors.email ? 'border-red-400' : 'border-slate-200'
                  )}
                />
                {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('password')}
                    placeholder="••••••••"
                    className={cn(
                      'w-full rounded-xl border bg-slate-50 px-4 py-2.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all',
                      'focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15',
                      errors.password ? 'border-red-400' : 'border-slate-200'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/25 focus:outline-none focus:ring-3 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            AutoStaff HRMS · Powered by SYSNA
          </p>
        </div>
      </div>
    </div>
  )
}
