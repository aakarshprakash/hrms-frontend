import api from './axios'

export const leaveApi = {
  listTypes: (params) => api.get('/leave-types', { params }),
  createType: (data) => api.post('/leave-types', data),
  updateType: (id, data) => api.put(`/leave-types/${id}`, data),
  deleteType: (id) => api.delete(`/leave-types/${id}`),
  listBalances: (params) => api.get('/leave-balances', { params }),
  list: (params) => api.get('/leaves', { params }),
  get: (id) => api.get(`/leaves/${id}`),
  submit: (data) => api.post('/leaves', data),
  approve: (id, data) => api.post(`/leaves/${id}/approve`, data),
  reject: (id, data) => api.post(`/leaves/${id}/reject`, data),
  cancel: (id) => api.post(`/leaves/${id}/cancel`),
}
