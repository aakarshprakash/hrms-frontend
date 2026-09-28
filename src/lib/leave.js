/** Leave display helpers shared by the leave screens. */

export const SESSION_LABELS = { first_half: 'First half', second_half: 'Second half' }

export const ACCRUAL_LABELS = {
  annual: 'Credited yearly',
  monthly: 'Credited monthly',
  none: 'Not auto-credited',
}

/** "12 Sep", "12 – 14 Sep 2026", "½ day · 12 Sep (first half)". */
export function leaveRange(leave, { year = false } = {}) {
  if (!leave?.start_date) return '—'
  const opts = year ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }
  const from = new Date(leave.start_date + 'T00:00:00')
  const to = new Date((leave.end_date ?? leave.start_date) + 'T00:00:00')
  const a = from.toLocaleDateString('en-IN', opts)
  if (leave.start_date === leave.end_date || !leave.end_date) {
    return leave.half_day_session ? `${a} (${SESSION_LABELS[leave.half_day_session].toLowerCase()})` : a
  }
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  const b = to.toLocaleDateString('en-IN', opts)
  return sameMonth ? `${from.getDate()} – ${b}` : `${a} – ${b}`
}

/** 0.5 → "½ day", 1 → "1 day", 2.5 → "2½ days". */
export function dayCount(value) {
  const n = Number(value ?? 0)
  const whole = Math.floor(n)
  const half = Math.abs(n - whole - 0.5) < 0.001
  const text = half ? `${whole ? whole : ''}½` : String(Number(n.toFixed(2)))
  return `${text} ${n === 1 ? 'day' : 'days'}`
}

/** Short signed number for balances: 7.5, -1, 0. */
export function num(value) {
  const n = Number(value ?? 0)
  return String(Number(n.toFixed(2)))
}

export const FALLBACK_COLORS = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706', '#0891b2', '#db2777', '#64748b']

export function typeColor(type) {
  if (type?.color) return type.color
  const key = String(type?.code ?? type?.name ?? '')
  let h = 0
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length]
}

/** "Reporting manager" → "reporting manager", but "HR" stays "HR". */
export function lowerLabel(label) {
  if (!label) return ''
  return /^[A-Z0-9 ]+$/.test(label) ? label : label.toLowerCase()
}
