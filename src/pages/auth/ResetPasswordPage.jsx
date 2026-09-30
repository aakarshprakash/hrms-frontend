import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { authApi } from '@/lib/api/auth'
import AuthLayout from '@/components/layout/AuthLayout'
import { Button, Field, Input, ErrorBanner } from '@/components/ui/kit'

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters'),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, { message: "Passwords don't match", path: ['password_confirmation'] })

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data) {
    setError(null)
    try {
      await authApi.resetPassword({ ...data, token: params.get('token'), email: params.get('email') })
      navigate('/login?reset=1')
    } catch (err) {
      setError(err)
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle={params.get('email') ? `For ${params.get('email')}` : undefined}
      footer={<Link to="/login" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"><ArrowLeft size={14} />Back to sign in</Link>}>
      <ErrorBanner error={error} className="mb-4" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="New password" hint="At least 8 characters." error={errors.password?.message}>
          <div className="relative">
            <Input id="password" type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" className="h-10 pr-10" {...register('password')} />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <Field label="Confirm password" error={errors.password_confirmation?.message}>
          <Input id="password_confirmation" type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" className="h-10" {...register('password_confirmation')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </AuthLayout>
  )
}
