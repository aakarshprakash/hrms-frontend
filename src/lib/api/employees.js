import api from './axios'

export const employeeApi = {
  list: (params) => api.get('/employees', { params }),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  terminate: (id) => api.delete(`/employees/${id}`),

  uploadAvatar: (employeeId, formData) =>
    api.post(`/employees/${employeeId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  uploadDocument: (employeeId, formData) =>
    api.post(`/employees/${employeeId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listDocuments: (employeeId) => api.get(`/employees/${employeeId}/documents`),
  deleteDocument: (employeeId, mediaId) =>
    api.delete(`/employees/${employeeId}/documents/${mediaId}`),
  // Documents are private: fetched with the session token, never via a public URL.
  downloadDocument: (employeeId, mediaId) =>
    api.get(`/employees/${employeeId}/documents/${mediaId}/download`, { responseType: 'blob' }),
  audit: (employeeId) => api.get(`/employees/${employeeId}/audit`),
}

export async function openEmployeeDocument(employeeId, doc) {
  const res = await employeeApi.downloadDocument(employeeId, doc.id)
  const url = URL.createObjectURL(new Blob([res.data], { type: doc.mime_type || res.data.type }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
