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

  // Roster grid: resolved schedule per employee per day, bulk cell edits.
  rosterGrid: (params) => api.get('/rosters/grid', { params }),
  saveRoster: (data) => api.put('/rosters/grid', data),
  copyWeek: (data) => api.post('/rosters/copy-week', data),
  setWeeklyOffs: (data) => api.put('/rosters/weekly-offs', data),

  listSwaps: (params) => api.get('/shift-swaps', { params }),
  swapColleagues: () => api.get('/shift-swaps/colleagues'),
  requestSwap: (data) => api.post('/shift-swaps', data),
  respondSwap: (id, response) => api.post(`/shift-swaps/${id}/respond`, { response }),
  cancelSwap: (id) => api.post(`/shift-swaps/${id}/cancel`),
  approveSwap: (id, data) => api.post(`/shift-swaps/${id}/approve`, data),
  rejectSwap: (id, data) => api.post(`/shift-swaps/${id}/reject`, data),
}

export const holidayApi = {
  list: (params) => api.get('/holidays', { params }),
  create: (data) => api.post('/holidays', data),
  update: (id, data) => api.put(`/holidays/${id}`, data),
  remove: (id) => api.delete(`/holidays/${id}`),
}
