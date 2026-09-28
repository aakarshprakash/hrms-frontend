import api from './axios'

export const complianceApi = {
  summary: (params) => api.get('/compliance/summary', { params }),
  preview: (report, params) => api.get(`/compliance/${report}/preview`, { params }),
  download: (report, params) => api.get(`/compliance/${report}/download`, { params, responseType: 'blob' }),
}
