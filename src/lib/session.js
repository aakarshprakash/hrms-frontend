import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/store/authStore'

/** Re-read the session from the API (after support-mode switches, profile or plan changes). */
export async function refreshSession() {
  const res = await authApi.me()
  const payload = res.data?.data ?? {}
  useAuthStore.getState().setSession(payload)
  return payload
}

/** Where a freshly signed-in user should land. */
export function homePathFor(user) {
  if (user?.must_change_password) return '/change-password'
  if (user?.is_platform_admin) return '/platform'
  return '/dashboard'
}

/** Platform admin: act inside an organisation. */
export async function enterSupportMode(companyId) {
  useAuthStore.getState().enterSupportMode(companyId)
  return refreshSession()
}

export async function exitSupportMode() {
  useAuthStore.getState().exitSupportMode()
  return refreshSession()
}
