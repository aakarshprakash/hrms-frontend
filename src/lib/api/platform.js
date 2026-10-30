import api from './axios'

export const platformApi = {
  stats: () => api.get('/platform/stats'),
  industries: () => api.get('/platform/industries'),
  companies: (params) => api.get('/platform/companies', { params }),
  company: (id) => api.get(`/platform/companies/${id}`),
  createCompany: (data) => api.post('/platform/companies', data),
  updateCompany: (id, data) => api.put(`/platform/companies/${id}`, data),
  setStatus: (id, data) => api.post(`/platform/companies/${id}/status`, data),
  mobileSettings: () => api.get('/platform/mobile-settings'),
  saveMobileSettings: (data) => api.put('/platform/mobile-settings', data),
  setCompanyMobileApp: (id, mobileApp) => api.put(`/platform/companies/${id}/mobile-app`, { mobile_app: mobileApp }),
}
