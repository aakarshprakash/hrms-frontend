import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { refreshSession } from '@/lib/session'

const PLATFORM_PATHS = ['/platform', '/account']

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const supportCompanyId = useAuthStore((s) => s.supportCompanyId)
  const location = useLocation()
  const refreshed = useRef(false)

  // Pick up role / permission / plan changes made since sign-in.
  useEffect(() => {
    if (token && !refreshed.current) {
      refreshed.current = true
      refreshSession().catch(() => { /* a 401 is handled by the API client */ })
    }
  }, [token])

  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  // The platform operator works in the platform console unless they have
  // explicitly entered an organisation in support mode.
  if (user?.is_platform_admin && !supportCompanyId && !PLATFORM_PATHS.some((p) => location.pathname.startsWith(p))
    && location.pathname !== '/change-password') {
    return <Navigate to="/platform" replace />
  }

  return <Outlet />
}
