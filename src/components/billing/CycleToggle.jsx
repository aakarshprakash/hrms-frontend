import { cn } from '@/lib/utils'

/** Monthly / 6 months / Yearly, with each cycle's saving. */
export default function CycleToggle({ cycles, value, onChange, dark = false, className }) {
  return (
    <div className={cn('inline-flex max-w-full overflow-x-auto rounded-xl p-1 text-[14px] font-medium', dark ? 'bg-white/10' : 'bg-slate-100', className)}>
      {cycles.map((c) => {
        const active = value === c.key
        return (
          <button key={c.key} type="button" onClick={() => onChange(c.key)}
            className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 transition-all',
              active ? 'bg-white text-slate-900 shadow-sm' : dark ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-700')}>
            {c.label}
            {c.discount_percent > 0 && <span className="text-[12px] font-semibold text-emerald-600">Save {c.discount_percent}%</span>}
          </button>
        )
      })}
    </div>
  )
}
