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

function readSession() {
  try {
    const stored = localStorage.getItem('hrms-auth')
    return stored ? JSON.parse(stored).state ?? {} : {}
  } catch {
    return {}
  }
}

api.interceptors.request.use((config) => {
  // Read the session fresh from storage each request so Zustand hydration isn't needed
  const state = readSession()
  if (state.token) {
    config.headers.Authorization = `Bearer ${state.token}`
  }
  // Platform admin acting inside an organisation ("support mode").
  if (state.supportCompanyId && !config.url?.startsWith('/platform')) {
    config.headers['X-Company-Id'] = String(state.supportCompanyId)
  }
  return config
})

// Codes the API returns when the session itself is no longer usable.
const SESSION_ENDING_CODES = ['ACCOUNT_DISABLED', 'TENANT_SUSPENDED', 'NO_TENANT']

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const code = error.response?.data?.code

    if (status === 401 || (status === 403 && SESSION_ENDING_CODES.includes(code))) {
      localStorage.removeItem('hrms-auth')
      if (code) sessionStorage.setItem('hrms-logout-reason', error.response.data.message ?? '')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

/** First human-readable message in an API error (validation or otherwise). */
export function apiError(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data
  if (data?.errors) {
    const first = Object.values(data.errors)[0]
    if (Array.isArray(first) && first[0]) return first[0]
  }
  return data?.message || fallback
}

export default api
