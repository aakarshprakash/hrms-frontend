import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { authApi } from '@/lib/api/auth'

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters'),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, {
  message: "Passwords don't match",
  path: ['password_confirmation'],
})

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [showPw, setShowPw] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data) {
    setServerError('')
    try {
      await authApi.resetPassword({
        ...data,
        token: params.get('token'),
        email: params.get('email'),
      })
      navigate('/login?reset=1')
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Reset failed.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white text-xl font-bold">H</div>
          <h1 className="text-2xl font-bold text-slate-900">Set new password</h1>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{serverError}</div>
          )}
          {['password', 'password_confirmation'].map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={field}>
                {field === 'password' ? 'New password' : 'Confirm password'}
              </label>
              <div className="relative">
                <input
                  id={field} type={showPw ? 'text' : 'password'} {...register(field)}
                  className={cn(
                    'w-full rounded-md border bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                    errors[field] && 'border-red-400'
                  )}
                  placeholder="••••••••"
                />
                {field === 'password' && (
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
              {errors[field] && <p className="mt-1 text-xs text-red-500">{errors[field].message}</p>}
            </div>
          ))}
          <button type="submit" disabled={isSubmitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {isSubmitting ? 'Saving…' : 'Reset password'}
          </button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-blue-600 hover:underline">Back to sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
