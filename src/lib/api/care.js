import api from './axios'

export const helpdeskApi = {
  meta: () => api.get('/helpdesk/meta'),
  list: (params) => api.get('/helpdesk/tickets', { params }),
  get: (id) => api.get(`/helpdesk/tickets/${id}`),
  create: (data) => api.post('/helpdesk/tickets', data),
  reply: (id, data) => api.post(`/helpdesk/tickets/${id}/messages`, data),
  update: (id, data) => api.put(`/helpdesk/tickets/${id}`, data),
  rate: (id, data) => api.post(`/helpdesk/tickets/${id}/rate`, data),
}

export const announcementApi = {
  feed: () => api.get('/announcements'),
  read: (id) => api.post(`/announcements/${id}/read`),
  acknowledge: (id) => api.post(`/announcements/${id}/acknowledge`),
  manage: () => api.get('/announcements/manage'),
  create: (data) => api.post('/announcements', data),
  update: (id, data) => api.put(`/announcements/${id}`, data),
  remove: (id) => api.delete(`/announcements/${id}`),
  readers: (id) => api.get(`/announcements/${id}/readers`),
}
