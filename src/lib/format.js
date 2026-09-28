/** Display formatting shared across screens (Indian conventions by default). */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-IN')

/** ₹1,25,430 (or with paise). */
export function money(value, { paise = false } = {}) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return (paise ? inr2 : inr).format(n)
}

/** ₹1.2L / ₹3.4Cr for dashboards. */
export function moneyShort(value) {
  const n = Number(value ?? 0)
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`
  return inr.format(n)
}

export function number(value) {
  return value === null || value === undefined ? '—' : num.format(Number(value))
}

/** 27.5 → "27.5", 30.00 → "30". */
export function days(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(Number(Number(value).toFixed(2)))
}

export function monthLabel(month, year) {
  return `${MONTHS[(month ?? 1) - 1]} ${year}`
}

export function dateLabel(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', opts)
}

export function timeLabel(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function minutesLabel(mins) {
  if (mins === null || mins === undefined) return '—'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}
