import { NavLink } from 'react-router-dom'
import { FileBarChart2, AlertTriangle, Fingerprint } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/attendance/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/attendance/exceptions', label: 'Exceptions', icon: AlertTriangle },
  { to: '/attendance/punches', label: 'Punch log', icon: Fingerprint },
]

/** Switches between attendance reports and the exception / punch work queues. */
export default function ReportNav({ className }) {
  return (
    <nav className={cn('mb-5 flex gap-6 overflow-x-auto border-b border-slate-200', className)}>
      {LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end
          className={({ isActive }) => cn('-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 text-[13px] font-medium transition-colors',
            isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800')}>
          <Icon size={15} />{label}
        </NavLink>
      ))}
    </nav>
  )
}
