import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronsLeft, ChevronDown, LifeBuoy } from 'lucide-react'
import { approvalApi } from '@/lib/api/leaves'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/useRole'
import { useAuthStore } from '@/store/authStore'
import { SECTIONS, PLATFORM_SECTION, isAllowed } from '@/lib/navigation'
import logoFull from '@/assets/brand/logo-full.png'
import icon from '@/assets/brand/icon.png'

function matchesPrefix(pathname, prefix) {
  return (Array.isArray(prefix) ? prefix : [prefix]).some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/** Live count next to a nav item (approvals waiting for me). */
function NavBadge({ kind, compact }) {
  const { data } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: () => approvalApi.count().then((r) => r.data.data),
    enabled: kind === 'approvals',
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const count = data?.total ?? 0
  if (!count) return null
  return compact
    ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
    : <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</span>
}

function NavGroup({ item, open, onExpandSidebar, allowed, onNavigate }) {
  const location = useLocation()
  const isActive = matchesPrefix(location.pathname, item.prefix)
  const [expanded, setExpanded] = useState(isActive)
  const Icon = item.icon
  const children = item.children.filter(allowed)
  if (children.length === 0) return null

  return (
    <div>
      <button
        onClick={() => { if (!open) { onExpandSidebar(); setExpanded(true) } else setExpanded((e) => !e) }}
        title={!open ? item.label : undefined}
        className={cn('group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
          isActive ? 'text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900', !open && 'justify-center px-0')}>
        <Icon size={17} className={cn('shrink-0', isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')} />
        {open && (
          <>
            <span className="flex-1 truncate text-left">{item.label}</span>
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', !expanded && '-rotate-90')} />
          </>
        )}
      </button>
      {expanded && open && (
        <div className="relative ml-[19px] mt-0.5 space-y-px border-l border-slate-200 py-0.5 pl-3">
          {children.map((child) => (
            <NavLink key={child.to + child.label} to={child.to} end onClick={onNavigate}
              className={({ isActive: a }) => cn(
                'relative flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors',
                a ? 'bg-blue-50 font-medium text-blue-700 before:absolute before:-left-[13px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-blue-600'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
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
  const { can, hasFeature, isPlatformAdmin, inSupportMode } = useRole()
  const company = useAuthStore((s) => s.company)
  const subscription = useAuthStore((s) => s.subscription)
  const allowed = (item) => isAllowed(item, { can, hasFeature })

  const closeOnMobile = () => { if (window.innerWidth < 1024 && open) onToggle() }

  // The platform operator outside support mode only has the platform console.
  const sections = isPlatformAdmin && !inSupportMode ? [PLATFORM_SECTION] : [...(isPlatformAdmin ? [PLATFORM_SECTION] : []), ...SECTIONS]

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden" onClick={onToggle} />}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-out',
        open ? 'w-[248px]' : 'w-0 overflow-hidden lg:w-[68px] lg:overflow-visible',
        'lg:relative lg:flex'
      )}>
        <div className={cn('flex h-14 shrink-0 items-center border-b border-slate-100', open ? 'justify-between px-4' : 'justify-center')}>
          {open
            ? <img src={logoFull} alt="Peoplenex" className="h-8 w-auto" />
            : <button onClick={onToggle} aria-label="Expand sidebar"><img src={icon} alt="Peoplenex" className="h-8 w-8 object-contain" /></button>}
          {open && (
            <button onClick={onToggle} aria-label="Collapse sidebar"
              className="hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:flex">
              <ChevronsLeft size={16} />
            </button>
          )}
        </div>

        {open && company && (
          <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2">
            {company.logo_url
              ? <img src={company.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
              : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 text-[11px] font-bold text-white">{company.name.slice(0, 2).toUpperCase()}</div>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-900">{company.name}</p>
              <p className="truncate text-[11px] capitalize text-slate-500">
                {company.industry?.replace(/_/g, ' ')}{subscription?.plan_name ? ` · ${subscription.plan_name}` : ''}
              </p>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {sections.map((section, i) => {
            const items = section.items.filter(allowed)
            if (items.length === 0) return null
            return (
              <div key={section.label ?? i} className={cn(i > 0 && 'mt-4')}>
                {section.label && open && (
                  <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.label}</p>
                )}
                {section.label && !open && i > 0 && <div className="mx-auto mb-2 h-px w-6 bg-slate-200" />}
                <div className="space-y-px">
                  {items.map((item) => {
                    if (item.group) return <NavGroup key={item.label} item={item} open={open} onExpandSidebar={onToggle} allowed={allowed} onNavigate={closeOnMobile} />
                    const Icon = item.icon
                    return (
                      <NavLink key={item.to + item.label} to={item.to} end={item.exact !== false} onClick={closeOnMobile}
                        title={!open ? item.label : undefined}
                        className={({ isActive }) => cn(
                          'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
                          isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                          !open && 'justify-center px-0'
                        )}>
                        {({ isActive }) => (
                          <>
                            <Icon size={17} className={cn('shrink-0', isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')} />
                            {open && <span className="truncate">{item.label}</span>}
                            {item.badge && <NavBadge kind={item.badge} compact={!open} />}
                          </>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {open && (
          <div className="border-t border-slate-100 px-3 py-3">
            <a href="mailto:support@peoplenex.online" className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              <LifeBuoy size={17} className="text-slate-400" /> Help & support
            </a>
            <p className="mt-1 px-2.5 text-[11px] text-slate-400">Peoplenex HRMS · by Sysnac</p>
          </div>
        )}
      </aside>
    </>
  )
}
