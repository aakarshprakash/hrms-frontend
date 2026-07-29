import api from './axios'

export const attendanceApi = {
  checkIn: (data) => api.post('/attendance/check-in', data),
  checkOut: (data) => api.post('/attendance/check-out', data),
  list: (params) => api.get('/attendance', { params }),
  get: (id) => api.get(`/attendance/${id}`),
  daySummary: (params) => api.get('/attendance/day-summary', { params }),
  manualUpsert: (data) => api.post('/attendance/manual', data),

  listRegularizations: (params) => api.get('/attendance/regularizations', { params }),
  submitRegularization: (data) => api.post('/attendance/regularizations', data),
  approveRegularization: (id, data) => api.post(`/attendance/regularizations/${id}/approve`, data),
  rejectRegularization: (id, data) => api.post(`/attendance/regularizations/${id}/reject`, data),

  reportSummary: (params) => api.get('/attendance/reports/summary', { params }),
  reportSummaryExport: (params) => api.get('/attendance/reports/summary/export', { params, responseType: 'blob' }),
  musterRoll: (params) => api.get('/attendance/reports/muster-roll', { params }),
  exceptions: (params) => api.get('/attendance/exceptions', { params }),
}
