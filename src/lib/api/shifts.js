import api from './axios'

export const shiftApi = {
  list: (params) => api.get('/shifts', { params }),
  get: (id) => api.get(`/shifts/${id}`),
  create: (data) => api.post('/shifts', data),
  update: (id, data) => api.put(`/shifts/${id}`, data),
  remove: (id) => api.delete(`/shifts/${id}`),
  assign: (shiftId, data) => api.post(`/shifts/${shiftId}/assign`, data),
  assignBulk: (shiftId, data) => api.post(`/shifts/${shiftId}/assign-bulk`, data),
  employeeAssignments: (employeeId) => api.get(`/employees/${employeeId}/shift-assignments`),

  rosters: (params) => api.get('/shift-rosters', { params }),
  createRoster: (data) => api.post('/shift-rosters', data),

  listSwaps: (params) => api.get('/shift-swaps', { params }),
  requestSwap: (data) => api.post('/shift-swaps', data),
  approveSwap: (id) => api.post(`/shift-swaps/${id}/approve`),
  rejectSwap: (id) => api.post(`/shift-swaps/${id}/reject`),
}

export const holidayApi = {
  list: (params) => api.get('/holidays', { params }),
  create: (data) => api.post('/holidays', data),
  update: (id, data) => api.put(`/holidays/${id}`, data),
  remove: (id) => api.delete(`/holidays/${id}`),
}
