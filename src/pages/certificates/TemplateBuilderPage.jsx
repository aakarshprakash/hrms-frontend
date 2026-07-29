import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Eye, EyeOff, Globe, Copy, ArrowLeft, Upload } from 'lucide-react'
import { certificateApi } from '@/lib/api/certificates'
import { RichEditor } from '@/components/editor/RichEditor'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const TEMPLATE_TYPES = ['experience', 'joining', 'salary_hike', 'relieving', 'noc', 'custom']

const schema = z.object({
  name: z.string().min(1, 'Template name required'),
  type: z.string().min(1, 'Type required'),
  branch_id: z.number({ required_error: 'Branch is required' }).int().positive(),
})

// Build dummy preview data from token list
function buildSampleData(tokens) {
  const map = {}
  tokens.forEach((group) => group.items?.forEach((t) => { map[`{{${t.token}}}`] = t.example }))
  return map
}

function applyPreview(html, sampleData) {
  if (!html) return ''
  let result = html
  Object.entries(sampleData).forEach(([token, val]) => {
    result = result.replaceAll(token, `<span class="preview-token">${val}</span>`)
  })
  // Highlight any remaining unfilled tokens
  result = result.replace(/\{\{[^}]+\}\}/g, (m) => `<span class="preview-missing">${m}</span>`)
  return result
}

export default function TemplateBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const isEdit = !!id
  const [bodyHtml, setBodyHtml] = useState('')
  const [headerHtml, setHeaderHtml] = useState('')
  const [footerHtml, setFooterHtml] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [activeTab, setActiveTab] = useState('body') // 'body' | 'header' | 'footer'
  const [toast, setToast] = useState(null)

  function notify(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const { data: tokenGroups = [] } = useQuery({
    queryKey: ['certificate-tokens'],
    queryFn: () => certificateApi.tokens().then((r) => {
      const raw = r.data?.data ?? r.data
      // Convert object { employee: [...], salary: [...] } → [{ label, items }]
      return Object.entries(raw).map(([key, items]) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        items,
      }))
    }),
  })

  const sampleData = buildSampleData(tokenGroups)

  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['certificate-template', id],
    queryFn: () => certificateApi.getTemplate(id).then((r) => r.data?.data ?? r.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (template) {
      setBodyHtml(template.html_body ?? '')
      setHeaderHtml(template.header_html ?? '')
      setFooterHtml(template.footer_html ?? '')
    }
  }, [template])

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: 'experience', branch_id: activeBranch?.id ?? undefined },
  })

  useEffect(() => {
    if (template) {
      setValue('name', template.name)
      setValue('type', template.type)
      if (template.branch_id) setValue('branch_id', template.branch_id)
    }
  }, [template, setValue])

  // Keep branch_id in sync when active branch changes (new template only)
  useEffect(() => {
    if (!isEdit && activeBranch?.id) setValue('branch_id', activeBranch.id)
  }, [activeBranch?.id, isEdit, setValue])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit
      ? certificateApi.updateTemplate(id, data)
      : certificateApi.createTemplate(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['certificate-templates'] })
      notify(isEdit ? 'Template saved.' : 'Template created.')
      if (!isEdit) navigate(`/certificates/templates/${res.data?.data?.id ?? res.data?.id}/edit`)
    },
    onError: () => notify('Save failed.', 'error'),
  })

  const publishMutation = useMutation({
    mutationFn: () => certificateApi.publishTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificate-template', id] }); notify('Template published!') },
  })

  const cloneMutation = useMutation({
    mutationFn: () => certificateApi.cloneTemplate(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['certificate-templates'] })
      const newId = res.data?.data?.id ?? res.data?.id
      notify('Template cloned.')
      if (newId) navigate(`/certificates/templates/${newId}/edit`)
    },
  })

  function onSubmit(fields) {
    saveMutation.mutate({ ...fields, html_body: bodyHtml, header_html: headerHtml, footer_html: footerHtml })
  }

  if (isEdit && templateLoading) return <div className="flex justify-center py-24"><Spinner className="h-10 w-10" /></div>

  const isPublished = template?.status === 'published'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/certificates" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Template' : 'New Template'}</h1>
            {template && (
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium mt-0.5',
                isPublished ? 'text-emerald-600' : 'text-slate-400')}>
                <span className={cn('h-1.5 w-1.5 rounded-full', isPublished ? 'bg-emerald-500' : 'bg-slate-300')} />
                {isPublished ? 'Published' : 'Draft'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
            {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
          {isEdit && !isPublished && (
            <button type="button" onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm shadow-emerald-500/20">
              <Globe size={15} /> Publish
            </button>
          )}
          {isEdit && (
            <button type="button" onClick={() => cloneMutation.mutate()}
              disabled={cloneMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Copy size={15} /> Clone
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className={cn('rounded-xl px-4 py-3 text-sm font-medium',
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200')}>
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={cn('gap-6', showPreview ? 'grid grid-cols-1 xl:grid-cols-2' : 'space-y-5')}>
          {/* Left: editor */}
          <div className="space-y-5">
            {/* Meta fields */}
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Template Name</label>
                  <input {...register('name')} placeholder="e.g. Experience Certificate"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500" />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Certificate Type</label>
                  <select {...register('type')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500">
                    {TEMPLATE_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Editor tabs */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-100 bg-slate-50">
                {[
                  { key: 'body', label: 'Body' },
                  { key: 'header', label: 'Header HTML' },
                  { key: 'footer', label: 'Footer HTML' },
                ].map((t) => (
                  <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                    className={cn('px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
                      activeTab === t.key ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700')}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {activeTab === 'body' && (
                  <RichEditor value={bodyHtml} onChange={setBodyHtml} tokens={tokenGroups} placeholder="Write your certificate body here. Use the { } button to insert data tokens." minHeight={320} />
                )}
                {activeTab === 'header' && (
                  <RichEditor value={headerHtml} onChange={setHeaderHtml} tokens={tokenGroups} placeholder="Optional header HTML (shown above body in PDF)…" minHeight={160} />
                )}
                {activeTab === 'footer' && (
                  <RichEditor value={footerHtml} onChange={setFooterHtml} tokens={tokenGroups} placeholder="Optional footer HTML (shown below body in PDF)…" minHeight={160} />
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saveMutation.isPending}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 disabled:opacity-60">
                {saveMutation.isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <Save size={15} />}
                Save Template
              </button>
            </div>
          </div>

          {/* Right: live preview */}
          {showPreview && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Live Preview <span className="text-xs text-slate-400 font-normal">(sample data)</span></h2>
              <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                {/* A4 preview container */}
                <div className="bg-slate-100 p-4">
                  <div className="bg-white shadow-md rounded-lg overflow-hidden mx-auto" style={{ maxWidth: 595, minHeight: 842 }}>
                    <style>{`
                      .preview-token { background: #dbeafe; color: #1d4ed8; border-radius: 3px; padding: 0 2px; }
                      .preview-missing { background: #fee2e2; color: #dc2626; border-radius: 3px; padding: 0 2px; font-family: monospace; font-size: 11px; }
                    `}</style>
                    {headerHtml && (
                      <div className="px-8 pt-6 pb-3 border-b border-slate-100 text-xs text-slate-500"
                        dangerouslySetInnerHTML={{ __html: applyPreview(headerHtml, sampleData) }} />
                    )}
                    <div className="px-8 py-6 prose prose-sm max-w-none text-slate-800"
                      dangerouslySetInnerHTML={{ __html: applyPreview(bodyHtml, sampleData) }} />
                    {footerHtml && (
                      <div className="px-8 pb-6 pt-3 border-t border-slate-100 text-xs text-slate-500"
                        dangerouslySetInnerHTML={{ __html: applyPreview(footerHtml, sampleData) }} />
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Blue = sample data · Red = unresolved token
              </p>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
