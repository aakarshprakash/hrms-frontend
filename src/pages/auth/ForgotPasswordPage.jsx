import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { MailCheck, ArrowLeft } from 'lucide-react'
import { authApi } from '@/lib/api/auth'
import AuthLayout from '@/components/layout/AuthLayout'
import { Button, Field, Input, ErrorBanner } from '@/components/ui/kit'

const schema = z.object({ email: z.string().email('Enter a valid email') })

const back = <Link to="/login" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"><ArrowLeft size={14} />Back to sign in</Link>

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState(null)
  const [error, setError] = useState(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data) {
    setError(null)
    try {
      await authApi.forgotPassword(data)
      setSentTo(data.email)
    } catch (err) {
      setError(err)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" footer={back}>
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><MailCheck size={20} /></div>
          <p className="text-[13px] text-slate-600">If an account exists for <strong className="text-slate-900">{sentTo}</strong>, a password reset link is on its way. It expires in 60 minutes.</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your work email and we'll send you a reset link." footer={back}>
      <ErrorBanner error={error} className="mb-4" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Work email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" className="h-10" {...register('email')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>
    </AuthLayout>
  )
}
