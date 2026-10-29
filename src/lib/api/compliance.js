import api from './axios'

export const complianceApi = {
  summary: (params) => api.get('/compliance/summary', { params }),
  preview: (report, params) => api.get(`/compliance/${report}/preview`, { params }),
  download: (report, params) => api.get(`/compliance/${report}/download`, { params, responseType: 'blob' }),
  form16List: (params) => api.get('/compliance/form16', { params }),
  form16Pdf: (params) => api.get('/compliance/form16/pdf', { params, responseType: 'blob' }),
  myForm16: (params) => api.get('/me/form16', { params, responseType: 'blob' }),
}
