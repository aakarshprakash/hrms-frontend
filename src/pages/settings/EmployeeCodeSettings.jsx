import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Hash, Save } from 'lucide-react'
import { employeeApi } from '@/lib/api/employees'
import { Card, CardHeader, Button, Field, Input, Toggle, ErrorBanner } from '@/components/ui/kit'

/** Automatic employee numbering (prefix + running number), shown on the Organisation page. */
export default function EmployeeCodeSettings({ editable }) {
  const { data } = useQuery({
    queryKey: ['employee-code-settings'],
    queryFn: () => employeeApi.codeSettings().then((r) => r.data.data),
  })
  if (!data) return null

  return <CodeForm key={JSON.stringify(data)} initial={data} editable={editable} />
}

function preview({ prefix, digits, start }) {
  return `${(prefix || '').toUpperCase()}${String(Math.max(1, Number(start) || 1)).padStart(Math.min(8, Math.max(1, Number(digits) || 1)), '0')}`
}

function CodeForm({ initial, editable }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ auto: initial.auto, prefix: initial.prefix, digits: initial.digits, start: initial.start })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const mutation = useMutation({
    mutationFn: (payload) => employeeApi.updateCodeSettings(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee-code-settings'] }),
  })

  const dirty = ['auto', 'prefix', 'digits', 'start'].some((k) => String(form[k]) !== String(initial[k]))

  return (
    <Card padded={false} className="mt-6">
      <CardHeader icon={Hash} title="Employee codes"
        subtitle="Number new employees automatically, or type each code by hand."
        actions={editable && (
          <Button size="sm" icon={Save} loading={mutation.isPending} disabled={!dirty}
            onClick={() => mutation.mutate({ ...form, digits: Number(form.digits), start: Number(form.start) })}>
            Save
          </Button>
        )} />
      <div className="space-y-4 p-5">
        <ErrorBanner error={mutation.error} />
        <Toggle checked={form.auto} disabled={!editable} onChange={(auto) => set({ auto })}
          label="Generate employee codes automatically"
          description="The code field on the add-employee form is filled in for you. HR can still overwrite it." />
        <fieldset disabled={!editable || !form.auto} className="grid gap-4 sm:grid-cols-4">
          <Field label="Prefix" hint="Letters, numbers, - / _">
            <Input value={form.prefix} maxLength={20} className="font-mono uppercase"
              onChange={(e) => set({ prefix: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Number of digits">
            <Input type="number" min={1} max={8} value={form.digits} onChange={(e) => set({ digits: e.target.value })} />
          </Field>
          <Field label="Start from" hint="Never below the highest code already used.">
            <Input type="number" min={1} value={form.start} onChange={(e) => set({ start: e.target.value })} />
          </Field>
          <Field label={dirty ? 'Format' : 'Next code'}>
            <div className="flex h-9 items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 font-mono text-[14px] font-semibold text-slate-800">
              {dirty ? preview(form) : initial.next}
            </div>
          </Field>
        </fieldset>
      </div>
    </Card>
  )
}
