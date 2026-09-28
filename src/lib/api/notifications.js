import api from './axios'

export const notificationApi = {
  // The bell
  list: (params) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),

  // My channel preferences
  preferences: () => api.get('/me/notification-preferences'),
  savePreferences: (data) => api.put('/me/notification-preferences', data),

  // Organisation settings (notifications.manage)
  settings: () => api.get('/notification-settings'),
  saveSettings: (data) => api.put('/notification-settings', data),
  test: (data) => api.post('/notification-settings/test', data),
  logs: (params) => api.get('/notification-logs', { params }),
}
