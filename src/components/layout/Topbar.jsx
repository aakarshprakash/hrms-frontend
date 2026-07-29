import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/lib/api/auth'
import { Menu, ChevronDown, Building2, LogOut, Bell } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function Topbar({ onMenuClick }) {
  const navigate = useNavigate()
  const { user, branches, activeBranchId, setActiveBranch, logout } = useAuthStore()
  const [branchOpen, setBranchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? branches[0]

  async function handleLogout() {
    try { await authApi.logout() } catch (_) {}
    logout()
    navigate('/login')
  }

  const initials = user?.name
    ?.split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'U'

  return (
    <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 backdrop-blur px-4 md:px-6 shadow-sm shrink-0 sticky top-0 z-10">
      <button onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden transition-colors"
        aria-label="Open menu">
        <Menu size={20} />
      </button>

      {/* Page breadcrumb placeholder / search space */}
      <div className="flex-1" />

      {/* Notification bell */}
      <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
      </button>

      {/* Branch switcher */}
      {branches.length > 0 && (
        <div className="relative">
          <button
            onClick={() => { setBranchOpen((v) => !v); setProfileOpen(false) }}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Building2 size={15} className="text-blue-500 shrink-0" />
            <span className="hidden sm:block max-w-[130px] truncate">{activeBranch?.name ?? 'Select Branch'}</span>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
          </button>

          {branchOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBranchOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Switch Branch</p>
                </div>
                <div className="py-1">
                  {branches.map((branch) => (
                    <button key={branch.id}
                      onClick={() => { setActiveBranch(branch.id); setBranchOpen(false) }}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors',
                        activeBranch?.id === branch.id
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      )}>
                      <Building2 size={14} className={activeBranch?.id === branch.id ? 'text-blue-500' : 'text-slate-400'} />
                      {branch.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Profile menu */}
      <div className="relative">
        <button
          onClick={() => { setProfileOpen((v) => !v); setBranchOpen(false) }}
          className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-bold shadow-sm">
            {initials}
          </div>
          <span className="hidden sm:block max-w-[110px] truncate">{user?.name ?? 'User'}</span>
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </button>

        {profileOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                    {user?.roles?.[0] && (
                      <span className="inline-block mt-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 capitalize">
                        {user.roles[0].replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="py-1">
                <button onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
