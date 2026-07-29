import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react'
import { holidayApi } from '@/lib/api/shifts'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function buildCalendar(year, month, holidays) {
  const byDate = {}
  for (const h of holidays) byDate[h.date?.slice(0, 10)] = h
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, date: key, holiday: byDate[key] ?? null })
  }
  return cells
}

function HolidayForm({ initial, branches, activeBranchId, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.date?.slice(0, 10) ?? '')
  const [branchId, setBranchId] = useState(initial?.branch_id ?? activeBranchId ?? '')
  const [recurring, setRecurring] = useState(initial?.recurring ?? false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !date || !branchId) return
    onSave({ name: name.trim(), date, branch_id: Number(branchId), recurring })
  }

  return (
    <form onSubmit={handleSubmit}
      className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-4">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
        {initial ? 'Edit Holiday' : 'Add Holiday'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Holiday Name <span className="text-red-500">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="e.g. Diwali, Christmas"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date <span className="text-red-500">*</span></label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Branch <span className="text-red-500">*</span></label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
            <button type="button" onClick={() => setRecurring((v) => !v)}
              className={cn('relative w-10 h-5 rounded-full transition-colors', recurring ? 'bg-blue-600' : 'bg-slate-300')}>
              <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                recurring ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
            <span className="text-sm text-slate-700">Recurring Yearly</span>
          </label>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {saving && <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {initial ? 'Save Changes' : 'Add Holiday'}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function HolidayPage() {
  const qc = useQueryClient()
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const { canManageEmployees } = useRole()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [filterBranch, setFilterBranch] = useState(activeBranch?.id ?? '')

  function prev() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  function next() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  const { data: branchesRaw } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })
  const branches = Array.isArray(branchesRaw) ? branchesRaw : (branchesRaw?.data ?? [])

  const { data: holidayResp, isLoading } = useQuery({
    queryKey: ['holidays', year, month + 1, filterBranch],
    queryFn: () => holidayApi.list({
      year,
      month: month + 1,
      ...(filterBranch ? { branch_id: filterBranch } : {}),
    }).then((r) => r.data),
    staleTime: 60_000,
  })
  const holidays = holidayResp?.data ?? []

  const createMut = useMutation({
    mutationFn: (d) => holidayApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); setShowAdd(false) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => holidayApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); setEditId(null) },
  })
  const deleteMut = useMutation({
    mutationFn: (id) => holidayApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })

  const cells = buildCalendar(year, month, holidays)
  const todayStr = now.toISOString().slice(0, 10)
  const upcomingHolidays = holidays
    .filter((h) => h.date?.slice(0, 10) >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  const editingHoliday = editId ? holidays.find((h) => h.id === editId) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Holiday Calendar</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Holidays are linked to attendance — check-ins on holidays are flagged automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {canManageEmployees && !showAdd && !editId && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus size={15} /> Add Holiday
            </button>
          )}
        </div>
      </div>

      {/* Add/Edit form */}
      {(showAdd || editId) && (
        <HolidayForm
          initial={editingHoliday}
          branches={branches}
          activeBranchId={activeBranchId}
          onSave={(d) => editId ? updateMut.mutate({ id: editId, ...d }) : createMut.mutate(d)}
          onCancel={() => { setShowAdd(false); setEditId(null) }}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <button onClick={prev} className="rounded p-1 hover:bg-slate-100"><ChevronLeft size={18} /></button>
            <h2 className="text-sm font-semibold text-slate-900">{MONTH_NAMES[month]} {year}</h2>
            <button onClick={next} className="rounded p-1 hover:bg-slate-100"><ChevronRight size={18} /></button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, i) => {
                  if (!cell) return <div key={`blank-${i}`} />
                  const isToday = cell.date === todayStr
                  const dow = new Date(cell.date).getDay()
                  return (
                    <div
                      key={cell.date}
                      title={cell.holiday?.name}
                      onClick={() => {
                        if (cell.holiday && canManageEmployees) setEditId(cell.holiday.id)
                      }}
                      className={cn(
                        'aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors relative',
                        isToday && 'ring-2 ring-blue-500',
                        cell.holiday
                          ? 'bg-red-100 cursor-pointer hover:bg-red-200'
                          : dow === 0 || dow === 6
                            ? 'bg-slate-50'
                            : 'hover:bg-slate-50'
                      )}
                    >
                      <span className={cn(
                        'font-medium',
                        isToday ? 'text-blue-700' : cell.holiday ? 'text-red-700' : dow === 0 || dow === 6 ? 'text-slate-400' : 'text-slate-700'
                      )}>{cell.day}</span>
                      {cell.holiday && (
                        <span className="text-[8px] text-red-600 font-medium mt-0.5 px-0.5 truncate w-full text-center leading-tight">
                          {cell.holiday.name}
                        </span>
                      )}
                      {cell.holiday?.recurring && (
                        <RefreshCw size={7} className="text-red-400 absolute top-1 right-1" />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-4 mt-4 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 inline-block" />Holiday {canManageEmployees && '(click to edit)'}</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-blue-500 inline-block" />Today</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-50 inline-block" />Weekend</span>
                <span className="flex items-center gap-1.5"><RefreshCw size={10} className="text-red-400" />Recurring</span>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Upcoming */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <CalendarDays size={15} /> Upcoming Holidays
            </h3>
            {upcomingHolidays.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No upcoming holidays this month.</p>
            ) : (
              <div className="space-y-3">
                {upcomingHolidays.map((h) => (
                  <div key={h.id} className="flex gap-3 items-start">
                    <div className="rounded-lg bg-red-50 px-2.5 py-1.5 text-center min-w-[44px]">
                      <p className="text-xs font-bold text-red-600">{new Date(h.date).toLocaleDateString('default', { day: '2-digit' })}</p>
                      <p className="text-[10px] text-red-400">{new Date(h.date).toLocaleDateString('default', { month: 'short' })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{h.name}</p>
                      <p className="text-xs text-slate-400">{new Date(h.date).toLocaleDateString('default', { weekday: 'long' })}</p>
                      {h.recurring && <span className="text-[10px] text-indigo-500 flex items-center gap-0.5"><RefreshCw size={9} />Recurring</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All this month as list with management */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">All Holidays This Month</h3>
            {holidays.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No holidays this month.</p>
            ) : (
              <div className="space-y-2">
                {holidays.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-2 group">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-800 font-medium">{h.name}</span>
                      {h.recurring && <RefreshCw size={10} className="text-indigo-400 inline ml-1" />}
                      <span className="text-xs text-slate-400 ml-2">{h.date?.slice(5)}</span>
                    </div>
                    {canManageEmployees && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditId(h.id); setShowAdd(false) }}
                          className="rounded p-1 text-slate-400 hover:text-blue-600">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => { if (confirm(`Delete "${h.name}"?`)) deleteMut.mutate(h.id) }}
                          className="rounded p-1 text-slate-400 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
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
