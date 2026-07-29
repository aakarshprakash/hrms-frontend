import api from './axios'

export const overtimeApi = {
  listRules: (params) => api.get('/overtime-rules', { params }),
  createRule: (data) => api.post('/overtime-rules', data),
  updateRule: (id, data) => api.put(`/overtime-rules/${id}`, data),
  deleteRule: (id) => api.delete(`/overtime-rules/${id}`),

  list: (params) => api.get('/overtime-requests', { params }),
  get: (id) => api.get(`/overtime-requests/${id}`),
  submit: (data) => api.post('/overtime-requests', data),
  approve: (id, data) => api.post(`/overtime-requests/${id}/approve`, data),
  reject: (id, data) => api.post(`/overtime-requests/${id}/reject`, data),
}
