import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { Search, BadgeCheck, XCircle, ShieldCheck } from 'lucide-react'
import { certificateApi } from '@/lib/api/certificates'
import { Button, Input, ErrorBanner } from '@/components/ui/kit'
import logoFull from '@/assets/brand/logo-full.png'

/** Public page: anyone can check a letter or certificate number is genuine. */
export default function VerifyPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const checked = searchParams.get('cert') ?? ''
  const [certNumber, setCertNumber] = useState(checked)

  // A 404 is an answer ("not ours"), not an error.
  const { data: result, isFetching, error } = useQuery({
    queryKey: ['verify-certificate', checked],
    queryFn: () => certificateApi.verify(checked)
      .then((r) => r.data?.data ?? r.data)
      .catch((err) => { if (err.response?.status === 404) return { valid: false }; throw err }),
    enabled: !!checked,
    retry: false,
  })

  function submit(e) {
    e.preventDefault()
    if (certNumber.trim()) setSearchParams({ cert: certNumber.trim() })
  }

  const verifyUrl = `${window.location.origin}/verify?cert=${encodeURIComponent(checked)}`

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <img src={logoFull} alt="PeopleNex HRMS" className="h-8 w-auto" />
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><ShieldCheck size={14} className="text-blue-600" />Document verification</span>
      </header>

      <main className="flex flex-1 items-start justify-center p-6 sm:pt-16">
        <div className="w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"><ShieldCheck size={24} /></div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verify a document</h1>
            <p className="mt-1 text-sm text-slate-500">Enter the number printed on the letter or certificate.</p>
          </div>

          <form onSubmit={submit} className="mt-6 flex gap-2">
            <Input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} placeholder="e.g. CERT-HO-2026-0001" className="h-10 flex-1" aria-label="Certificate number" />
            <Button type="submit" size="lg" icon={Search} loading={isFetching} disabled={!certNumber.trim()}>Verify</Button>
          </form>

          <ErrorBanner error={error} message={error ? 'Verification failed. Please try again.' : undefined} className="mt-4" />

          {result && !isFetching && (result.valid ? (
            <div className="mt-6 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-xs">
              <div className="flex items-center gap-3 bg-emerald-50 px-5 py-4">
                <BadgeCheck size={28} className="text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-800">Genuine document</p>
                  <p className="text-xs text-emerald-700">Issued through PeopleNex HRMS</p>
                </div>
              </div>
              <dl className="divide-y divide-slate-100 text-[13px]">
                {[
                  ['Number', checked],
                  ['Type', result.type],
                  ['Issued to', result.employee_name],
                  ['Issued by', result.branch],
                  ['Issued on', result.issued_at ? new Date(result.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-5 py-2.5">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-right font-medium text-slate-900">{value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
                <QRCode value={verifyUrl} size={72} level="M" />
                <p className="text-xs text-slate-500">Scan to open this verification result.</p>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
              <XCircle size={22} className="mt-0.5 shrink-0 text-rose-500" />
              <div>
                <p className="font-semibold text-rose-800">No match found</p>
                <p className="mt-0.5 text-[13px] text-rose-700">Nothing was issued with the number <strong>{checked}</strong>. Check it and try again.</p>
              </div>
            </div>
          ))}

          <p className="mt-8 text-center text-xs text-slate-400">This page is public — no sign-in needed.</p>
        </div>
      </main>
    </div>
  )
}
