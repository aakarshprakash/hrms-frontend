import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Menu, ChevronDown, Building2, LogOut, KeyRound, LifeBuoy, X, BellRing, Search, Plus, CalendarPlus, UserPlus,
  Clock, IndianRupee, Timer, UserCircle2, Check,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/lib/api/auth'
import { exitSupportMode } from '@/lib/session'
import { useRole } from '@/hooks/useRole'
import { Avatar } from '@/components/ui/kit'
import NotificationBell from './NotificationBell'
import CommandPalette from './CommandPalette'
import { cn } from '@/lib/utils'

function Dropdown({ open, onClose, children, className }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={cn('absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5', className)}>
        {children}
      </div>
    </>
  )
}

function MenuLink({ to, icon: Icon, children, onClick, hint }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
      <Icon size={15} className="text-slate-400" />
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </Link>
  )
}

export default function Topbar({ onMenuClick }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, branches, activeBranchId, setActiveBranch, logout, company } = useAuthStore()
  const { inSupportMode, can, hasFeature, isPlatformAdmin } = useRole()
  const [menu, setMenu] = useState(null) // branch | profile | create
  const [searching, setSearching] = useState(false)

  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? branches[0]
  const roleLabel = user?.is_platform_admin ? 'Platform admin' : user?.is_tenant_admin ? 'Organisation admin' : user?.roles?.[0]?.replace(/_/g, ' ')
  const platformOnly = isPlatformAdmin && !inSupportMode
  const close = () => setMenu(null)

  // Ctrl/⌘ K opens search from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearching(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleLogout() {
    try { await authApi.logout() } catch { /* already invalid */ }
    logout()
    qc.clear()
    navigate('/login')
  }

  async function leaveSupport() {
    await exitSupportMode()
    qc.clear()
    navigate('/platform')
  }

  const creates = platformOnly ? [] : [
    user?.employee_id && { to: '/leaves/apply', icon: CalendarPlus, label: 'Apply leave' },
    can('employees.manage') && { to: '/employees/new', icon: UserPlus, label: 'Add employee' },
    user?.employee_id && { to: '/attendance/regularizations', icon: Clock, label: 'Attendance correction' },
    user?.employee_id && { to: '/overtime', icon: Timer, label: 'Claim overtime' },
    can('payroll.manage') && hasFeature('payroll') && { to: '/payroll/runs', icon: IndianRupee, label: 'Run payroll' },
  ].filter(Boolean)

  return (
    <>
      {inSupportMode && (
        <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-amber-950">
          <LifeBuoy size={14} />
          Support mode — you are acting inside <span className="underline">{company?.name ?? 'an organisation'}</span>. Changes are recorded in its audit trail.
          <button onClick={leaveSupport} className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-950/10 px-2 py-0.5 hover:bg-amber-950/20">
            <X size={12} /> Exit
          </button>
        </div>
      )}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
        <button onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Open menu">
          <Menu size={20} />
        </button>

        <button onClick={() => setSearching(true)}
          className="flex h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-400 transition-colors hover:border-slate-300 hover:bg-white">
          <Search size={15} />
          <span className="flex-1 truncate text-left">{platformOnly ? 'Search pages…' : 'Search people, pages, actions…'}</span>
          <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-px text-[10px] font-medium text-slate-500 sm:inline">Ctrl K</kbd>
        </button>

        <div className="flex-1" />

        {creates.length > 0 && (
          <div className="relative">
            <button onClick={() => setMenu(menu === 'create' ? null : 'create')}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] font-medium text-white shadow-xs hover:bg-blue-700">
              <Plus size={16} /><span className="hidden sm:inline">Create</span>
            </button>
            <Dropdown open={menu === 'create'} onClose={close} className="w-56 py-1">
              {creates.map((c) => <MenuLink key={c.to + c.label} to={c.to} icon={c.icon} onClick={close}>{c.label}</MenuLink>)}
            </Dropdown>
          </div>
        )}

        {!platformOnly && <NotificationBell />}

        {branches.length > 1 && (
          <div className="relative hidden md:block">
            <button onClick={() => setMenu(menu === 'branch' ? null : 'branch')}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
              <Building2 size={15} className="shrink-0 text-slate-400" />
              <span className="max-w-[160px] truncate">{activeBranch?.name ?? 'Select branch'}</span>
              <ChevronDown size={14} className="shrink-0 text-slate-400" />
            </button>
            <Dropdown open={menu === 'branch'} onClose={close} className="w-64">
              <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Working in branch</p>
              <div className="max-h-72 overflow-y-auto py-1">
                {branches.map((branch) => (
                  <button key={branch.id} onClick={() => { setActiveBranch(branch.id); close() }}
                    className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors',
                      activeBranch?.id === branch.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-50')}>
                    <span className="flex-1 truncate">{branch.name}</span>
                    {branch.city && <span className="text-[11px] text-slate-400">{branch.city}</span>}
                    {activeBranch?.id === branch.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </Dropdown>
          </div>
        )}

        <div className="relative">
          <button onClick={() => setMenu(menu === 'profile' ? null : 'profile')}
            className="flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100">
            <Avatar name={user?.name} size="sm" />
            <span className="hidden max-w-[130px] truncate lg:block">{user?.name ?? 'User'}</span>
            <ChevronDown size={14} className="hidden shrink-0 text-slate-400 lg:block" />
          </button>
          <Dropdown open={menu === 'profile'} onClose={close} className="w-64">
            <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3">
              <Avatar name={user?.name} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-900">{user?.name}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
                {roleLabel && <p className="mt-0.5 text-[11px] font-medium capitalize text-blue-600">{roleLabel}</p>}
              </div>
            </div>
            <div className="py-1">
              {user?.employee_id && <MenuLink to={`/employees/${user.employee_id}`} icon={UserCircle2} onClick={close}>My profile</MenuLink>}
              <MenuLink to="/account/notifications" icon={BellRing} onClick={close}>Notification preferences</MenuLink>
              <MenuLink to="/account/security" icon={KeyRound} onClick={close}>Password & security</MenuLink>
            </div>
            <div className="border-t border-slate-100 py-1">
              <button onClick={handleLogout} className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-rose-600 hover:bg-rose-50">
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </Dropdown>
        </div>
      </header>

      <CommandPalette open={searching} onClose={() => setSearching(false)} />
    </>
  )
}
