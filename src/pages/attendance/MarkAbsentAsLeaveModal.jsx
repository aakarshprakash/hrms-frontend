import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leaveApi } from '@/lib/api/leaves'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Modal, Button, Field, Select, Textarea, ErrorBanner } from '@/components/ui/kit'

/** Covers a past absent day with leave: a one-day leave request linked to the attendance record. */
export default function MarkAbsentAsLeaveModal({ record, onClose, onSuccess }) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const date = String(record.date).slice(0, 10)

  const { data: types = [] } = useQuery({
    queryKey: ['leave-types', record.employee?.branch_id],
    queryFn: () => leaveApi.listTypes(record.employee?.branch_id ? { branch_id: record.employee.branch_id } : {}).then((r) => r.data?.data ?? []),
  })

  // Available = balance less other pending requests (same figure the server checks).
  const { data: balances = [] } = useQuery({
    queryKey: ['leave-summary', 'me'],
    queryFn: () => leaveApi.summary().then((r) => r.data?.data ?? []),
    enabled: !!user?.employee_id,
  })
  const selected = balances.find((b) => String(b.leave_type.id) === leaveTypeId)
  const available = selected && !selected.unlimited ? Number(selected.available) : null

  const submit = useMutation({
    mutationFn: () => leaveApi.submit({ leave_type_id: leaveTypeId, reason: reason.trim(), source_attendance_id: record.id, start_date: date, end_date: date }),
    onSuccess: () => {
      ;['attendance', 'leave-summary', 'leaves'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      onSuccess?.()
    },
  })

  const errors = { type: !leaveTypeId && 'Choose a leave type', reason: reason.trim().length < 5 && 'At least 5 characters' }
  function send() {
    setTouched(true)
    if (!errors.type && !errors.reason) submit.mutate()
  }

  return (
    <Modal size="sm" title="Cover this day with leave" onClose={onClose}
      subtitle={`${new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · currently absent`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={submit.isPending} onClick={send}>Submit request</Button></>}>
      <div className="space-y-4">
        <ErrorBanner error={submit.error} />
        <Field label="Leave type" required error={touched && errors.type}>
          <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            <option value="">Select type</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          {available != null && (
            <p className={cn('mt-2 rounded-lg px-3 py-2 text-xs font-medium', available >= 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
              {available} day{available === 1 ? '' : 's'} available{available < 1 && ' — not enough for this day'}
            </p>
          )}
        </Field>
        <Field label="Reason" required error={touched && errors.reason}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why should this day be covered by leave?" />
        </Field>
      </div>
    </Modal>
  )
}
