import api from './axios'

export const userApi = {
  list: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
  roles: () => api.get('/roles'),
}

export const aiApi = {
  insights: (params) => api.get('/ai/insights', { params }),
}
