import api from './axios'

export const meApi = {
  home: () => api.get('/me/home'),
}
