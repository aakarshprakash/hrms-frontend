import { useEffect, useRef, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { employeeApi } from '@/lib/api/employees'
import { cn } from '@/lib/utils'
import { fieldClass } from '@/components/ui/kit'

/**
 * Type-ahead employee search. `value` is the selected employee ({id, name,
 * code}) or null; `onChange` gets the same shape.
 */
export default function EmployeePicker({ value, onChange, placeholder = 'All employees', className, params }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const box = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ['employee-picker', debounced, params],
    queryFn: () => employeeApi.list({ search: debounced || undefined, per_page: 20, ...params }).then((r) => r.data.data ?? []),
    enabled: open,
    placeholderData: keepPreviousData,
  })

  if (value) {
    return (
      <div className={cn(fieldClass, 'flex h-9 items-center gap-2 pr-1.5', className)}>
        <span className="min-w-0 flex-1 truncate">{value.name}{value.code && <span className="ml-1.5 text-xs text-slate-400">{value.code}</span>}</span>
        <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear employee"><X size={14} /></button>
      </div>
    )
  }

  return (
    <div ref={box} className={cn('relative', className)}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input className={cn(fieldClass, 'h-9 pl-8')} value={term} placeholder={placeholder}
        onFocus={() => setOpen(true)} onChange={(e) => { setTerm(e.target.value); setOpen(true) }} />
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {(data ?? []).length === 0 && <p className="px-3 py-2 text-xs text-slate-400">{isFetching ? 'Searching…' : 'No employees found'}</p>}
          {(data ?? []).map((e) => {
            const name = e.full_name ?? `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim()
            return (
              <button key={e.id} type="button"
                onClick={() => { onChange({ id: e.id, name, code: e.employee_code }); setTerm(''); setOpen(false) }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-slate-50">
                <span className="truncate text-slate-800">{name}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{e.employee_code}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
