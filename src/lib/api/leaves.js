import api from './axios'

export const leaveApi = {
  listTypes: (params) => api.get('/leave-types', { params }),
  createType: (data) => api.post('/leave-types', data),
  updateType: (id, data) => api.put(`/leave-types/${id}`, data),
  deleteType: (id) => api.delete(`/leave-types/${id}`),

  // Balances
  listBalances: (params) => api.get('/leave-balances', { params }),
  summary: (params) => api.get('/leave-balances/summary', { params }),
  overview: (params) => api.get('/leave-balances/overview', { params }),
  transactions: (balanceId) => api.get(`/leave-balances/${balanceId}/transactions`),
  adjust: (data) => api.post('/leave-balances/adjust', data),
  recalculate: (data) => api.post('/leave-balances/recalculate', data),

  // Requests
  list: (params) => api.get('/leaves', { params }),
  get: (id) => api.get(`/leaves/${id}`),
  quote: (params) => api.get('/leaves/quote', { params }),
  calendar: (params) => api.get('/leaves/calendar', { params }),
  // FormData when a supporting document is attached.
  submit: (data) => api.post('/leaves', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined),
  approve: (id, data) => api.post(`/leaves/${id}/approve`, data),
  reject: (id, data) => api.post(`/leaves/${id}/reject`, data),
  cancel: (id, data) => api.post(`/leaves/${id}/cancel`, data),
  attachment: (id) => api.get(`/leaves/${id}/attachment`, { responseType: 'blob' }),
  exportRegister: (params) => api.get('/leaves/export', { params, responseType: 'blob' }),
}

export const approvalApi = {
  inbox: () => api.get('/approvals'),
  count: () => api.get('/approvals/count'),
  flows: (params) => api.get('/approval-flows', { params }),
  saveFlow: (branchId, module, data) => api.put(`/approval-flows/${branchId}/${module}`, data),
}
