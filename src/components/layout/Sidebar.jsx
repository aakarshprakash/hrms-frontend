import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/useRole'
import {
  LayoutDashboard, Users, Clock, CalendarDays, DollarSign, Award,
  BarChart2, ChevronLeft, Menu, Building, Briefcase, CalendarRange,
  Timer, ChevronDown, ChevronRight as ChevronRightIcon, Briefcase as RecruitIcon,
  Star, Settings, Sparkles, ShieldCheck,
} from 'lucide-react'

const MANAGE = ['super_admin', 'branch_admin', 'hr', 'manager']
const ADMIN = ['super_admin', 'branch_admin']

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/insights', icon: Sparkles, label: 'AI Insights', roles: MANAGE, perms: ['insights.view'] },
  { to: '/employees', icon: Users, label: 'Employees' },
  { to: '/departments', icon: Building, label: 'Departments', roles: MANAGE, perms: ['departments.manage'] },
  { to: '/designations', icon: Briefcase, label: 'Designations', roles: MANAGE, perms: ['departments.manage'] },
  {
    label: 'Attendance', icon: Clock, group: true, prefix: '/attendance',
    children: [
      { to: '/attendance', label: 'My Attendance' },
      { to: '/attendance/manage', label: 'Manage Attendance', roles: MANAGE, perms: ['attendance.view', 'attendance.manage'] },
      { to: '/attendance/regularizations', label: 'Regularization' },
      { to: '/attendance/reports', label: 'Reports', roles: MANAGE, perms: ['attendance.view'] },
      { to: '/attendance/muster-roll', label: 'Muster Roll', roles: MANAGE, perms: ['attendance.view'] },
      { to: '/attendance/exceptions', label: 'Exceptions', roles: MANAGE, perms: ['attendance.view'] },
      { to: '/shifts/roster', label: 'Shift Roster' },
      { to: '/shifts/swaps', label: 'Shift Swaps' },
      { to: '/shifts/holidays', label: 'Holidays' },
      { to: '/settings/shifts', label: 'Shift Settings', roles: MANAGE, perms: ['shifts.manage'] },
      { to: '/settings/biometric', label: 'Biometric Sync', roles: ADMIN, perms: ['settings.manage'] },
      { to: '/overtime', label: 'Overtime' },
    ],
  },
  {
    label: 'Leave', icon: CalendarDays, group: true, prefix: '/leaves',
    children: [
      { to: '/leaves', label: 'Leave Requests' },
      { to: '/leaves/apply', label: 'Apply for Leave' },
    ],
  },
  {
    label: 'Payroll', icon: DollarSign, group: true, prefix: '/payroll', roles: MANAGE, perms: ['payroll.view', 'payroll.manage'],
    children: [
      { to: '/payroll', label: 'Cost Summary' },
      { to: '/payroll/runs', label: 'Payroll Runs' },
      { to: '/payroll/payslips', label: 'Payslips' },
    ],
  },
  { to: '/certificates', icon: Award, label: 'Certificates' },
  { to: '/settings/users', icon: ShieldCheck, label: 'User Management', roles: ADMIN, perms: ['users.manage'] },
  { to: '/settings/roles', icon: ShieldCheck, label: 'Roles & Permissions', superOnly: true },
  { to: '/recruitment', icon: RecruitIcon, label: 'Recruitment', roles: MANAGE },
  { to: '/performance', icon: Star, label: 'Performance', roles: MANAGE },
  { to: '/reports', icon: BarChart2, label: 'Reports', roles: MANAGE },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ADMIN, perms: ['settings.manage'] },
]

function NavGroup({ item, sidebarOpen, allowed }) {
  const location = useLocation()
  const isActive = location.pathname.startsWith(item.prefix)
  const [expanded, setExpanded] = useState(isActive)
  const Icon = item.icon
  const children = item.children.filter((c) => allowed(c))

  return (
    <div>
      <button onClick={() => setExpanded((e) => !e)}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
          isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        )}>
        <Icon size={18} className="shrink-0" />
        {sidebarOpen && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {expanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
          </>
        )}
      </button>
      {expanded && sidebarOpen && (
        <div className="ml-4 mt-1 border-l border-slate-700 pl-3 space-y-0.5">
          {children.map((child) => (
            <NavLink key={child.to} to={child.to} end={child.to === item.prefix}
              className={({ isActive }) => cn(
                'flex items-center rounded-md px-2 py-1.5 text-sm transition-colors',
                isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )}>
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ open, onToggle }) {
  const { isSuperAdmin, hasRole, can } = useRole()
  const allowed = (item) => {
    if (item.superOnly) return isSuperAdmin
    if (!item.roles && !item.perms) return true
    return isSuperAdmin
      || (item.roles && hasRole(...item.roles))
      || (item.perms && can(...item.perms))
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onToggle} />}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-300 ease-in-out',
        'bg-gradient-to-b from-slate-900 to-slate-800',
        open ? 'w-64' : 'w-0 overflow-hidden lg:w-[68px] lg:overflow-visible',
        'lg:relative lg:flex shadow-xl'
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/5 shrink-0">
          {open ? (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">AutoStaff</span>
            </div>
          ) : (
            <div className="mx-auto h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
          )}
          <button onClick={onToggle}
            className={cn('rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors', !open && 'hidden lg:flex')}
            aria-label="Toggle sidebar">
            {open ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
          {navItems.filter(allowed).map((item) => {
            if (item.group) return <NavGroup key={item.label} item={item} sidebarOpen={open} allowed={allowed} />
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                )}>
                <Icon size={18} className="shrink-0" />
                {open && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {open && (
          <div className="px-4 py-3 border-t border-white/5">
            <p className="text-xs text-slate-500">AutoStaff v1.0</p>
          </div>
        )}
      </aside>
    </>
  )
}
