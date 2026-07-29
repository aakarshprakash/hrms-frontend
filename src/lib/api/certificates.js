import api from './axios'

export const certificateApi = {
  // Tokens
  tokens: () => api.get('/certificate-tokens'),

  // Templates
  listTemplates: (params) => api.get('/certificate-templates', { params }),
  getTemplate: (id) => api.get(`/certificate-templates/${id}`),
  createTemplate: (data) => api.post('/certificate-templates', data),
  updateTemplate: (id, data) => api.put(`/certificate-templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/certificate-templates/${id}`),
  publishTemplate: (id) => api.post(`/certificate-templates/${id}/publish`),
  cloneTemplate: (id) => api.post(`/certificate-templates/${id}/clone`),

  // Requests
  listRequests: (params) => api.get('/certificate-requests', { params }),
  getRequest: (id) => api.get(`/certificate-requests/${id}`),
  submitRequest: (data) => api.post('/certificate-requests', data),
  approveRequest: (id, data) => api.post(`/certificate-requests/${id}/approve`, data),
  rejectRequest: (id, data) => api.post(`/certificate-requests/${id}/reject`, data),

  // Issued
  listIssued: (params) => api.get('/issued-certificates', { params }),
  getIssued: (id) => api.get(`/issued-certificates/${id}`),
  // API auth is a Bearer token, not a cookie, so a plain <a href> to this
  // path can't authenticate -- fetch it as a blob instead (see openIssuedCertificatePdf).
  fetchIssuedPdf: (id) => api.get(`/issued-certificates/${id}/pdf`, { responseType: 'blob' }),

  // Public verify (no auth)
  verify: (number) => api.get(`/verify/${number}`),
}

export async function openIssuedCertificatePdf(id, { download, filename } = {}) {
  const res = await certificateApi.fetchIssuedPdf(id)
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
  if (download) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename ?? `certificate-${id}.pdf`
    a.click()
  } else {
    window.open(url, '_blank', 'noopener')
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
