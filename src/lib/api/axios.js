import axios from 'axios'

// Falls back to the relative '/api' path for local dev, where Vite's dev
// server proxies it to the backend (see vite.config.js) -- the browser never
// sees a cross-origin request there. In production, the frontend and
// backend are on different domains (Cloudflare Pages vs. shared hosting),
// so VITE_API_URL must point at the real backend, e.g. https://api.example.com/api.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

api.interceptors.request.use((config) => {
  // Read token fresh from storage each request so Zustand hydration isn't needed
  try {
    const stored = localStorage.getItem('hrms-auth')
    if (stored) {
      const { state } = JSON.parse(stored)
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`
      }
    }
  } catch (_) {}
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hrms-auth')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
