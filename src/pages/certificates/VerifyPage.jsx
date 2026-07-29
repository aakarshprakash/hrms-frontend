import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { Search, CheckCircle, XCircle, Shield, ExternalLink } from 'lucide-react'
import { certificateApi } from '@/lib/api/certificates'
import { cn } from '@/lib/utils'

export default function VerifyPage() {
  const [searchParams] = useSearchParams()
  const [certNumber, setCertNumber] = useState(searchParams.get('cert') ?? '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleVerify(e) {
    e?.preventDefault()
    if (!certNumber.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await certificateApi.verify(certNumber.trim())
      setResult(res.data?.data ?? res.data)
    } catch (err) {
      if (err.response?.status === 404) {
        setResult({ valid: false })
      } else {
        setError('Verification failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Auto-verify if cert number in URL
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (searchParams.get('cert')) handleVerify() }, [])

  const verifyUrl = `${window.location.origin}/verify?cert=${certNumber}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <span className="font-bold text-slate-900">HRMS</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Shield size={13} className="text-blue-500" />
          Certificate Verification
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Title */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
              <Shield size={26} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Verify Certificate</h1>
            <p className="text-sm text-slate-500 mt-1">
              Enter a certificate number to verify its authenticity
            </p>
          </div>

          {/* Search form */}
          <form onSubmit={handleVerify} className="flex gap-2">
            <input
              type="text"
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              placeholder="e.g. CERT-HO-2026-0001"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 shadow-sm"
            />
            <button type="submit" disabled={loading || !certNumber.trim()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 disabled:opacity-60 transition-colors">
              {loading
                ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <Search size={16} />}
            </button>
          </form>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={cn(
              'rounded-2xl border p-6 text-center shadow-sm',
              result.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            )}>
              {result.valid ? (
                <>
                  <CheckCircle size={40} className="mx-auto text-emerald-500 mb-3" />
                  <h2 className="text-lg font-bold text-emerald-800 mb-4">Certificate Valid</h2>
                  <div className="space-y-2.5 text-sm text-left bg-white rounded-xl p-4 border border-emerald-100">
                    {[
                      ['Certificate No.', certNumber],
                      ['Type', result.type],
                      ['Issued To', result.employee_name],
                      ['Issued By', result.branch],
                      ['Issue Date', result.issued_at ? new Date(result.issued_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <span className="text-slate-500 shrink-0">{label}</span>
                        <span className="font-semibold text-slate-900 text-right">{value ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                  {/* QR code for sharing */}
                  {certNumber && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <QRCode value={verifyUrl} size={100} level="M" className="rounded-lg" />
                      <p className="text-xs text-emerald-600">Share this QR to verify</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <XCircle size={40} className="mx-auto text-red-400 mb-3" />
                  <h2 className="text-lg font-bold text-red-700 mb-2">Certificate Not Found</h2>
                  <p className="text-sm text-red-600">
                    No certificate matches <strong>{certNumber}</strong>.<br />
                    Please check the number and try again.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-xs text-slate-400">
            This verification page is publicly accessible. No login required.
          </p>
        </div>
      </div>
    </div>
  )
}
