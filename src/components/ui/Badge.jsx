import { cn } from '@/lib/utils'

const variants = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-600',
  terminated: 'bg-red-100 text-red-600',
  default: 'bg-blue-100 text-blue-700',
}

export function Badge({ label, variant = 'default', className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', variants[variant] ?? variants.default, className)}>
      {label}
    </span>
  )
}
