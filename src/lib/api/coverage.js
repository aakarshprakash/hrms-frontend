import api from './axios'

export const coverageApi = {
  today: (params) => api.get('/coverage/today', { params }),
  forecast: (params) => api.get('/coverage/forecast', { params }),
  rules: () => api.get('/coverage/rules'),
  createRule: (data) => api.post('/coverage/rules', data),
  updateRule: (id, data) => api.put(`/coverage/rules/${id}`, data),
  deleteRule: (id) => api.delete(`/coverage/rules/${id}`),
  leaveImpact: (leaveId) => api.get(`/leaves/${leaveId}/coverage`),
}

export const COVERAGE_STATUS = {
  ok: { tone: 'green', label: 'Covered' },
  at_risk: { tone: 'amber', label: 'At risk' },
  short: { tone: 'red', label: 'Short-staffed' },
}
