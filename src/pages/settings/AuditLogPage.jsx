import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Lock } from 'lucide-react'
import api from '@/lib/api/axios'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader, Card, Select, Input, StatusPill, EmptyState, Pagination } from '@/components/ui/kit'

const LOGS = [
  { key: '', label: 'All areas' },
  { key: 'employee', label: 'Employees' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'leave', label: 'Leave' },
  { key: 'attendance', label: 'Attendance (manual edits)' },
  { key: 'organisation', label: 'Organisation' },
  { key: 'settings', label: 'Settings' },
  { key: 'security', label: 'Users & roles' },
]

const EVENT_TONES = { created: 'green', updated: 'blue', deleted: 'red', role_changed: 'purple', permissions_changed: 'purple', status_changed: 'amber' }

function humanize(key) {
  return String(key).replace(/_id$/, '').replace(/_/g, ' ')
}

function formatValue(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.join(', ') || '—'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? new Date(s).toLocaleDateString() : s
}

export default function AuditLogPage() {
  const [log, setLog] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', log, from, to, page],
    queryFn: () => api.get('/audit-logs', { params: { log: log || undefined, from: from || undefined, to: to || undefined, page } }).then((r) => r.data),
    placeholderData: (p) => p,
  })

  return (
    <div>
      <PageHeader icon={History} title="Audit trail"
        subtitle="Every change to employee, payroll and access data — who, what and when. Sensitive values are never shown." />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="w-auto" value={log} onChange={(e) => { setLog(e.target.value); setPage(1) }}>
          {LOGS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
        </Select>
        <Input type="date" className="w-auto" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
        <Input type="date" className="w-auto" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
      </div>

      <Card padded={false}>
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
          (data?.data ?? []).length === 0
            ? <EmptyState icon={History} title="No changes recorded" description="Changes will appear here as people edit records." />
            : (
              <ul className="divide-y divide-slate-100">
                {data.data.map((entry) => {
                  const newVals = entry.changes?.new ?? {}
                  const oldVals = entry.changes?.old ?? {}
                  const keys = Object.keys(newVals)
                  return (
                    <li key={entry.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={EVENT_TONES[entry.event] ?? 'slate'} label={humanize(entry.event ?? entry.description)} />
                        <span className="text-sm font-medium capitalize text-slate-800">{humanize(entry.subject)} #{entry.subject_id}</span>
                        <span className="text-xs text-slate-400">by {entry.causer?.name ?? 'System'}</span>
                        <span className="ml-auto text-xs text-slate-400">{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      {(keys.length > 0 || entry.sensitive_changed?.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                          {keys.slice(0, 12).map((k) => (
                            <span key={k} className="text-slate-600">
                              <span className="font-medium capitalize text-slate-500">{humanize(k)}:</span>{' '}
                              {entry.event === 'updated' && <><span className="text-slate-400 line-through">{formatValue(oldVals[k])}</span> → </>}
                              <span className="text-slate-800">{formatValue(newVals[k])}</span>
                            </span>
                          ))}
                          {(entry.sensitive_changed ?? []).map((k) => (
                            <span key={k} className="inline-flex items-center gap-1 text-amber-700">
                              <Lock size={11} /> <span className="capitalize">{humanize(k)}</span> changed
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )
        )}
      </Card>
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  )
}
