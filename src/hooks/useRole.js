import { useAuthStore } from '@/store/authStore'

/**
 * Access helpers mirroring the API's model: permissions decide what a user
 * can do, data_scope (company / branch / team / self) whose records they see.
 * The API always enforces the same rules -- this only shapes the UI.
 */
export function useRole() {
  const user = useAuthStore((s) => s.user)
  const features = useAuthStore((s) => s.features)
  const supportCompanyId = useAuthStore((s) => s.supportCompanyId)

  const roles = user?.roles ?? []
  const permissions = user?.permissions ?? []

  const isPlatformAdmin = !!user?.is_platform_admin
  const isTenantAdmin = !!user?.is_tenant_admin
  // Sees and manages the whole organisation.
  const isCompanyAdmin = isTenantAdmin || isPlatformAdmin
  const dataScope = user?.data_scope ?? (isCompanyAdmin ? 'company' : 'self')

  const hasRole = (...check) => check.some((r) => roles.includes(r))
  const can = (...perms) => isCompanyAdmin || perms.some((p) => permissions.includes(p))
  const hasFeature = (...keys) => keys.every((k) => (features ?? []).includes(k))

  const canManageEmployees = can('employees.manage')
  const canViewEmployees = true

  return {
    user, roles, permissions, dataScope, features,
    hasRole, can, hasFeature,
    isPlatformAdmin, isTenantAdmin, isCompanyAdmin,
    inSupportMode: isPlatformAdmin && !!supportCompanyId,
    // Legacy name used across pages: "sees the whole organisation".
    isSuperAdmin: isCompanyAdmin,
    canManageEmployees, canViewEmployees,
    isEmployeeOnly: dataScope === 'self',
  }
}
