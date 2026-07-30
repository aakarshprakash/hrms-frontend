import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, Pencil, Trash2, X, Save, Loader2,
  MapPin, Globe, DollarSign, Clock, AlertCircle, CheckCircle2, CalendarClock,
} from 'lucide-react'
import { branchApi, companyApi } from '@/lib/api/departments'
import { cn } from '@/lib/utils'

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'Australia/Sydney', 'Pacific/Auckland',
]

const CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
]

const WEEKDAYS = [
  { value: 0, label: 'Su' },
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Tu' },
  { value: 3, label: 'We' },
  { value: 4, label: 'Th' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
]

const EMPTY = {
  name: '', address: '', city: '', country: '', timezone: 'Asia/Kolkata', currency_code: 'INR',
  payroll_days_in_month: 30, week_off_days: [0, 6],
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function BranchForm({ initial = EMPTY, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial)
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function toggleWorkingDay(day) {
    setForm((f) => {
      const weekOff = f.week_off_days ?? []
      return {
        ...f,
        week_off_days: weekOff.includes(day) ? weekOff.filter((d) => d !== day) : [...weekOff, day].sort(),
      }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ ...form, payroll_days_in_month: Number(form.payroll_days_in_month) || 30 })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Branch Name <span className="text-rose-500">*</span></label>
          <input
            required
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Main Showroom, North Branch"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
          <textarea
            rows={2}
            value={form.address}
            onChange={set('address')}
            placeholder="Street address, building no."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
          <input
            value={form.city}
            onChange={set('city')}
            placeholder="e.g. Mumbai"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Country</label>
          <input
            value={form.country}
            onChange={set('country')}
            placeholder="e.g. India"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Timezone</label>
          <select
            value={form.timezone}
            onChange={set('timezone')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all"
          >
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Currency</label>
          <select
            value={form.currency_code}
            onChange={set('currency_code')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all"
          >
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Payroll Days in Month</label>
          <input
            type="number" min={1} max={31}
            value={form.payroll_days_in_month ?? 30}
            onChange={set('payroll_days_in_month')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 focus:bg-white transition-all"
          />
          <p className="mt-1 text-xs text-slate-400">Fixed divisor used to calculate a per-day salary rate for Loss of Pay deductions.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Working Days</label>
          <div className="flex gap-2">
            {WEEKDAYS.map((d) => {
              const isWorking = !(form.week_off_days ?? []).includes(d.value)
              return (
                <button key={d.value} type="button" onClick={() => toggleWorkingDay(d.value)}
                  className={cn(
                    'h-9 w-9 rounded-full text-xs font-semibold border transition-colors',
                    isWorking
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                  )}>
                  {d.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-xs text-slate-400">Unhighlighted days are week-off — no absentee marking and no leave charge on those days.</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <X size={14} /> Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Branch'}
        </button>
      </div>
    </form>
  )
}

// ─── Branch card ──────────────────────────────────────────────────────────────

function BranchCard({ branch, onEdit, onDelete }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700 shrink-0">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 leading-tight">{branch.name}</h3>
            {branch.company && (
              <p className="text-xs text-slate-400">{branch.company.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(branch)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <Pencil size={13} /> Edit
          </button>
          <button
            onClick={() => onDelete(branch)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-500">
        {(branch.city || branch.country) && (
          <div className="flex items-center gap-1.5 col-span-2">
            <MapPin size={11} className="text-slate-400 shrink-0" />
            <span>{[branch.city, branch.country].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {branch.address && (
          <div className="flex items-start gap-1.5 col-span-2">
            <MapPin size={11} className="text-slate-400 shrink-0 mt-0.5" />
            <span className="text-slate-400">{branch.address}</span>
          </div>
        )}
        {branch.timezone && (
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-slate-400 shrink-0" />
            <span>{branch.timezone}</span>
          </div>
        )}
        {branch.currency_code && (
          <div className="flex items-center gap-1.5">
            <DollarSign size={11} className="text-slate-400 shrink-0" />
            <span>{branch.currency_code}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 col-span-2">
          <CalendarClock size={11} className="text-slate-400 shrink-0" />
          <span>
            {WEEKDAYS.filter((d) => !(branch.week_off_days ?? [0, 6]).includes(d.value)).map((d) => d.label).join(' ')}
            {' · '}{branch.payroll_days_in_month ?? 30}-day payroll
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Company info panel ───────────────────────────────────────────────────────

function CompanyPanel() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyApi.get().then((r) => r.data?.data ?? r.data),
    onSuccess: (d) => { if (!form) setForm({ name: d.name ?? '', timezone: d.timezone ?? '' }) },
  })

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => companyApi.update(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company'] }); setEditing(false) },
  })

  if (!company) return null

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-blue-600" />
          <h2 className="font-semibold text-slate-800">Company Information</h2>
        </div>
        {!editing && (
          <button
            onClick={() => { setForm({ name: company.name ?? '', timezone: company.timezone ?? '' }); setEditing(true) }}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors">
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>

      {editing && form ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Company Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Default Timezone</label>
              <select
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => save(form)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-6 text-sm">
          <div>
            <p className="text-xs text-slate-500">Name</p>
            <p className="font-semibold text-slate-800">{company.name}</p>
          </div>
          {company.timezone && (
            <div>
              <p className="text-xs text-slate-500">Timezone</p>
              <p className="font-medium text-slate-700">{company.timezone}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BranchesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editBranch, setEditBranch] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [flashMsg, setFlashMsg] = useState(null)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => {
      const raw = r.data?.data ?? r.data
      return Array.isArray(raw) ? raw : []
    }),
  })

  function flash(msg, type = 'success') {
    setFlashMsg({ msg, type })
    setTimeout(() => setFlashMsg(null), 3000)
  }

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: branchApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setShowForm(false); flash('Branch created.') },
    onError: (err) => flash(err.response?.data?.message ?? 'Failed to create branch.', 'error'),
  })

  const { mutate: update, isPending: updating } = useMutation({
    mutationFn: ({ id, data }) => branchApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setEditBranch(null); flash('Branch updated.') },
    onError: (err) => flash(err.response?.data?.message ?? 'Failed to update branch.', 'error'),
  })

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: (id) => branchApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setDeleteTarget(null); flash('Branch deleted.') },
    onError: (err) => flash(err.response?.data?.message ?? 'Failed to delete branch.', 'error'),
  })

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Branch Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Offices and locations your company operates from.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditBranch(null); setShowForm(true) }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors shrink-0">
            <Plus size={16} /> Add Branch
          </button>
        )}
      </div>

      {/* Flash */}
      {flashMsg && (
        <div className={cn(
          'flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium',
          flashMsg.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-600'
        )}>
          {flashMsg.type === 'success'
            ? <CheckCircle2 size={15} />
            : <AlertCircle size={15} />}
          {flashMsg.msg}
        </div>
      )}

      {/* Company info */}
      <CompanyPanel />

      {/* Add form */}
      {showForm && !editBranch && (
        <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">New Branch</h2>
          </div>
          <BranchForm
            onSave={(data) => create(data)}
            onCancel={() => setShowForm(false)}
            saving={creating}
          />
        </div>
      )}

      {/* Branch list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading branches…
        </div>
      ) : branches.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <Building2 size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="font-medium text-slate-500">No branches yet</p>
          <p className="text-sm text-slate-400 mt-1">Add your first branch to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map((branch) =>
            editBranch?.id === branch.id ? (
              <div key={branch.id} className="sm:col-span-2 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Pencil size={15} className="text-blue-600" />
                  <h2 className="font-semibold text-slate-800">Edit — {branch.name}</h2>
                </div>
                <BranchForm
                  initial={{
                    name: editBranch.name ?? '',
                    address: editBranch.address ?? '',
                    city: editBranch.city ?? '',
                    country: editBranch.country ?? '',
                    timezone: editBranch.timezone ?? 'Asia/Kolkata',
                    currency_code: editBranch.currency_code ?? 'INR',
                    payroll_days_in_month: editBranch.payroll_days_in_month ?? 30,
                    week_off_days: editBranch.week_off_days ?? [0, 6],
                  }}
                  onSave={(data) => update({ id: editBranch.id, data })}
                  onCancel={() => setEditBranch(null)}
                  saving={updating}
                />
              </div>
            ) : (
              <BranchCard
                key={branch.id}
                branch={branch}
                onEdit={(b) => { setEditBranch(b); setShowForm(false) }}
                onDelete={setDeleteTarget}
              />
            )
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Delete Branch</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
                  This cannot be undone. Branches with employees cannot be deleted.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => remove(deleteTarget.id)}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors">
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
