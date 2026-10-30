import { useState, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronsLeft, ChevronsRight, ChevronDown, LifeBuoy } from 'lucide-react'
import { approvalApi } from '@/lib/api/leaves'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/useRole'
import { useAuthStore } from '@/store/authStore'
import { SECTIONS, PLATFORM_SECTION, isAllowed } from '@/lib/navigation'
import { Avatar } from '@/components/ui/kit'
import logoFull from '@/assets/brand/logo-full.png'
import icon from '@/assets/brand/icon.png'
import { TrialCard } from './TrialCountdown'

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
    ? <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
    : <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-px text-[11px] font-bold text-white">{count > 99 ? '99+' : count}</span>
}

const itemBase = 'group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[14px] font-medium transition-colors'
const itemIdle = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
const itemActive = 'bg-blue-50 text-blue-700 before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-blue-600'

/** Collapsed sidebar: a group's pages open in a panel beside the icon. */
function Flyout({ anchor, item, children, onNavigate, onEnter, onLeave }) {
  if (!anchor) return null
  const top = Math.min(anchor.top, window.innerHeight - 48 - children.length * 34)
  return (
    <div onMouseEnter={onEnter} onMouseLeave={onLeave} style={{ top, left: anchor.right + 6 }}
      className="fixed z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
      {children.map((child) => (
        <NavLink key={child.to + child.label} to={child.to} end onClick={onNavigate}
          className={({ isActive }) => cn('flex h-8 items-center rounded-md px-2.5 text-[14px] transition-colors',
            isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>
          {child.label}
        </NavLink>
      ))}
    </div>
  )
}

function NavGroup({ item, open, allowed, onNavigate }) {
  const location = useLocation()
  const isActive = matchesPrefix(location.pathname, item.prefix)
  const [expanded, setExpanded] = useState(isActive)
  const [anchor, setAnchor] = useState(null)
  const hideTimer = useRef(null)
  const Icon = item.icon
  const children = item.children.filter(allowed)
  if (children.length === 0) return null

  const show = (e) => { clearTimeout(hideTimer.current); if (!open) setAnchor(e.currentTarget.getBoundingClientRect()) }
  const keep = () => clearTimeout(hideTimer.current)
  const hide = () => { hideTimer.current = setTimeout(() => setAnchor(null), 120) }

  return (
    <div>
      <button
        onClick={(e) => (open ? setExpanded((x) => !x) : show(e))}
        onMouseEnter={show} onMouseLeave={hide}
        aria-expanded={open ? expanded : !!anchor}
        className={cn(itemBase, 'w-full', isActive ? 'text-slate-900' : itemIdle, !open && 'justify-center px-0', !open && isActive && 'bg-blue-50')}>
        <Icon size={18} className={cn('shrink-0', isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')} />
        {open && (
          <>
            <span className="flex-1 truncate text-left">{item.label}</span>
            <ChevronDown size={15} className={cn('text-slate-400 transition-transform duration-200', !expanded && '-rotate-90')} />
          </>
        )}
      </button>
      {open && (
        <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
          <div className="overflow-hidden">
            <div className="ml-[21px] mt-0.5 space-y-px border-l border-slate-200 py-0.5 pl-3">
              {children.map((child) => (
                <NavLink key={child.to + child.label} to={child.to} end onClick={onNavigate}
                  className={({ isActive: a }) => cn(
                    'relative flex h-8 items-center rounded-md px-2.5 text-[14px] transition-colors',
                    a ? 'bg-blue-50 font-medium text-blue-700 before:absolute before:-left-[13px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-blue-600'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  )}>
                  {child.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
      {!open && <Flyout anchor={anchor} item={item} children={children} onNavigate={() => setAnchor(null)} onEnter={keep} onLeave={hide} />}
    </div>
  )
}

/** Collapsed sidebar: a single page's name in a tooltip beside the icon. */
function Tip({ label, show }) {
  if (!show) return null
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[12px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
      {label}
    </span>
  )
}

export default function Sidebar({ open, onToggle }) {
  const { can, hasFeature, isPlatformAdmin, inSupportMode } = useRole()
  const company = useAuthStore((s) => s.company)
  const user = useAuthStore((s) => s.user)
  const subscription = useAuthStore((s) => s.subscription)
  const allowed = (item) => isAllowed(item, { can, hasFeature })

  const closeOnMobile = () => { if (window.innerWidth < 1024 && open) onToggle() }

  // The platform operator outside support mode only has the platform console.
  const sections = isPlatformAdmin && !inSupportMode ? [PLATFORM_SECTION] : [...(isPlatformAdmin ? [PLATFORM_SECTION] : []), ...SECTIONS]
  const roleLabel = user?.is_platform_admin ? 'Platform admin' : user?.is_tenant_admin ? 'Organisation admin' : user?.roles?.[0]?.replace(/_/g, ' ')

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden" onClick={onToggle} />}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-out',
        open ? 'w-[256px]' : 'w-0 overflow-hidden lg:w-[72px] lg:overflow-visible',
        'lg:relative lg:flex'
      )}>
        <div className={cn('flex h-16 shrink-0 items-center border-b border-slate-100', open ? 'justify-between pl-4 pr-3' : 'justify-center')}>
          {open
            ? <img src={logoFull} alt="PeopleNex" className="h-11 w-auto" />
            : <button onClick={onToggle} aria-label="Expand sidebar"><img src={icon} alt="PeopleNex" className="h-9 w-9 object-contain" /></button>}
          {open && (
            <button onClick={onToggle} aria-label="Collapse sidebar"
              className="hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:flex">
              <ChevronsLeft size={16} />
            </button>
          )}
        </div>

        {open && company && (
          <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
            {company.logo_url
              ? <img src={company.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
              : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-[12px] font-bold text-white">{company.name.slice(0, 2).toUpperCase()}</div>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-slate-900">{company.name}</p>
              <p className="truncate text-[12px] capitalize text-slate-500">
                {company.industry?.replace(/_/g, ' ')}{subscription?.plan_name ? ` · ${subscription.plan_name}` : ''}
              </p>
            </div>
          </div>
        )}

        {open && <TrialCard />}

        <nav className={cn('sidebar-scroll flex-1 overflow-y-auto py-3', open ? 'px-3' : 'px-2.5 lg:overflow-visible')}>
          {sections.map((section, i) => {
            const items = section.items.filter(allowed)
            if (items.length === 0) return null
            return (
              <div key={section.label ?? i} className={cn(i > 0 && 'mt-5')}>
                {section.label && open && (
                  <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{section.label}</p>
                )}
                {section.label && !open && i > 0 && <div className="mx-auto mb-3 h-px w-7 bg-slate-200" />}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    if (item.group) return <NavGroup key={item.label} item={item} open={open} allowed={allowed} onNavigate={closeOnMobile} />
                    const Icon = item.icon
                    return (
                      <NavLink key={item.to + item.label} to={item.to} end={item.exact !== false} onClick={closeOnMobile}
                        aria-label={!open ? item.label : undefined}
                        className={({ isActive }) => cn(itemBase, isActive ? itemActive : itemIdle, !open && 'justify-center px-0 before:hidden')}>
                        {({ isActive }) => (
                          <>
                            <Icon size={18} className={cn('shrink-0', isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')} />
                            {open && <span className="truncate">{item.label}</span>}
                            {item.badge && <NavBadge kind={item.badge} compact={!open} />}
                            <Tip label={item.label} show={!open} />
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

        <div className={cn('shrink-0 border-t border-slate-100', open ? 'p-3' : 'flex flex-col items-center gap-2 py-3')}>
          {open ? (
            <>
              <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
                <Avatar name={user?.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{user?.name}</p>
                  <p className="truncate text-[12px] capitalize text-slate-500">{roleLabel ?? user?.email}</p>
                </div>
                <a href="mailto:support@peoplenex.online" title="Help & support"
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                  <LifeBuoy size={17} />
                </a>
              </div>
              <p className="mt-1 px-1.5 text-[11px] text-slate-400">PeopleNex HRMS · by Sysnac</p>
            </>
          ) : (
            <>
              <Avatar name={user?.name} size="sm" />
              <button onClick={onToggle} aria-label="Expand sidebar" className="hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:flex">
                <ChevronsRight size={16} />
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
