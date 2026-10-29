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

  exceptions: (params) => api.get('/attendance/exceptions', { params }),

  // Unified reports
  reportOptions: () => api.get('/attendance/report-options'),
  report: (type, params) => api.get(`/attendance/report/${type}`, { params }),
  reportExport: (type, params) => api.get(`/attendance/report/${type}/export`, { params, responseType: 'blob' }),

  // Geo-fencing
  geofences: () => api.get('/geofences'),
  saveGeofence: (branchId, data) => api.put(`/branches/${branchId}/geofence`, data),
  saveGeofenceMaster: (data) => api.put('/geofence/settings', data),
  createSite: (branchId, data) => api.post(`/branches/${branchId}/geo-sites`, data),
  updateSite: (id, data) => api.put(`/geo-sites/${id}`, data),
  deleteSite: (id) => api.delete(`/geo-sites/${id}`),
  geofenceEmployees: (params) => api.get('/geofence/employees', { params }),
  assignGeofence: (data) => api.post('/geofence/employees', data),

  // Punch pipeline
  reprocess: (data) => api.post('/attendance/reprocess', data),
  rawPunches: (params) => api.get('/raw-punches', { params }),
  unmatchedCodes: (params) => api.get('/raw-punches/unmatched-codes', { params }),
  mapDeviceCode: (employeeId, data) => api.post(`/employees/${employeeId}/map-device-code`, data),
}
