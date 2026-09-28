import api from './axios'

export const platformApi = {
  stats: () => api.get('/platform/stats'),
  industries: () => api.get('/platform/industries'),
  companies: (params) => api.get('/platform/companies', { params }),
  company: (id) => api.get(`/platform/companies/${id}`),
  createCompany: (data) => api.post('/platform/companies', data),
  updateCompany: (id, data) => api.put(`/platform/companies/${id}`, data),
  setStatus: (id, data) => api.post(`/platform/companies/${id}/status`, data),
}
