import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react'
import { salaryApi } from '@/lib/api/payroll'
import { branchApi } from '@/lib/api/departments'
import { useAuthStore } from '@/store/authStore'
import { useRole } from '@/hooks/useRole'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const TABS = ['Salary Components', 'Statutory Rules']

// ─── Salary Components ────────────────────────────────────────────────────────

function ComponentRow({ comp, branches, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(comp.name)
  const [type, setType] = useState(comp.type)
  const [calcType, setCalcType] = useState(comp.calculation_type)

  function handleSave() {
    onSave(comp.id, { name, type, calculation_type: calcType })
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-2">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded border bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </td>
        <td className="px-4 py-2">
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="rounded border bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="earning">Earning</option>
            <option value="deduction">Deduction</option>
          </select>
        </td>
        <td className="px-4 py-2">
          <select value={calcType} onChange={(e) => setCalcType(e.target.value)}
            className="rounded border bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="fixed">Fixed Amount</option>
            <option value="percentage">% of Basic</option>
          </select>
        </td>
        <td className="px-4 py-2 text-slate-500 text-sm">{comp.branch?.name ?? '—'}</td>
        <td className="px-4 py-2 text-right">
          <button onClick={handleSave} className="mr-2 text-blue-600 hover:text-blue-800"><Check size={15} /></button>
          <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 font-medium text-slate-800">{comp.name}</td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          comp.type === 'earning' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
        )}>
          {comp.type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 capitalize">{comp.calculation_type?.replace('_', ' ')}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{comp.branch?.name ?? '—'}</td>
      <td className="px-4 py-3 text-right">
        <button onClick={() => setEditing(true)} className="mr-3 text-slate-400 hover:text-blue-600"><Edit2 size={14} /></button>
        <button onClick={() => onDelete(comp.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
      </td>
    </tr>
  )
}

function AddComponentForm({ branches, activeBranchId, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('earning')
  const [calcType, setCalcType] = useState('fixed')
  const [branchId, setBranchId] = useState(activeBranchId ?? '')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !branchId) return
    onSave({ name: name.trim(), type, calculation_type: calcType, branch_id: Number(branchId) })
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">New Salary Component</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Component Name <span className="text-red-500">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="e.g. Basic Pay, HRA, PF"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="earning">Earning</option>
            <option value="deduction">Deduction</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Calculation</label>
          <select value={calcType} onChange={(e) => setCalcType(e.target.value)}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="fixed">Fixed Amount</option>
            <option value="percentage">% of Basic</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Branch <span className="text-red-500">*</span></label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="">Select branch</option>
            {(Array.isArray(branches) ? branches : []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Add Component
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

function SalaryComponentsTab() {
  const qc = useQueryClient()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [showAdd, setShowAdd] = useState(false)
  const [filterType, setFilterType] = useState('')

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['salary-components'],
    queryFn: () => salaryApi.listComponents().then((r) => r.data?.data ?? r.data ?? []),
  })

  const createMut = useMutation({
    mutationFn: (d) => salaryApi.createComponent(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-components'] }); setShowAdd(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => salaryApi.updateComponent(id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-components'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => salaryApi.deleteComponent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-components'] }),
  })

  const components = Array.isArray(data) ? data : []
  const filtered = filterType ? components.filter((c) => c.type === filterType) : components
  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.data ?? [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">{components.length} component{components.length !== 1 ? 's' : ''}</p>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="">All Types</option>
            <option value="earning">Earnings</option>
            <option value="deduction">Deductions</option>
          </select>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus size={15} /> Add Component
          </button>
        )}
      </div>

      {showAdd && (
        <AddComponentForm
          branches={branches}
          activeBranchId={activeBranchId}
          onSave={(d) => createMut.mutate(d)}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {createMut.isError && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          {createMut.error?.response?.data?.message ?? 'Failed to create component.'}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Calculation</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    {components.length === 0 ? 'No salary components yet. Add one to get started.' : 'No components match the selected filter.'}
                  </td>
                </tr>
              )}
              {filtered.map((comp) => (
                <ComponentRow
                  key={comp.id}
                  comp={comp}
                  branches={branches}
                  onSave={(id, d) => updateMut.mutate({ id, ...d })}
                  onDelete={(id) => { if (confirm('Delete this component?')) deleteMut.mutate(id) }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <strong>Earnings</strong> add to gross pay (Basic Pay, HRA, Conveyance, etc.).<br />
        <strong>Deductions</strong> subtract from gross pay (PF Employee, ESI Employee, TDS, etc.).<br />
        Statutory deductions (PF, ESI, Tax) are managed separately under <em>Statutory Rules</em>.
      </div>
    </div>
  )
}

// ─── Statutory Rules ──────────────────────────────────────────────────────────

function StatutoryRulesTab() {
  const qc = useQueryClient()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ branch_id: activeBranchId ?? '', rule_type: 'PF', config_json: '{}' })

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list().then((r) => r.data?.data ?? r.data ?? []),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['statutory-rules'],
    queryFn: () => salaryApi.listStatutory().then((r) => r.data?.data ?? r.data ?? []),
  })

  const createMut = useMutation({
    mutationFn: (d) => salaryApi.createStatutory(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['statutory-rules'] }); setShowAdd(false); resetForm() },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => salaryApi.updateStatutory(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['statutory-rules'] }); setEditId(null) },
  })

  function resetForm() {
    setForm({ branch_id: activeBranchId ?? '', rule_type: 'PF', config_json: '{}' })
  }

  function startEdit(rule) {
    setEditId(rule.id)
    setForm({
      branch_id: rule.branch_id,
      rule_type: rule.rule_type,
      config_json: typeof rule.config_json === 'string' ? rule.config_json : JSON.stringify(rule.config_json, null, 2),
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    let parsed
    try { parsed = JSON.parse(form.config_json) } catch { alert('Invalid JSON in config'); return }
    const payload = { branch_id: Number(form.branch_id), rule_type: form.rule_type, config_json: parsed }
    if (editId) updateMut.mutate({ id: editId, ...payload })
    else createMut.mutate(payload)
  }

  const rules = Array.isArray(data) ? data : []
  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.data ?? [])

  const TEMPLATES = {
    PF: JSON.stringify({ employee_rate: 12, employer_rate: 12, wage_ceiling: 15000 }, null, 2),
    ESI: JSON.stringify({ employee_rate: 0.75, employer_rate: 3.25, wage_ceiling: 21000 }, null, 2),
    TAX: JSON.stringify({ slabs: [{ up_to: 300000, rate: 0 }, { up_to: 600000, rate: 5 }, { up_to: 900000, rate: 10 }, { up_to: 1200000, rate: 15 }, { up_to: 1500000, rate: 20 }, { up_to: null, rate: 30 }] }, null, 2),
  }

  const FormSection = (
    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
        {editId ? 'Edit Statutory Rule' : 'New Statutory Rule'}
      </p>
      <div className="grid gap-3 sm:grid-cols-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Branch <span className="text-red-500">*</span></label>
          <select value={form.branch_id} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))} required
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Rule Type</label>
          <select value={form.rule_type}
            onChange={(e) => setForm((f) => ({ ...f, rule_type: e.target.value, config_json: TEMPLATES[e.target.value] ?? '{}' }))}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="PF">PF (Provident Fund)</option>
            <option value="ESI">ESI</option>
            <option value="TAX">Income Tax</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Config JSON</label>
        <textarea value={form.config_json} onChange={(e) => setForm((f) => ({ ...f, config_json: e.target.value }))}
          rows={6} spellCheck={false}
          className="w-full rounded-md border bg-white px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-blue-500" />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          {editId ? 'Save Changes' : 'Add Rule'}
        </button>
        <button type="button" onClick={() => { setShowAdd(false); setEditId(null); resetForm() }}
          className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{rules.length} rule{rules.length !== 1 ? 's' : ''} configured</p>
        {!showAdd && !editId && (
          <button onClick={() => { setShowAdd(true); resetForm() }}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus size={15} /> Add Rule
          </button>
        )}
      </div>

      {(showAdd || editId) && FormSection}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="space-y-3">
          {rules.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
              No statutory rules configured yet.
            </div>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                      {rule.rule_type}
                    </span>
                    <span className="text-sm text-slate-500">{rule.branch?.name ?? '—'}</span>
                  </div>
                  <pre className="text-xs font-mono text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto">
                    {typeof rule.config_json === 'string' ? rule.config_json : JSON.stringify(rule.config_json, null, 2)}
                  </pre>
                </div>
                <button onClick={() => { startEdit(rule); setShowAdd(false) }}
                  className="shrink-0 text-slate-400 hover:text-blue-600 mt-1">
                  <Edit2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <strong>PF:</strong> <code>&#123;"employee_rate": 12, "employer_rate": 12, "wage_ceiling": 15000&#125;</code><br />
        <strong>ESI:</strong> <code>&#123;"employee_rate": 0.75, "employer_rate": 3.25, "wage_ceiling": 21000&#125;</code><br />
        <strong>TAX:</strong> <code>&#123;"slabs": [&#123;"up_to": 300000, "rate": 0&#125;, ...]&#125;</code>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PayrollSettingsPage() {
  const [activeTab, setActiveTab] = useState('Salary Components')
  const { canManageEmployees } = useRole()

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Payroll Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage salary components and statutory deduction rules</p>
      </div>

      <div className="border-b mb-6">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn(
                'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Salary Components' && <SalaryComponentsTab />}
      {activeTab === 'Statutory Rules' && <StatutoryRulesTab />}
    </div>
  )
}
