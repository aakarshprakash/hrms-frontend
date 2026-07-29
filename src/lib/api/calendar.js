import api from './axios'

export const calendarApi = {
  events: (params) => api.get('/dashboard/calendar', { params }),
}
