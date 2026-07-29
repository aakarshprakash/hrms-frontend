import { useAuthStore } from '@/store/authStore'

export function useRole() {
  const user = useAuthStore((s) => s.user)
  // roles: array of role name strings; permissions: array of permission names
  const roles = user?.roles ?? []
  const permissions = user?.permissions ?? []

  const hasRole = (...check) => check.some((r) => roles.includes(r))
  const isSuperAdmin = !!user?.is_super_admin || hasRole('super_admin')
  const can = (...perms) => isSuperAdmin || perms.some((p) => permissions.includes(p))
  const canManageEmployees = isSuperAdmin || hasRole('branch_admin', 'hr') || can('employees.manage')
  const canViewEmployees = isSuperAdmin || hasRole('branch_admin', 'hr', 'manager', 'employee') || can('employees.view')

  return { user, roles, permissions, hasRole, can, isSuperAdmin, canManageEmployees, canViewEmployees }
}
