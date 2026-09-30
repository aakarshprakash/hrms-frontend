import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck, LogOut } from 'lucide-react'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/store/authStore'
import { homePathFor } from '@/lib/session'
import { Card, Button, Field, Input, ErrorBanner, PageHeader } from '@/components/ui/kit'

/**
 * Change password. Also the mandatory first step for accounts created with a
 * temporary password (must_change_password), in which case it renders
 * outside the app shell.
 */
export default function ChangePasswordPage({ forced = false }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const mismatch = form.password_confirmation && form.password !== form.password_confirmation

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await authApi.changePassword(form)
      const updated = { ...user, must_change_password: false }
      setUser(updated)
      setDone(true)
      if (forced) navigate(homePathFor(updated), { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  async function signOutEverywhere() {
    setSigningOut(true)
    try { await authApi.logoutAll() } catch { /* token is gone either way */ }
    logout()
    navigate('/login')
  }

  const formCard = (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner error={error} />
        {done && !forced && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Password changed. Your other devices have been signed out.
          </div>
        )}
        <Field label="Current password" required>
          <Input type="password" autoComplete="current-password" required value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
        </Field>
        <Field label="New password" required hint="At least 8 characters, with letters and numbers.">
          <Input type="password" autoComplete="new-password" required minLength={8} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Confirm new password" required error={mismatch ? 'Passwords do not match.' : undefined}>
          <Input type="password" autoComplete="new-password" required value={form.password_confirmation}
            onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} />
        </Field>
        <Button type="submit" className="w-full" loading={saving} disabled={mismatch}>Update password</Button>
      </form>
    </Card>
  )

  if (forced) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600"><KeyRound size={22} /></div>
            <h1 className="text-xl font-bold text-slate-900">Set your own password</h1>
            <p className="mt-1 text-sm text-slate-500">You signed in with a temporary password. Choose a new one to continue.</p>
          </div>
          {formCard}
          <button onClick={() => { logout(); navigate('/login') }} className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600">
            Sign out instead
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <PageHeader icon={ShieldCheck} title="Security" subtitle="Your password and active sessions." />
      {formCard}
      <Card className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">Sign out of all devices</p>
            <p className="text-sm text-slate-500">Use this if you lost a phone or signed in on a shared computer.</p>
          </div>
          <Button variant="secondary" icon={LogOut} loading={signingOut} onClick={signOutEverywhere}>Sign out everywhere</Button>
        </div>
      </Card>
    </div>
  )
}
