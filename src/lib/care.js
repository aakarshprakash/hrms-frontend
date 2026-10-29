/** Helpdesk display helpers shared by the queue and the ticket thread. */

export const TICKET_STATUS = {
  open: ['blue', 'Open'], in_progress: ['indigo', 'In progress'], waiting: ['amber', 'Waiting on you'], resolved: ['green', 'Resolved'], closed: ['slate', 'Closed'],
}

export const PRIORITY = { urgent: ['red', 'Urgent'], high: ['amber', 'High'], normal: ['slate', 'Normal'], low: ['slate', 'Low'] }

/** "5m ago", "3h ago", "2d ago". */
export function ago(iso) {
  if (!iso) return '—'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}
