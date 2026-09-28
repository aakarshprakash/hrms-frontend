import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, CornerDownLeft, ArrowRight, CalendarPlus, UserPlus, Clock, IndianRupee, User } from 'lucide-react'
import { employeeApi } from '@/lib/api/employees'
import { useRole } from '@/hooks/useRole'
import { SECTIONS, PLATFORM_SECTION, reachablePages } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/kit'

/** Ctrl/⌘ K: jump to any page, person or common action. */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate()
  const { can, hasFeature, isPlatformAdmin, inSupportMode, user } = useRole()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)

  const platformOnly = isPlatformAdmin && !inSupportMode
  const pages = useMemo(
    () => reachablePages(platformOnly ? [PLATFORM_SECTION] : SECTIONS, { can, hasFeature }),
    [platformOnly, can, hasFeature],
  )

  const actions = useMemo(() => platformOnly ? [] : [
    user?.employee_id && { label: 'Apply for leave', icon: CalendarPlus, to: '/leaves/apply' },
    can('employees.manage') && { label: 'Add an employee', icon: UserPlus, to: '/employees/new' },
    user?.employee_id && { label: 'Request attendance correction', icon: Clock, to: '/attendance/regularizations' },
    can('payroll.manage') && hasFeature('payroll') && { label: 'Run payroll', icon: IndianRupee, to: '/payroll/runs' },
  ].filter(Boolean), [platformOnly, can, hasFeature, user])

  const q = query.trim().toLowerCase()
  const { data: people = [] } = useQuery({
    queryKey: ['palette-people', q],
    queryFn: () => employeeApi.list({ search: q, per_page: 6, status: 'active' }).then((r) => r.data?.data ?? []),
    enabled: open && !platformOnly && q.length >= 2,
    staleTime: 30_000,
  })

  const results = useMemo(() => {
    const match = (text) => !q || text.toLowerCase().includes(q)
    return [
      ...actions.filter((a) => match(a.label)).map((a) => ({ ...a, kind: 'Actions' })),
      ...pages.filter((p) => match(p.label) || match(p.group)).slice(0, q ? 8 : 6).map((p) => ({ ...p, kind: 'Pages' })),
      ...people.map((e) => ({ kind: 'People', label: `${e.first_name} ${e.last_name}`, hint: [e.employee_code, e.designation?.title].filter(Boolean).join(' · '), to: `/employees/${e.id}`, person: true })),
    ]
  }, [actions, pages, people, q])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 10)
      return () => clearTimeout(t)
    }
    return undefined
  }, [open])

  if (!open) return null

  const go = (item) => {
    if (!item) return
    onClose()
    setQuery('')
    navigate(item.to)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); go(results[cursor]) }
    if (e.key === 'Escape') onClose()
  }

  let lastKind = null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="text-slate-400" />
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setCursor(0) }} onKeyDown={onKey}
            placeholder={platformOnly ? 'Search pages…' : 'Search people, pages and actions…'}
            className="h-12 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">ESC</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">No matches for “{query}”.</p>}
          {results.map((item, i) => {
            const header = item.kind !== lastKind ? item.kind : null
            lastKind = item.kind
            const Icon = item.icon ?? (item.person ? User : ArrowRight)
            return (
              <div key={`${item.kind}-${item.to}-${item.label}`}>
                {header && <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{header}</p>}
                <button onMouseEnter={() => setCursor(i)} onClick={() => go(item)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left', cursor === i ? 'bg-blue-50' : 'hover:bg-slate-50')}>
                  {item.person
                    ? <Avatar name={item.label} size="sm" />
                    : <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', cursor === i ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-500')}><Icon size={15} /></span>}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[13px] font-medium', cursor === i ? 'text-blue-700' : 'text-slate-800')}>{item.label}</span>
                    {(item.hint || (item.kind === 'Pages' && item.group)) && <span className="block truncate text-xs text-slate-500">{item.hint ?? item.group}</span>}
                  </span>
                  {cursor === i && <CornerDownLeft size={14} className="text-blue-500" />}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-500">
          <span><kbd className="font-sans">↑↓</kbd> to move</span><span><kbd className="font-sans">↵</kbd> to open</span>
        </div>
      </div>
    </div>
  )
}
