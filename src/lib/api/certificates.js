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
  issuedPdfUrl: (id) => `/api/issued-certificates/${id}/pdf`,

  // Public verify (no auth)
  verify: (number) => api.get(`/verify/${number}`),
}
