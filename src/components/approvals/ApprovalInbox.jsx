/**
 * Reusable ApprovalInbox — works for leaves, regularizations, and (Phase 3) OT requests.
 *
 * Props:
 *   items: array of requestable objects (leaves / regularizations / OT)
 *   onApprove(id, comments): called when approver clicks Approve
 *   onReject(id, comments): called when approver clicks Reject
 *   renderMeta(item): function returning JSX for the item-specific detail row
 *   emptyText: string shown when no items
 *   loading: boolean
 */

import { useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const STATUS_VARIANT = {
  pending: 'default',
  approved: 'active',
  rejected: 'terminated',
  cancelled: 'inactive',
}

function ActionRow({ item, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState('')
  const [busy, setBusy] = useState(false)

  async function handle(action) {
    setBusy(true)
    try {
      await action(item.id, comments ? { comments } : {})
    } finally {
      setBusy(false)
      setComments('')
      setExpanded(false)
    }
  }

  return (
    <div className="space-y-2">
      {expanded && (
        <div className="rounded-lg bg-slate-50 border p-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            <MessageSquare size={11} className="inline mr-1" />Comments (optional)
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
            placeholder="Add a note…"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button onClick={() => handle(onApprove)} disabled={busy}
              className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
              {busy ? <Spinner className="h-3 w-3 border-white border-t-transparent" /> : <CheckCircle size={13} />}
              Approve
            </button>
            <button onClick={() => handle(onReject)} disabled={busy}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {busy ? <Spinner className="h-3 w-3 border-white border-t-transparent" /> : <XCircle size={13} />}
              Reject
            </button>
            <button onClick={() => setExpanded(false)} className="ml-auto text-xs text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        </div>
      )}
      {!expanded && item.status === 'pending' && (
        <button onClick={() => setExpanded(true)}
          className="text-xs text-blue-600 hover:underline font-medium">
          Review →
        </button>
      )}
    </div>
  )
}

export function ApprovalInbox({
  items = [],
  onApprove,
  onReject,
  renderMeta,
  emptyText = 'No items pending.',
  loading = false,
  showApproverActions = true,
}) {
  const [openId, setOpenId] = useState(null)

  if (loading) return <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>

  if (!items.length) return (
    <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
      {emptyText}
    </div>
  )

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div
            className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
            onClick={() => setOpenId(openId === item.id ? null : item.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {item.employee?.first_name} {item.employee?.last_name}
                </p>
                <Badge label={item.status} variant={STATUS_VARIANT[item.status] ?? 'default'} />
              </div>
              <div className="mt-1">{renderMeta(item)}</div>
            </div>
            <div className="shrink-0 text-slate-400 mt-0.5">
              {openId === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {openId === item.id && (
            <div className="border-t px-4 py-3 bg-slate-50 space-y-3">
              {item.reason && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Reason</p>
                  <p className="text-sm text-slate-700">{item.reason}</p>
                </div>
              )}
              {showApproverActions && item.status === 'pending' && onApprove && onReject && (
                <ActionRow item={item} onApprove={onApprove} onReject={onReject} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
