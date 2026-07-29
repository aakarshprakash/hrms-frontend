import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { authApi } from '@/lib/api/auth'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data) {
    setServerError('')
    try {
      await authApi.forgotPassword(data)
      setSent(true)
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Something went wrong.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white text-xl font-bold">H</div>
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">We'll email you a reset link</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center text-sm text-green-700">
            Check your inbox — a reset link has been sent.
            <div className="mt-4">
              <Link to="/login" className="text-blue-600 hover:underline">Back to sign in</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            {serverError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{serverError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">Email address</label>
              <input
                id="email" type="email" autoComplete="email" {...register('email')}
                className={cn(
                  'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                  errors.email && 'border-red-400'
                )}
                placeholder="you@company.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-center text-sm text-slate-500">
              <Link to="/login" className="text-blue-600 hover:underline">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
