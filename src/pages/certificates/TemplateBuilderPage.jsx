import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Eye, EyeOff, Globe, Copy, FileText } from 'lucide-react'
import { certificateApi } from '@/lib/api/certificates'
import { RichEditor } from '@/components/editor/RichEditor'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { PageHeader, Card, Button, Field, Input, Select, Tabs, StatusPill } from '@/components/ui/kit'

const TEMPLATE_TYPES = [['experience', 'Experience'], ['joining', 'Joining'], ['salary_hike', 'Salary hike'], ['relieving', 'Relieving'], ['noc', 'NOC'], ['custom', 'Custom']]

const schema = z.object({
  name: z.string().min(1, 'Template name required'),
  type: z.string().min(1, 'Type required'),
  branch_id: z.number({ required_error: 'Branch is required' }).int().positive(),
})

// Sample values for each {{token}}, from the token catalogue.
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
  return result.replace(/\{\{[^}]+\}\}/g, (m) => `<span class="preview-missing">${m}</span>`)
}

/** Design a letter template: rich-text body with data tokens, header/footer, live A4 preview. */
export default function TemplateBuilderPage() {
  const { id } = useParams()
  const { data: template, isLoading } = useQuery({
    queryKey: ['certificate-template', id],
    queryFn: () => certificateApi.getTemplate(id).then((r) => r.data?.data ?? r.data),
    enabled: !!id,
  })
  if (id && isLoading) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>
  // Remount per template so the editor state starts from what was saved.
  return <TemplateEditor key={id ?? 'new'} id={id} template={template} />
}

function TemplateEditor({ id, template }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const activeBranch = useAuthStore((s) => s.activeBranch)
  const isEdit = !!id
  const [bodyHtml, setBodyHtml] = useState(template?.html_body ?? '')
  const [headerHtml, setHeaderHtml] = useState(template?.header_html ?? '')
  const [footerHtml, setFooterHtml] = useState(template?.footer_html ?? '')
  const [showPreview, setShowPreview] = useState(true)
  const [activeTab, setActiveTab] = useState('body')
  const [toast, setToast] = useState(null)
  const notify = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const { data: tokenGroups = [] } = useQuery({
    queryKey: ['certificate-tokens'],
    queryFn: () => certificateApi.tokens().then((r) => {
      const raw = r.data?.data ?? r.data
      return Object.entries(raw).map(([key, items]) => ({ label: key.charAt(0).toUpperCase() + key.slice(1), items }))
    }),
  })
  const sampleData = buildSampleData(tokenGroups)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: template?.name ?? '', type: template?.type ?? 'experience', branch_id: template?.branch_id ?? activeBranch?.id ?? undefined },
  })

  // A new template follows the branch switcher.
  useEffect(() => {
    if (!isEdit && activeBranch?.id) setValue('branch_id', activeBranch.id)
  }, [activeBranch?.id, isEdit, setValue])

  const save = useMutation({
    mutationFn: (data) => (isEdit ? certificateApi.updateTemplate(id, data) : certificateApi.createTemplate(data)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['certificate-templates'] })
      notify(isEdit ? 'Template saved.' : 'Template created.')
      if (!isEdit) navigate(`/certificates/templates/${res.data?.data?.id ?? res.data?.id}/edit`)
    },
    onError: () => notify('Save failed.', 'error'),
  })
  const publish = useMutation({
    mutationFn: () => certificateApi.publishTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificate-template', id] }); notify('Template published — employees can request it now.') },
  })
  const clone = useMutation({
    mutationFn: () => certificateApi.cloneTemplate(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['certificate-templates'] })
      const newId = res.data?.data?.id ?? res.data?.id
      notify('Template duplicated.')
      if (newId) navigate(`/certificates/templates/${newId}/edit`)
    },
  })

  const onSubmit = (fields) => save.mutate({ ...fields, html_body: bodyHtml, header_html: headerHtml, footer_html: footerHtml })
  const isPublished = template?.status === 'published'

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <PageHeader icon={FileText} title={isEdit ? template?.name || 'Edit template' : 'New template'}
        breadcrumbs={[{ label: 'Letters & certificates', to: '/certificates' }, { label: isEdit ? 'Edit template' : 'New template' }]}
        actions={<>
          {template && <StatusPill status={isPublished ? 'published' : 'draft'} />}
          <Button type="button" variant="secondary" icon={showPreview ? EyeOff : Eye} onClick={() => setShowPreview((v) => !v)}>{showPreview ? 'Hide preview' : 'Preview'}</Button>
          {isEdit && <Button type="button" variant="secondary" icon={Copy} loading={clone.isPending} onClick={() => clone.mutate()}>Duplicate</Button>}
          {isEdit && !isPublished && <Button type="button" variant="success" icon={Globe} loading={publish.isPending} onClick={() => publish.mutate()}>Publish</Button>}
          <Button type="submit" icon={Save} loading={save.isPending}>Save</Button>
        </>} />

      {toast && (
        <div className={cn('mb-4 rounded-lg border px-4 py-2.5 text-[13px] font-medium',
          toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700')}>{toast.msg}</div>
      )}

      <div className={cn('gap-6', showPreview ? 'grid grid-cols-1 items-start xl:grid-cols-2' : 'space-y-6')}>
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Template name" required error={errors.name?.message}>
                <Input {...register('name')} placeholder="e.g. Experience certificate" />
              </Field>
              <Field label="Letter type">
                <Select {...register('type')}>{TEMPLATE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
              </Field>
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-5 pt-2">
              <Tabs value={activeTab} onChange={setActiveTab} tabs={[{ key: 'body', label: 'Body' }, { key: 'header', label: 'Header' }, { key: 'footer', label: 'Footer' }]} />
            </div>
            <div className="p-4">
              {activeTab === 'body' && <RichEditor value={bodyHtml} onChange={setBodyHtml} tokens={tokenGroups} placeholder="Write the letter here. Use the { } button to insert data tokens." minHeight={320} />}
              {activeTab === 'header' && <RichEditor value={headerHtml} onChange={setHeaderHtml} tokens={tokenGroups} placeholder="Optional header, printed above the body…" minHeight={160} />}
              {activeTab === 'footer' && <RichEditor value={footerHtml} onChange={setFooterHtml} tokens={tokenGroups} placeholder="Optional footer, printed below the body…" minHeight={160} />}
            </div>
          </Card>
        </div>

        {showPreview && (
          <Card padded={false} className="xl:sticky xl:top-20">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <p className="text-[15px] font-semibold text-slate-900">Preview</p>
              <p className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-100 ring-1 ring-blue-300" />Sample data</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-100 ring-1 ring-rose-300" />Unknown token</span>
              </p>
            </div>
            <div className="bg-slate-100 p-4">
              <div className="mx-auto overflow-hidden rounded bg-white shadow-md" style={{ maxWidth: 595, minHeight: 842 }}>
                <style>{`
                  .preview-token { background: #dbeafe; color: #1d4ed8; border-radius: 3px; padding: 0 2px; }
                  .preview-missing { background: #fee2e2; color: #dc2626; border-radius: 3px; padding: 0 2px; font-family: monospace; font-size: 11px; }
                `}</style>
                {headerHtml && <div className="border-b border-slate-100 px-8 pb-3 pt-6 text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: applyPreview(headerHtml, sampleData) }} />}
                <div className="prose prose-sm max-w-none px-8 py-6 text-slate-800" dangerouslySetInnerHTML={{ __html: applyPreview(bodyHtml, sampleData) }} />
                {footerHtml && <div className="border-t border-slate-100 px-8 pb-6 pt-3 text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: applyPreview(footerHtml, sampleData) }} />}
              </div>
            </div>
          </Card>
        )}
      </div>
    </form>
  )
}
