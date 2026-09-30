import { NavLink } from 'react-router-dom'
import { BarChart3, Grid3x3, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/attendance/reports', label: 'Summary', icon: BarChart3 },
  { to: '/attendance/muster-roll', label: 'Muster roll', icon: Grid3x3 },
  { to: '/attendance/exceptions', label: 'Exceptions', icon: AlertTriangle },
]

/** Switches between the attendance reports; sits under the page header. */
export default function ReportNav({ className }) {
  return (
    <nav className={cn('mb-5 flex gap-6 overflow-x-auto border-b border-slate-200', className)}>
      {LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to}
          className={({ isActive }) => cn('-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 text-[13px] font-medium transition-colors',
            isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800')}>
          <Icon size={15} />{label}
        </NavLink>
      ))}
    </nav>
  )
}
