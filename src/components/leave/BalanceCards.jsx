import { Infinity as InfinityIcon, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACCRUAL_LABELS, num, typeColor } from '@/lib/leave'

export function LeaveTypeChip({ type, className, showCode = false }) {
  if (!type) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium text-slate-800', className)}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: typeColor(type) }} />
      <span className="truncate">{type.name}</span>
      {showCode && type.code && <span className="rounded bg-slate-100 px-1 font-mono text-[10px] text-slate-500">{type.code}</span>}
    </span>
  )
}

/**
 * One card per leave type the employee can use: what's available now
 * (balance minus pending requests), out of what has been credited.
 */
export function BalanceCards({ rows = [], onOpen, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[118px] animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
    )
  }
  if (!rows.length) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {rows.map((row) => {
        const color = typeColor(row.leave_type)
        const clickable = !!onOpen && !!row.balance_id
        const Comp = clickable ? 'button' : 'div'
        const credited = row.allocated
        const pct = credited > 0 ? Math.max(0, Math.min(100, (row.available / credited) * 100)) : 0

        return (
          <Comp key={row.leave_type.id} onClick={clickable ? () => onOpen(row) : undefined}
            className={cn('group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm',
              clickable && 'transition-all hover:-translate-y-0.5 hover:shadow-md')}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-xs font-semibold text-slate-600">{row.leave_type.name}</p>
              {clickable && <ChevronRight size={14} className="shrink-0 text-slate-300 group-hover:text-slate-500" />}
            </div>

            {row.unlimited ? (
              <>
                <p className="mt-2 flex items-center gap-1.5 text-2xl font-bold text-slate-900"><InfinityIcon size={22} className="text-slate-400" /></p>
                <p className="text-xs text-slate-400">{row.leave_type.paid ? 'No balance needed' : 'Unpaid · no balance needed'}</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                  {num(row.available)}
                  <span className="ml-1 text-sm font-medium text-slate-400">/ {num(credited)}</span>
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <p className="mt-1.5 truncate text-[11px] text-slate-500">
                  {num(row.used)} used{row.pending > 0 && <span className="text-amber-600"> · {num(row.pending)} pending</span>}
                  {row.pending <= 0 && <span className="text-slate-400"> · {ACCRUAL_LABELS[row.leave_type.accrual]?.toLowerCase()}</span>}
                </p>
              </>
            )}
          </Comp>
        )
      })}
    </div>
  )
}
