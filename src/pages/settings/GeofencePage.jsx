import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  MapPin, LocateFixed, Save, ShieldCheck, ShieldAlert, ExternalLink, Ruler, Plus, Pencil, Trash2, Users, Search, Navigation, Building2,
} from 'lucide-react'
import { attendanceApi } from '@/lib/api/attendance'
import { apiError } from '@/lib/api/axios'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import {
  PageHeader, Card, Button, Field, Input, Select, Toggle, StatusPill, ErrorBanner, EmptyState, Tabs, Modal, IconButton, Table, Pagination,
} from '@/components/ui/kit'

const RADII = [100, 200, 500, 1000]
const MODE_LABEL = { branch: 'On — branch sites', anywhere: 'Off — punch anywhere', sites: 'On — specific sites' }
const MODE_TONE = { branch: 'blue', anywhere: 'amber', sites: 'indigo' }
const MODE_ICON = { branch: 'bg-blue-50 text-blue-600', anywhere: 'bg-amber-50 text-amber-600', sites: 'bg-indigo-50 text-indigo-600' }

function here() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('This browser can’t share its location.')); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      () => reject(new Error('Location permission was denied. Allow location for this site and try again.')),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  })
}

function metres(a, b) {
  const r = 6371000
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * r * Math.asin(Math.min(1, Math.sqrt(h))))
}

function mapSrc(lat, lng, radius) {
  const span = Math.max(0.002, (Number(radius) / 111000) * 2.2)
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - span},${lat - span},${lng + span},${lat + span}&layer=mapnik&marker=${lat},${lng}`
}

/**
 * Geo-fencing: each branch has one or more sites (showroom, workshop,
 * warehouse…) people may punch from; employees follow their branch, punch
 * anywhere (field staff), or only at specific sites.
 */
export default function GeofencePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'people' ? 'people' : 'sites'
  const setTab = (key) => setParams(key === 'people' ? { tab: key } : {}, { replace: true })
  const { data, isLoading } = useQuery({ queryKey: ['geofences'], queryFn: () => attendanceApi.geofences().then((r) => r.data) })

  return (
    <div className="space-y-6">
      <PageHeader icon={MapPin} title="Geo-fencing"
        subtitle="Allow web and mobile punches only from your work locations. Biometric devices and kiosks are not affected." />
      {data?.master && <MasterSettings key={JSON.stringify(data.master)} master={data.master} siteCount={data.data.reduce((n, b) => n + b.sites.length, 0)} />}
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'sites', label: 'Branches & sites' }, { key: 'people', label: 'Employees' }]} />
      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
        : !data?.data.length ? <Card><EmptyState icon={MapPin} title="No branches" description="Add a branch first." /></Card>
          : tab === 'sites' ? <div className="space-y-5">{data.data.map((b) => <BranchFence key={b.id} branch={b} master={data.master} />)}</div>
            : <EmployeeRules branches={data.data} />}
    </div>
  )
}

/** Organisation-wide switch and defaults. */
function MasterSettings({ master, siteCount }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ enabled: master.enabled, mode: master.mode, require_location: master.require_location, default_radius: master.default_radius })
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const save = useMutation({ mutationFn: () => attendanceApi.saveGeofenceMaster(form).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences'] }) })
  const people = master.employees ?? {}
  const restricted = (people.branch ?? 0) + (people.sites ?? 0)

  return (
    <Card className={cn('border-2', master.enabled ? 'border-emerald-200' : 'border-slate-200')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', master.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}><ShieldCheck size={22} /></span>
          <div>
            <p className="text-[15px] font-semibold text-slate-900">Master settings</p>
            <p className="text-xs text-slate-500">Applies to every branch and employee unless they’re excluded below.</p>
            <p className="mt-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">{restricted}</span> employee(s) {master.enabled ? 'geo-fenced' : 'will be geo-fenced when this is on'} · <span className="font-semibold text-slate-900">{people.anywhere ?? 0}</span> can punch anywhere · {siteCount} site{siteCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <StatusPill tone={master.enabled ? 'green' : 'slate'} label={master.enabled ? 'Geo-fencing on' : 'Geo-fencing off'} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Toggle checked={form.enabled} onChange={(v) => set({ enabled: v })} label="Geo-fencing for the organisation"
            description="When off, nobody’s punch location is restricted — locations are still recorded." />
          <Toggle checked={form.require_location} onChange={(v) => set({ require_location: v })} label="Require location"
            description="Refuse web / app punches when the device doesn’t share its location." />
          <Field label="Default radius for new sites">
            <div className="flex items-center gap-2"><Input type="number" min={25} max={50000} className="w-28" value={form.default_radius} onChange={(e) => set({ default_radius: e.target.value })} /><span className="text-xs text-slate-400">metres</span></div>
          </Field>
        </div>
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-slate-700">Punches from outside a site</p>
          {[
            ['block', ShieldCheck, 'Block them', 'The punch is refused, with the distance shown.'],
            ['flag', ShieldAlert, 'Allow, but flag for HR', 'Counted, and listed in Location exceptions.'],
          ].map(([key, Icon, title, text]) => (
            <button key={key} type="button" onClick={() => set({ mode: key })}
              className={cn('flex w-full gap-2.5 rounded-lg border p-3 text-left', form.mode === key ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50')}>
              <Icon size={18} className={form.mode === key ? 'text-blue-600' : 'text-slate-400'} />
              <span><span className="block text-[13px] font-medium text-slate-900">{title}</span><span className="block text-xs text-slate-500">{text}</span></span>
            </button>
          ))}
        </div>
      </div>
      <ErrorBanner error={save.error} message={save.error ? apiError(save.error) : undefined} className="mt-4" />
      <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {save.data?.message && <span className="text-xs text-emerald-700">{save.data.message}</span>}
        <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save master settings</Button>
      </div>
    </Card>
  )
}

function BranchFence({ branch, master }) {
  const qc = useQueryClient()
  const s = branch.settings
  const [form, setForm] = useState({ enabled: s.branch_enabled, mode: s.mode_override ?? '' })
  const [editing, setEditing] = useState(null)
  const [preview, setPreview] = useState(branch.sites[0]?.id ?? null)
  const [test, setTest] = useState(null)
  const [locError, setLocError] = useState(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['geofences'] })
  const save = useMutation({ mutationFn: () => attendanceApi.saveGeofence(branch.id, { enabled: form.enabled, mode: form.mode || null }), onSuccess: refresh })
  const status = !master.enabled ? ['slate', 'Master switch off'] : !s.branch_enabled ? ['amber', 'Excluded']
    : !s.sites ? ['amber', 'No sites yet — not enforced'] : ['green', `On · ${s.sites} site${s.sites === 1 ? '' : 's'}`]
  const remove = useMutation({ mutationFn: (id) => attendanceApi.deleteSite(id), onSuccess: refresh })
  const shown = branch.sites.find((x) => x.id === preview) ?? branch.sites[0]
  const people = branch.employees

  const testHere = async () => {
    setLocError(null)
    try {
      const p = await here()
      const best = branch.sites.filter((x) => x.is_active).map((x) => ({ site: x, d: metres(x, p) })).sort((a, b) => (a.d - a.site.radius_m) - (b.d - b.site.radius_m))[0]
      setTest(best ? { ...best, accuracy: p.accuracy } : null)
    } catch (err) {
      setLocError(err.message)
    }
  }

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold text-slate-900"><Building2 size={16} className="text-slate-400" />{branch.name}</p>
          <p className="text-xs text-slate-500">{[branch.address, branch.city].filter(Boolean).join(', ') || 'No address on file'}
            {' · '}{people.branch} at branch premises · {people.anywhere} anywhere · {people.sites} on specific sites</p>
        </div>
        <StatusPill tone={status[0]} label={status[1]} />
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Sites */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Sites</p>
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing({})}>Add site</Button>
          </div>
          {branch.sites.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              No sites yet. Add the showroom, workshop or office people punch from.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {branch.sites.map((x) => (
                <div key={x.id} onClick={() => setPreview(x.id)}
                  className={cn('flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors', shown?.id === x.id ? 'bg-blue-50/60' : 'hover:bg-slate-50')}>
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', x.is_active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400')}><MapPin size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-900">{x.name}{!x.is_active && <span className="ml-1.5 text-xs font-normal text-slate-400">(paused)</span>}</p>
                    <p className="truncate text-xs text-slate-500">{x.radius_m} m radius · {Number(x.latitude).toFixed(5)}, {Number(x.longitude).toFixed(5)}{x.assigned > 0 && ` · ${x.assigned} assigned`}</p>
                  </div>
                  <a href={`https://www.google.com/maps?q=${x.latitude},${x.longitude}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Open in Google Maps"><ExternalLink size={14} /></a>
                  <IconButton icon={Pencil} label="Edit" tone="primary" onClick={(e) => { e.stopPropagation(); setEditing(x) }} />
                  <IconButton icon={Trash2} label="Remove" tone="danger" onClick={(e) => { e.stopPropagation(); if (confirm(`Remove “${x.name}”?`)) remove.mutate(x.id) }} />
                </div>
              ))}
            </div>
          )}
          {shown && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <iframe title={`Map of ${shown.name}`} src={mapSrc(Number(shown.latitude), Number(shown.longitude), shown.radius_m)} className="h-52 w-full" loading="lazy" />
              <p className="bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">{shown.name}: the pin is the centre; the fence is a {shown.radius_m} m circle around it.</p>
            </div>
          )}
          <ErrorBanner error={remove.error} message={remove.error ? apiError(remove.error) : undefined} />
        </div>

        {/* Branch behaviour */}
        <div className="space-y-4">
          <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="Include this branch"
            description="Off excludes the whole branch, whatever the master setting." />
          <Field label="Punches from outside a site" hint={`Organisation default: ${master.mode === 'flag' ? 'allow and flag' : 'block'}.`}>
            <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} disabled={!form.enabled}>
              <option value="">Use the organisation default</option>
              <option value="block">Block them (this branch only)</option>
              <option value="flag">Allow, but flag for HR (this branch only)</option>
            </Select>
          </Field>
          {locError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{locError}</p>}
          {test && (
            <p className={cn('rounded-lg px-3 py-2 text-xs', test.d <= test.site.radius_m ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800')}>
              You are {test.d} m from {test.site.name} (±{test.accuracy} m) — a punch from here would be {test.d <= test.site.radius_m ? 'inside' : 'outside'} the fence.
            </p>
          )}
          <ErrorBanner error={save.error} message={save.error ? apiError(save.error) : undefined} />
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <Button variant="ghost" size="sm" icon={Ruler} disabled={!branch.sites.length} onClick={testHere}>Test from here</Button>
            <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
          </div>
          {save.isSuccess && <p className="text-right text-xs text-emerald-700">{save.data?.data?.message}</p>}
        </div>
      </div>

      {editing && <SiteModal branch={branch} site={editing} defaultRadius={master.default_radius} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); setPreview(id); refresh() }} />}
    </Card>
  )
}

function SiteModal({ branch, site, defaultRadius, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: site.name ?? (branch.sites.length ? '' : 'Main premises'), latitude: site.latitude ?? '', longitude: site.longitude ?? '',
    radius_m: site.radius_m ?? defaultRadius ?? 200, address: site.address ?? branch.address ?? '', is_active: site.is_active ?? true,
  })
  const [locError, setLocError] = useState(null)
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const hasPoint = form.latitude !== '' && form.longitude !== '' && !Number.isNaN(Number(form.latitude)) && !Number.isNaN(Number(form.longitude))
  const save = useMutation({
    mutationFn: () => {
      const data = { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), radius_m: Number(form.radius_m) }
      return (site.id ? attendanceApi.updateSite(site.id, data) : attendanceApi.createSite(branch.id, data)).then((r) => r.data.data)
    },
    onSuccess: (s) => onSaved(s.id),
  })
  const useHere = async () => {
    setLocError(null)
    try {
      const p = await here()
      set({ latitude: p.latitude.toFixed(6), longitude: p.longitude.toFixed(6) })
      if (p.accuracy > 100) setLocError(`Accuracy is about ${p.accuracy} m — for a precise point, set it from a phone on the premises.`)
    } catch (err) {
      setLocError(err.message)
    }
  }

  return (
    <Modal title={site.id ? `Edit ${site.name}` : `New site · ${branch.name}`} onClose={onClose} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Save} loading={save.isPending} disabled={!form.name.trim() || !hasPoint} onClick={() => save.mutate()}>Save site</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required><Input value={form.name} placeholder="e.g. Showroom, Workshop, Yard" onChange={(e) => set({ name: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Latitude" required><Input value={form.latitude} placeholder="9.9816" onChange={(e) => set({ latitude: e.target.value })} /></Field>
          <Field label="Longitude" required><Input value={form.longitude} placeholder="76.2999" onChange={(e) => set({ longitude: e.target.value })} /></Field>
          <div className="flex items-end"><Button variant="secondary" icon={LocateFixed} onClick={useHere}>Use my location</Button></div>
        </div>
        <p className="text-xs text-slate-500">Tip: in Google Maps, right-click the spot and click the coordinates to copy them.</p>
        {locError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{locError}</p>}
        {hasPoint && <iframe title="Site preview" src={mapSrc(Number(form.latitude), Number(form.longitude), form.radius_m)} className="h-48 w-full rounded-lg border border-slate-200" loading="lazy" />}
        <Field label="Radius" hint="Allow for GPS drift indoors — 150–300 m suits most offices and showrooms.">
          <div className="flex flex-wrap items-center gap-2">
            {RADII.map((r) => (
              <button key={r} type="button" onClick={() => set({ radius_m: r })}
                className={cn('rounded-full px-3 py-1 text-xs font-medium ring-1', Number(form.radius_m) === r ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}>
                {r >= 1000 ? `${r / 1000} km` : `${r} m`}
              </button>
            ))}
            <Input type="number" min={25} max={50000} className="w-28" value={form.radius_m} onChange={(e) => set({ radius_m: e.target.value })} />
            <span className="text-xs text-slate-400">metres</span>
          </div>
        </Field>
        <Field label="Address (optional)"><Input value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        {site.id && <Toggle checked={form.is_active} onChange={(v) => set({ is_active: v })} label="Active" description="Paused sites don’t count as allowed locations." />}
        <ErrorBanner error={save.error} message={save.error ? apiError(save.error) : undefined} />
      </div>
    </Modal>
  )
}

function EmployeeRules({ branches }) {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ branch_id: '', mode: '', search: '', page: 1 })
  const [selected, setSelected] = useState([])
  const [rule, setRule] = useState({ mode: 'anywhere', site_ids: [] })
  const set = (p) => { setFilters((f) => ({ ...f, page: 1, ...p })); setSelected([]) }

  const { data, isLoading } = useQuery({
    queryKey: ['geofence-employees', filters],
    queryFn: () => attendanceApi.geofenceEmployees(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).then((r) => r.data),
    placeholderData: keepPreviousData,
  })
  const rows = data?.data ?? []
  const assign = useMutation({
    mutationFn: () => attendanceApi.assignGeofence({ employee_ids: selected, mode: rule.mode, site_ids: rule.mode === 'sites' ? rule.site_ids : undefined }).then((r) => r.data),
    onSuccess: () => { setSelected([]); qc.invalidateQueries({ queryKey: ['geofence-employees'] }); qc.invalidateQueries({ queryKey: ['geofences'] }) },
  })
  const quick = useMutation({
    mutationFn: ({ id, on }) => attendanceApi.assignGeofence({ employee_ids: [id], mode: on ? 'branch' : 'anywhere' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['geofence-employees'] }); qc.invalidateQueries({ queryKey: ['geofences'] }) },
  })
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id))
  const sitesByBranch = branches.filter((b) => b.sites.length)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {[['branch', Building2, 'On — branch sites', 'Can punch at any site of their branch. The default.'], ['anywhere', Navigation, 'Off — punch anywhere', 'Sales, drivers, travelling staff. Location is still recorded.'], ['sites', MapPin, 'On — specific sites', 'Only the sites you pick, even another branch’s.']]
          .map(([key, Icon, title, text]) => (
            <div key={key} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', MODE_ICON[key])}><Icon size={17} /></span>
              <div><p className="text-[13px] font-semibold text-slate-900">{title}</p><p className="text-xs text-slate-500">{text}</p></div>
            </div>
          ))}
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="w-56 pl-8" placeholder="Name or code…" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
          </div>
          <Select className="w-auto" value={filters.branch_id} onChange={(e) => set({ branch_id: e.target.value })}>
            <option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select className="w-auto" value={filters.mode} onChange={(e) => set({ mode: e.target.value })}>
            <option value="">Any rule</option>{Object.entries(MODE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-start gap-3 border-b border-blue-100 bg-blue-50/60 px-5 py-3">
            <p className="pt-2 text-sm font-medium text-blue-900"><Users size={15} className="mr-1 inline" />{selected.length} selected — set rule:</p>
            <Select className="w-48" value={rule.mode} onChange={(e) => setRule({ ...rule, mode: e.target.value })}>
              {Object.entries(MODE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            {rule.mode === 'sites' && (
              <div className="flex max-w-xl flex-wrap gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
                {sitesByBranch.length === 0 && <span className="text-xs text-slate-500">Add sites first.</span>}
                {sitesByBranch.flatMap((b) => b.sites.map((x) => (
                  <label key={x.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                    <input type="checkbox" checked={rule.site_ids.includes(x.id)}
                      onChange={(e) => setRule({ ...rule, site_ids: e.target.checked ? [...rule.site_ids, x.id] : rule.site_ids.filter((i) => i !== x.id) })} />
                    {x.name} <span className="text-slate-400">({b.name})</span>
                  </label>
                )))}
              </div>
            )}
            <Button loading={assign.isPending} disabled={rule.mode === 'sites' && !rule.site_ids.length} onClick={() => assign.mutate()}>Apply</Button>
            <Button variant="ghost" onClick={() => setSelected([])}>Clear</Button>
          </div>
        )}
        {assign.data?.message && !selected.length && <p className="border-b border-emerald-100 bg-emerald-50 px-5 py-2 text-sm text-emerald-800">{assign.data.message}</p>}
        <ErrorBanner error={assign.error} message={assign.error ? apiError(assign.error) : undefined} className="m-4" />

        {isLoading ? <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div> : (
          <Table rows={rows} onRowClick={(r) => toggle(r.id)} empty={<EmptyState icon={Users} title="No employees match" />}
            columns={[
              { key: 'select', label: <input type="checkbox" aria-label="Select all on this page" checked={allOnPage}
                onChange={() => setSelected(allOnPage ? selected.filter((id) => !rows.some((r) => r.id === id)) : [...new Set([...selected, ...rows.map((r) => r.id)])])} />,
              render: (r) => <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${r.name}`} /> },
              { key: 'name', label: 'Employee', render: (r) => <div><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-400">{r.employee_code}</p></div> },
              { key: 'branch', label: 'Branch' },
              { key: 'mode', label: 'Geo-fencing', render: (r) => (
                <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Toggle checked={r.mode !== 'anywhere'} disabled={quick.isPending && quick.variables?.id === r.id}
                    onChange={(on) => quick.mutate({ id: r.id, on })} />
                  <StatusPill tone={MODE_TONE[r.mode]} label={MODE_LABEL[r.mode]} dot={false} />
                  {r.mode === 'sites' && r.sites.map((x) => <span key={x.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{x.name}</span>)}
                </div>
              ) },
            ]} />
        )}
        <div className="px-4 pb-4"><Pagination meta={data?.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} /></div>
      </Card>
    </div>
  )
}
