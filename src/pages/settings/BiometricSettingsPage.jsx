import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Fingerprint, Settings2, RefreshCw, X, CheckCircle2, AlertCircle,
  History, Link2, Clock, ShieldAlert, IdCard,
} from 'lucide-react'
import { biometricApi } from '@/lib/api/biometric'
import { employeeApi } from '@/lib/api/employees'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const DEFAULT_API_URL = 'https://bio.kochi.digital/api/fetch-punches'
const today = () => new Date().toISOString().slice(0, 10)

function StatusPill({ status }) {
  const map = {
    enabled: { label: 'Enabled', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
    disabled: { label: 'Disabled', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
    unconfigured: { label: 'Not configured', cls: 'bg-slate-50 text-slate-500 ring-slate-500/20', dot: 'bg-slate-400' },
  }
  const m = map[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset', m.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  )
}

export default function BiometricSettingsPage() {
  const qc = useQueryClient()
  const { isSuperAdmin } = useRole()
  const [configModal, setConfigModal] = useState(null) // branch
  const [syncModal, setSyncModal] = useState(null) // branch
  const [mapModal, setMapModal] = useState(null) // branch

  const { data: branches, isLoading, isError } = useQuery({
    queryKey: ['biometric-branches'],
    queryFn: () => biometricApi.listBranches().then((r) => r.data?.data ?? []),
  })

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-lg shadow-blue-600/20">
          <Fingerprint size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Biometric Attendance Integration</h1>
          <p className="text-[13px] text-slate-500">
            Connect each branch's biometric device provider to automatically pull attendance punches.
          </p>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          Failed to load branches. You may not have permission to manage biometric settings.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {(branches ?? []).map((branch) => {
            const cfg = branch.biometric_config
            const status = !cfg ? 'unconfigured' : cfg.enabled ? 'enabled' : 'disabled'

            return (
              <div key={branch.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Fingerprint size={16} />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-900">{branch.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[12px] text-slate-400">
                        {cfg ? <span>Institution code: <span className="font-mono font-semibold text-slate-600">{cfg.ins_code}</span></span> : <span>No integration set up yet</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusPill status={status} />
                    {cfg?.last_synced_at && (
                      <span className="hidden items-center gap-1 text-[11px] text-slate-400 sm:flex">
                        <Clock size={11} /> Last synced {new Date(cfg.last_synced_at).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setConfigModal(branch)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                      <Settings2 size={13} /> Configure
                    </button>
                    <button onClick={() => setMapModal(branch)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                      <IdCard size={13} /> Map Codes
                    </button>
                    <button onClick={() => setSyncModal(branch)} disabled={status !== 'enabled'}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
                      <RefreshCw size={13} /> Sync Now
                    </button>
                  </div>
                </div>

                {cfg?.last_sync_status === 'failed' && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[12.5px] text-rose-600">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    Last sync failed: {cfg.last_sync_message}
                  </div>
                )}
              </div>
            )
          })}

          {(branches ?? []).length === 0 && (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-16 text-center">
              <Fingerprint size={26} className="mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">No branches available.</p>
            </div>
          )}
        </div>
      )}

      {configModal && (
        <ConfigModal
          branch={configModal}
          onClose={() => setConfigModal(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['biometric-branches'] }); setConfigModal(null) }}
        />
      )}

      {syncModal && (
        <SyncModal
          branch={syncModal}
          onClose={() => { setSyncModal(null); qc.invalidateQueries({ queryKey: ['biometric-branches'] }) }}
        />
      )}

      {mapModal && (
        <MapCodesModal branch={mapModal} onClose={() => setMapModal(null)} />
      )}
    </div>
  )
}

function ConfigModal({ branch, onClose, onSaved }) {
  const cfg = branch.biometric_config
  const [form, setForm] = useState({
    api_url: cfg?.api_url ?? DEFAULT_API_URL,
    ins_code: cfg?.ins_code ?? '',
    api_token: '',
    enabled: cfg?.enabled ?? false,
  })

  const mutation = useMutation({
    mutationFn: (data) => biometricApi.saveConfig(branch.id, data),
    onSuccess: onSaved,
  })

  function submit(e) {
    e.preventDefault()
    mutation.mutate(form)
  }

  const field = 'w-full rounded-xl border-0 bg-slate-100/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-slate-900">Configure — {branch.name}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          {mutation.isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">
              {mutation.error?.response?.data?.message ?? 'Something went wrong.'}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">API Endpoint URL <span className="text-rose-500">*</span></label>
            <input required type="url" className={field} value={form.api_url}
              onChange={(e) => setForm({ ...form, api_url: e.target.value })} />
            <p className="mt-1 text-[11px] text-slate-400">Provided by your biometric device vendor's activation letter.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Institution Code (ins_code) <span className="text-rose-500">*</span></label>
            <input required className={cn(field, 'font-mono')} value={form.ins_code}
              onChange={(e) => setForm({ ...form, ins_code: e.target.value })} placeholder="e.g. GITK" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Bearer Token {!cfg && <span className="text-rose-500">*</span>}
            </label>
            <input required={!cfg} type="password" className={field} value={form.api_token}
              onChange={(e) => setForm({ ...form, api_token: e.target.value })}
              placeholder={cfg ? '•••••••• (leave blank to keep current)' : 'Paste the Bearer token from the activation letter'} />
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5">
            <div>
              <p className="text-[13.5px] font-semibold text-slate-800">Enable this integration</p>
              <p className="text-[12px] text-slate-400">Turns on manual "Sync Now" and hourly auto-sync for this branch.</p>
            </div>
            <button type="button" onClick={() => setForm({ ...form, enabled: !form.enabled })}
              className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', form.enabled ? 'bg-blue-600' : 'bg-slate-200')}>
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', form.enabled ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60">
              {mutation.isPending ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SyncModal({ branch, onClose }) {
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [result, setResult] = useState(null)

  const { data: logs } = useQuery({
    queryKey: ['biometric-logs', branch.id],
    queryFn: () => biometricApi.logs(branch.id).then((r) => r.data?.data ?? []),
  })

  const mutation = useMutation({
    mutationFn: () => biometricApi.sync(branch.id, { date_from: dateFrom, date_to: dateTo }),
    onSuccess: (res) => setResult(res.data),
    onError: (err) => setResult({ error: err.response?.data?.message ?? 'Sync failed.' }),
  })

  const log = result?.data
  const field = 'w-full rounded-xl border-0 bg-slate-100/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-slate-900">Sync Attendance — {branch.name}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input type="date" max={today()} className={field} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input type="date" max={today()} className={field} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60">
            <RefreshCw size={14} className={cn(mutation.isPending && 'animate-spin')} />
            {mutation.isPending ? 'Fetching punches…' : 'Run Sync'}
          </button>

          {result?.error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-600">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {result.error}
            </div>
          )}

          {log && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={15} />
                <p className="text-[13px] font-bold">Sync complete</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white px-2 py-2">
                  <p className="text-lg font-extrabold text-slate-800">{log.total_fetched}</p>
                  <p className="text-[10px] text-slate-400">Punches fetched</p>
                </div>
                <div className="rounded-lg bg-white px-2 py-2">
                  <p className="text-lg font-extrabold text-emerald-600">{log.matched_count}</p>
                  <p className="text-[10px] text-slate-400">Days matched</p>
                </div>
                <div className="rounded-lg bg-white px-2 py-2">
                  <p className="text-lg font-extrabold text-amber-600">{log.unmatched_count}</p>
                  <p className="text-[10px] text-slate-400">Unmatched codes</p>
                </div>
              </div>

              {log.unmatched_codes?.length > 0 && (
                <UnmatchedCodes branch={branch} codes={log.unmatched_codes} />
              )}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center gap-2">
              <History size={14} className="text-slate-400" />
              <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Recent Syncs</p>
            </div>
            {(!logs || logs.length === 0) ? (
              <p className="py-3 text-center text-[12.5px] text-slate-400">No sync history yet.</p>
            ) : (
              <div className="space-y-1.5">
                {logs.slice(0, 8).map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[12px]">
                    <span className="text-slate-600">{l.date_from === l.date_to ? l.date_from : `${l.date_from} → ${l.date_to}`}</span>
                    <span className="text-slate-400">{l.matched_count} matched, {l.unmatched_count} unmatched</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                      l.status === 'success' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-rose-50 text-rose-600 ring-rose-600/20'
                    )}>{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Lets an admin link employees to their biometric device ID directly —
 * doesn't require a sync to have run first, so mapping can happen even while
 * the vendor's API is unavailable.
 */
function MapCodesModal({ branch, onClose }) {
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState({}) // employeeId -> in-progress input value
  const [savedFlash, setSavedFlash] = useState({}) // employeeId -> true briefly after save
  const [search, setSearch] = useState('')

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', 'for-biometric-map-all', branch.id],
    queryFn: () => employeeApi.list({ branch_id: branch.id, status: 'active', per_page: 200 }).then((r) => r.data?.data ?? []),
  })

  const mutation = useMutation({
    mutationFn: ({ employeeId, code }) => employeeApi.update(employeeId, { biometric_emp_code: code || null }),
    onSuccess: (_res, { employeeId }) => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      setSavedFlash((prev) => ({ ...prev, [employeeId]: true }))
      setTimeout(() => setSavedFlash((prev) => ({ ...prev, [employeeId]: false })), 1500)
    },
  })

  function valueFor(emp) {
    return drafts[emp.id] !== undefined ? drafts[emp.id] : (emp.biometric_emp_code ?? '')
  }

  const filtered = (employees ?? []).filter((emp) => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(q) || emp.employee_code.toLowerCase().includes(q)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Map Employee Codes — {branch.name}</h2>
            <p className="text-[12px] text-slate-400">Link each employee to their ID on the biometric device — works even while the vendor API is down.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="border-b px-5 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or employee code…"
            className="w-full rounded-xl border-0 bg-slate-100/80 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/60"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner className="h-7 w-7" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">No matching employees.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((emp) => {
                const val = valueFor(emp)
                const dirty = val !== (emp.biometric_emp_code ?? '')
                return (
                  <div key={emp.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-800">{emp.first_name} {emp.last_name}</p>
                      <p className="text-[11px] text-slate-400">{emp.employee_code}</p>
                    </div>
                    <input
                      className="w-28 rounded-lg border-0 bg-white px-2.5 py-1.5 text-[12px] font-mono text-slate-700 shadow-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500/60"
                      placeholder="Device code"
                      value={val}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => mutation.mutate({ employeeId: emp.id, code: val.trim() })}
                      disabled={!dirty || mutation.isPending}
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                        savedFlash[emp.id] ? 'bg-emerald-100 text-emerald-700' :
                        dirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'cursor-not-allowed bg-slate-100 text-slate-300'
                      )}
                    >
                      {savedFlash[emp.id] ? <><CheckCircle2 size={12} /> Saved</> : 'Save'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {mutation.isError && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] text-rose-600">
              {mutation.error?.response?.data?.errors?.biometric_emp_code?.[0]
                ?? mutation.error?.response?.data?.message
                ?? 'Could not save that code.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UnmatchedCodes({ branch, codes }) {
  const qc = useQueryClient()
  const [assigned, setAssigned] = useState({})

  const { data: employees } = useQuery({
    queryKey: ['employees', 'for-biometric-map', branch.id],
    queryFn: () => employeeApi.list({ branch_id: branch.id, status: 'active', per_page: 200 }).then((r) => r.data?.data ?? []),
  })

  const mutation = useMutation({
    mutationFn: ({ employeeId, code }) => employeeApi.update(employeeId, { biometric_emp_code: code }),
    onSuccess: (_res, { code }) => {
      setAssigned((prev) => ({ ...prev, [code]: true }))
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })

  return (
    <div className="mt-3 border-t border-emerald-200/60 pt-3">
      <div className="mb-2 flex items-center gap-1.5">
        <ShieldAlert size={13} className="text-amber-500" />
        <p className="text-[12px] font-semibold text-slate-700">Map these device codes to employees</p>
      </div>
      <div className="space-y-2">
        {codes.map((code) => (
          <div key={code} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">{code}</span>
            {assigned[code] ? (
              <span className="flex items-center gap-1 text-[12px] font-medium text-emerald-600"><CheckCircle2 size={12} /> Mapped</span>
            ) : (
              <>
                <Link2 size={12} className="text-slate-300" />
                <select
                  className="flex-1 rounded-lg border-0 bg-slate-100 px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/60"
                  defaultValue=""
                  onChange={(e) => e.target.value && mutation.mutate({ employeeId: e.target.value, code })}
                >
                  <option value="" disabled>Assign to employee…</option>
                  {(employees ?? []).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>
                  ))}
                </select>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
