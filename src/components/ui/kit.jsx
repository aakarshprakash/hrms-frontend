import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Inbox, AlertCircle, ChevronLeft, ChevronRight, Lock, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'

/*
 * Shared building blocks so every screen reads as one product:
 * page headers, cards, buttons, form fields, modals, status pills, empty
 * states, pagination. Keep new screens on these rather than ad-hoc classes.
 */

export function PageHeader({ title, subtitle, icon: Icon, actions, children, breadcrumbs }) {
  return (
    <div className="mb-6">
      {breadcrumbs?.length > 0 && (
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} className="text-slate-300" />}
              {b.to ? <Link to={b.to} className="hover:text-slate-800">{b.label}</Link> : <span className="text-slate-700">{b.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600 shadow-xs sm:flex">
              <Icon size={19} strokeWidth={2} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold leading-7 tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
            {children}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function Card({ className, children, padded = true, ...props }) {
  return (
    <div className={cn('rounded-xl border border-slate-200/80 bg-white shadow-xs', padded && 'p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, icon: Icon, actions, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-200/70">
            <Icon size={16} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  )
}

const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white shadow-xs hover:bg-blue-700 focus-visible:ring-blue-500/40',
  secondary: 'border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-slate-400/30',
  soft: 'bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:ring-blue-500/30',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400/30',
  danger: 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 focus-visible:ring-rose-500/40',
  success: 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 focus-visible:ring-emerald-500/40',
}
const BUTTON_SIZES = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-[13px] gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
}

export function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, className, children, disabled, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className
      )}
      {...props}
    >
      {loading ? <Spinner className={cn('h-4 w-4', ['secondary', 'ghost', 'soft'].includes(variant) ? '' : 'border-white/40 border-t-white')} /> : Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, tone = 'default', className, ...props }) {
  const tones = {
    default: 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
    primary: 'text-slate-400 hover:bg-blue-50 hover:text-blue-600',
    danger: 'text-slate-400 hover:bg-rose-50 hover:text-rose-600',
  }
  return (
    <button type="button" title={label} aria-label={label}
      className={cn('rounded-md p-1.5 transition-colors disabled:opacity-40', tones[tone], className)} {...props}>
      <Icon size={15} />
    </button>
  )
}

export function Modal({ open = true, title, subtitle, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-2xl ring-1 ring-slate-900/5 sm:rounded-xl', widths[size])}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 shadow-xs placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 disabled:bg-slate-50 disabled:text-slate-500'

export function Field({ label, required, hint, error, className, children }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
          {label}{required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function Input({ className, ...props }) {
  return <input className={cn(fieldClass, 'h-9', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return <select className={cn(fieldClass, 'h-9 pr-8', className)} {...props}>{children}</select>
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(fieldClass, 'min-h-[80px]', className)} {...props} />
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cn('flex items-start gap-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-blue-600' : 'bg-slate-300')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {(label || description) && (
        <span>
          {label && <span className="block text-[13px] font-medium text-slate-800">{label}</span>}
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
      )}
    </label>
  )
}

const PILL_TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

/** Status → tone for the statuses used across the app. */
const STATUS_TONES = {
  active: 'green', approved: 'green', present: 'green', completed: 'green', paid: 'green', published: 'green', success: 'green', locked: 'indigo',
  pending: 'amber', draft: 'slate', processing: 'blue', processed: 'blue', finalized: 'indigo', late: 'amber', half_day: 'amber', trialing: 'blue', past_due: 'amber',
  rejected: 'red', absent: 'red', suspended: 'red', terminated: 'red', failed: 'red', cancelled: 'slate', inactive: 'slate', expired: 'red',
  on_leave: 'purple', holiday: 'teal', weekly_off: 'slate',
}

export function StatusPill({ status, label, tone, className, dot = true }) {
  const t = PILL_TONES[tone ?? STATUS_TONES[status] ?? 'slate']
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', t, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {label ?? String(status ?? '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-8 ring-slate-50">
        <Icon size={20} />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorBanner({ error, message, className }) {
  if (!error && !message) return null
  const data = error?.response?.data
  const text = message ?? data?.message ?? 'Something went wrong. Please try again.'
  const details = data?.errors ? Object.values(data.errors).flat() : []
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700', className)}>
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div>
        <p>{text}</p>
        {details.length > 1 && (
          <ul className="mt-1 list-disc pl-4 text-xs">{details.map((d, i) => <li key={i}>{d}</li>)}</ul>
        )}
      </div>
    </div>
  )
}

const STAT_TONES = {
  blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
  red: 'bg-rose-50 text-rose-600', purple: 'bg-violet-50 text-violet-600', slate: 'bg-slate-100 text-slate-600', teal: 'bg-teal-50 text-teal-600',
}

/**
 * A KPI tile. `trend` = { value: '4%', up: true, good: true, label: 'vs last month' }
 * shows a delta: the arrow follows the change, the colour whether it's
 * good (green), bad (red) or neutral (good omitted). `positive` still works
 * as shorthand for an upward good change. `onClick` / `to` make it a link.
 */
export function StatCard({ label, value, icon: Icon, tone = 'blue', hint, trend, onClick, to, children }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {Icon && <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', STAT_TONES[tone])}><Icon size={17} /></div>}
      </div>
      <p className="mt-1 text-[26px] font-semibold leading-8 tracking-tight text-slate-900 tabular-nums">{value ?? '—'}</p>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {trend && (() => {
          const up = trend.up ?? trend.positive ?? true
          const good = trend.good ?? trend.positive
          return (
            <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
              good === true ? 'bg-emerald-50 text-emerald-700' : good === false ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600')}>
              {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{trend.value}
            </span>
          )
        })()}
        {(hint || trend?.label) && <span className="truncate text-slate-500">{hint ?? trend.label}</span>}
      </div>
      {children}
    </>
  )
  const cls = cn('block rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-xs', (onClick || to) && 'transition-shadow hover:shadow-md')
  if (to) return <Link to={to} className={cls}>{body}</Link>
  const Comp = onClick ? 'button' : 'div'
  return <Comp onClick={onClick} className={cls}>{body}</Comp>
}

/**
 * Section tabs (underline). `variant="pills"` for a compact segmented control.
 */
export function Tabs({ tabs, value, onChange, className, variant = 'underline' }) {
  if (variant === 'pills') {
    return (
      <div className={cn('flex w-fit max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5', className)}>
        {tabs.map((tab) => (
          <button key={tab.key} type="button" onClick={() => onChange(tab.key)}
            className={cn('whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-all',
              value === tab.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700')}>
            {tab.label}{tab.count !== undefined && <span className="ml-1.5 text-[11px] text-slate-400">{tab.count}</span>}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className={cn('flex max-w-full gap-6 overflow-x-auto border-b border-slate-200', className)}>
      {tabs.map((tab) => {
        const active = value === tab.key
        return (
          <button key={tab.key} type="button" onClick={() => onChange(tab.key)}
            className={cn('-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 text-[13px] font-medium transition-colors',
              active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800')}>
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-px text-[11px] font-semibold', active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Pagination({ meta, onPage }) {
  if (!meta || !meta.last_page || meta.last_page <= 1) return null
  return (
    <div className="flex items-center justify-between px-1 pt-4 text-[13px] text-slate-500">
      <span>Page {meta.current_page} of {meta.last_page} · {meta.total} total</span>
      <div className="flex gap-1.5">
        <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>Prev</Button>
        <Button variant="secondary" size="sm" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>
          Next <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  )
}

export function Table({ columns, rows, rowKey = 'id', empty, onRowClick, className }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {columns.map((c) => <th key={c.key} className={cn('whitespace-nowrap px-4 py-2.5', c.className, c.align === 'right' && 'text-right')}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr><td colSpan={columns.length}>{empty ?? <EmptyState title="Nothing here yet" />}</td></tr>
          )}
          {rows.map((row) => (
            <tr key={row[rowKey]} onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('transition-colors hover:bg-slate-50/80', onRowClick && 'cursor-pointer')}>
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3 align-middle text-slate-700', c.cellClassName, c.align === 'right' && 'text-right tabular-nums')}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Shown in place of a module the organisation's plan doesn't include. */
export function UpgradeNotice({ feature, title = 'Not included in your plan', description }) {
  return (
    <Card className="mx-auto max-w-lg text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-8 ring-amber-50/50"><Lock size={20} /></div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-[13px] text-slate-500">
        {description ?? `The ${feature} module isn't part of your current subscription. Upgrade your plan to unlock it.`}
      </p>
      <Link to="/settings/billing" className="mt-4 inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700">View plans</Link>
    </Card>
  )
}

const AVATAR_TONES = [
  'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700', 'bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700',
]

export function Avatar({ name, src, size = 'md', className }) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm', xl: 'h-16 w-16 text-lg' }
  const initials = (name ?? '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  if (src) return <img src={src} alt={name} className={cn('shrink-0 rounded-full object-cover', sizes[size], className)} />
  let h = 0
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold', AVATAR_TONES[h % AVATAR_TONES.length], sizes[size], className)}>
      {initials}
    </div>
  )
}

/** Recharts tooltip in the house style: `<Tooltip content={<ChartTooltip format={money} />} />`. */
export function ChartTooltip({ active, payload, label, format = (v) => v, labelFormat = (l) => l }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-800">{labelFormat(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-slate-900">{format(p.value)}</span>
        </p>
      ))}
    </div>
  )
}
