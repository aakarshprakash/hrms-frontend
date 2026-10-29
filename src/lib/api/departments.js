import api from './axios'

export const departmentApi = {
  list: (params) => api.get('/departments', { params }),
  get: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  remove: (id) => api.delete(`/departments/${id}`),
}

export const designationApi = {
  list: (params) => api.get('/designations', { params }),
  get: (id) => api.get(`/designations/${id}`),
  create: (data) => api.post('/designations', data),
  update: (id, data) => api.put(`/designations/${id}`, data),
  remove: (id) => api.delete(`/designations/${id}`),
}

export const workLocationApi = {
  list: (params) => api.get('/work-locations', { params }),
  create: (data) => api.post('/work-locations', data),
  update: (id, data) => api.put(`/work-locations/${id}`, data),
  remove: (id) => api.delete(`/work-locations/${id}`),
}

export const branchApi = {
  list: () => api.get('/branches'),
  get: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  remove: (id) => api.delete(`/branches/${id}`),
}

export const companyApi = {
  get: () => api.get('/company'),
  update: (data) => api.put('/company', data),
}
