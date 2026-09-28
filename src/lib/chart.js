/**
 * Categorical series colours, in fixed order (never cycled past the end: fold
 * extra categories into "Other"). Validated for colour-blind separation on a
 * light surface; slots 3–5 are under 3:1 contrast, so always pair them with
 * visible labels or values.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

/** Chart chrome: gridlines and axis ticks stay recessive. */
export const GRID = '#eef1f5'
export const TICK = { fontSize: 11, fill: '#94a3b8' }

/** Keeps the first n-1 items and folds the rest into "Other". */
export function foldOther(items, n = SERIES.length, key = 'value') {
  if (items.length <= n) return items
  const rest = items.slice(n - 1).reduce((s, i) => s + (Number(i[key]) || 0), 0)
  return [...items.slice(0, n - 1), { name: 'Other', label: 'Other', [key]: rest }]
}
