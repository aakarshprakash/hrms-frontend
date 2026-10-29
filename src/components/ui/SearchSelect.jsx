import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * The app's dropdown: a drop-in for <select> with a searchable list
 * (Select2-style). It takes the same <option>/<optgroup> children and
 * props, and keeps a real <select> underneath so forms, `required`,
 * react-hook-form's register() and e.target.value all behave as before.
 */

const SEARCH_FROM = 7 // options before a search box appears
const VALUE = typeof window !== 'undefined' ? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value') : null

function textOf(node) {
  return Children.toArray(node).map((n) => (typeof n === 'string' || typeof n === 'number' ? String(n)
    : isValidElement(n) ? textOf(n.props.children) : '')).join('')
}

function readOptions(children, group = null, out = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === 'option') {
      const label = textOf(child.props.children)
      out.push({ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled, group })
    } else if (child.type === 'optgroup') {
      readOptions(child.props.children, child.props.label, out)
    } else if (child.props?.children) {
      readOptions(child.props.children, group, out) // fragments
    }
  })
  return out
}

// Layout classes (width, margin, grid/flex placement) belong on the wrapper; the rest style the box.
const LAYOUT = /^(?:[a-z0-9]+:)*(?:w-|min-w-|max-w-|flex-|basis-|shrink|grow|col-|row-|self-|order-|-?m[trblxy]?-|hidden$|block$|inline|absolute$|relative$)/
function splitClasses(className = '') {
  const outer = []
  const inner = []
  for (const c of String(className).split(/s+/).filter(Boolean)) (LAYOUT.test(c) ? outer : inner).push(c)
  return [outer.join(' '), inner.join(' ')]
}

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function SearchSelect({
  className, children, value, defaultValue, onChange, onBlur, name, required, disabled, ref, id,
  searchable, placeholder, 'aria-label': ariaLabel, ...rest
}) {
  const options = useMemo(() => readOptions(children), [children])
  const controlled = value !== undefined
  const selectRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const listId = useId()

  // Uncontrolled: the hidden <select> holds the value (register(), defaultValue, reset()).
  const [domValue, setDomValue] = useState(() => (defaultValue !== undefined ? String(defaultValue) : options[0]?.value ?? ''))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState(null)

  const current = controlled ? String(value ?? '') : domValue
  const selected = options.find((o) => o.value === current) ?? (controlled ? null : options[0]) ?? null
  const showSearch = searchable ?? options.length >= SEARCH_FROM

  const filtered = useMemo(() => {
    const q = fold(query.trim())
    return q ? options.filter((o) => fold(o.label).includes(q) || (o.group && fold(o.group).includes(q))) : options
  }, [options, query])

  // Watch programmatic writes (react-hook-form setValue/reset) to the hidden select.
  const setSelectRef = useCallback((el) => {
    selectRef.current = el
    if (el && VALUE && !el.__watched) {
      Object.defineProperty(el, 'value', {
        configurable: true,
        get() { return VALUE.get.call(this) },
        set(v) { VALUE.set.call(this, v); this.__onWrite?.(VALUE.get.call(this)) },
      })
      el.__watched = true
    }
    if (el) el.__onWrite = (v) => setDomValue(v)
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }, [ref])

  // Options that arrive late (a query resolving) can change what the native select holds.
  useLayoutEffect(() => {
    const el = selectRef.current
    if (!el) return
    if (controlled) VALUE?.set.call(el, String(value ?? ''))
    else {
      const v = VALUE ? VALUE.get.call(el) : el.value
      setDomValue((prev) => (prev === v ? prev : v))
    }
  }, [options, controlled, value])

  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    const up = below < 300 && r.top > below
    setPos({ left: r.left, width: Math.max(r.width, 180), top: up ? undefined : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : undefined, maxHeight: Math.max(160, Math.min(320, (up ? r.top : below) - 16)) })
  }, [])

  function openList(initialQuery = '') {
    if (disabled) return
    place()
    setQuery(initialQuery)
    const idx = options.findIndex((o) => o === selected)
    setActive(initialQuery ? 0 : Math.max(0, idx))
    setOpen(true)
  }

  const close = useCallback((refocus = true) => {
    setOpen(false)
    setQuery('')
    if (refocus) buttonRef.current?.focus()
    const el = selectRef.current
    onBlur?.({ target: el, currentTarget: el, type: 'blur' })
  }, [onBlur])

  function pick(opt) {
    if (!opt || opt.disabled) return
    const el = selectRef.current
    if (el && VALUE) VALUE.set.call(el, opt.value)
    if (!controlled) setDomValue(opt.value)
    if (opt.value !== current) {
      onChange?.({ target: el, currentTarget: el, type: 'change', preventDefault() {}, stopPropagation() {}, persist() {} })
    }
    close()
  }

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (buttonRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return
      close(false)
    }
    const onMove = (e) => { if (!listRef.current?.contains(e.target)) place() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, close, place])

  useEffect(() => {
    if (open) (showSearch ? searchRef.current : listRef.current)?.focus()
  }, [open, showSearch])

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function move(step) {
    if (!filtered.length) return
    let i = active
    for (let n = 0; n < filtered.length; n++) {
      i = (i + step + filtered.length) % filtered.length
      if (!filtered[i].disabled) break
    }
    setActive(i)
  }

  function onListKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(filtered[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close(false)
  }

  function onButtonKey(e) {
    if (open) return onListKey(e)
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList() }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (showSearch) { e.preventDefault(); openList(e.key) }
      else {
        const hit = options.find((o) => !o.disabled && fold(o.label).startsWith(fold(e.key)))
        if (hit) pick(hit)
      }
    }
  }

  const [outerClass, innerClass] = splitClasses(className)
  const label = selected?.label || placeholder || ''
  const isPlaceholder = !selected || selected.value === ''

  return (
    <div className={cn('relative w-full', outerClass)}>
      <select ref={setSelectRef} name={name} required={required} disabled={disabled} tabIndex={-1} aria-hidden="true"
        {...(controlled ? { value: String(value ?? ''), onChange: () => {} } : { defaultValue })}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0">
        {children}
      </select>
      <button ref={buttonRef} type="button" id={id} disabled={disabled} role="combobox" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} aria-label={ariaLabel} onClick={() => (open ? close() : openList())} onKeyDown={onButtonKey}
        className={cn('flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-[14px] text-slate-900 shadow-xs outline-none transition-all',
          'focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
          open && 'border-blue-500 ring-3 ring-blue-500/15', innerClass)}
        {...rest}>
        <span className={cn('min-w-0 flex-1 truncate', isPlaceholder && 'text-slate-500')}>{label}</span>
        <ChevronDown size={15} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && pos && createPortal(
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
          className="z-[1000] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5"
          onMouseDown={(e) => { if (e.target !== searchRef.current) e.preventDefault() }}>
          {showSearch && (
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input ref={searchRef} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0) }} onKeyDown={onListKey}
                  placeholder="Search…" aria-label="Search options" aria-controls={listId}
                  className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-[14px] text-slate-900 outline-none focus:border-blue-500 focus:bg-white" />
              </div>
            </div>
          )}
          <ul ref={listRef} id={listId} role="listbox" tabIndex={-1} onKeyDown={onListKey} style={{ maxHeight: pos.maxHeight - (showSearch ? 48 : 0) }}
            className="overflow-y-auto py-1 outline-none">
            {filtered.length === 0 && <li className="px-3 py-2 text-[14px] text-slate-400">No matches</li>}
            {filtered.map((o, i) => {
              const heading = o.group && o.group !== filtered[i - 1]?.group
              return [
                heading && <li key={`g-${o.group}-${i}`} role="presentation" className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{o.group}</li>,
                <li key={`${o.value}-${i}`} data-idx={i} role="option" aria-selected={o.value === current} aria-disabled={o.disabled}
                  onMouseEnter={() => setActive(i)} onClick={() => pick(o)}
                  className={cn('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[14px]', o.group && 'pl-5',
                    o.disabled ? 'cursor-not-allowed text-slate-300' : i === active ? 'bg-blue-50 text-blue-700' : 'text-slate-700',
                    o.value === '' && 'text-slate-500')}>
                  <span className="min-w-0 flex-1 truncate">{o.label || ' '}</span>
                  {o.value === current && <Check size={14} className="shrink-0 text-blue-600" />}
                </li>,
              ]
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  )
}
