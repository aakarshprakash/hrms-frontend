import api from './axios'

export const billingApi = {
  get: () => api.get('/billing'),
  choosePlan: (data) => api.post('/billing/plan', data),
  cancel: () => api.post('/billing/cancel'),
  resume: () => api.post('/billing/resume'),
  saveDetails: (data) => api.put('/billing/details', data),
  invoices: (params) => api.get('/billing/invoices', { params }),
  invoicePdf: (id) => api.get(`/billing/invoices/${id}/pdf`, { responseType: 'blob' }),
  pay: (id) => api.post(`/billing/invoices/${id}/pay`),
  checkout: (id) => api.post(`/billing/invoices/${id}/checkout`),
  verifyPayment: (data) => api.post('/billing/payments/verify', data),
  paymentFailed: (data) => api.post('/billing/payments/failed', data),
  redeemLicense: (key) => api.post('/billing/license', { key }),
  setAutopay: (autopay) => api.put('/billing/autopay', { autopay }),

  // Public
  publicConfig: () => api.get('/public/config'),
  sendSignupCode: (email) => api.post('/auth/signup/send-code', { email }),
  verifySignupCode: (email, code) => api.post('/auth/signup/verify-code', { email, code }),
  signup: (data) => api.post('/auth/signup', data),

  // Platform
  plans: () => api.get('/platform/plans'),
  updatePlan: (id, data) => api.put(`/platform/plans/${id}`, data),
  companySubscription: (companyId) => api.get(`/platform/companies/${companyId}/subscription`),
  updateCompanySubscription: (companyId, data) => api.put(`/platform/companies/${companyId}/subscription`, data),
  issueInvoice: (companyId) => api.post(`/platform/companies/${companyId}/invoices`),
  markInvoicePaid: (invoiceId, data) => api.post(`/platform/invoices/${invoiceId}/mark-paid`, data),
  voidInvoice: (invoiceId) => api.post(`/platform/invoices/${invoiceId}/void`),
  revenueOverview: () => api.get('/platform/billing/overview'),
  allSubscriptions: (params) => api.get('/platform/billing/subscriptions', { params }),
  allInvoices: (params) => api.get('/platform/billing/invoices', { params }),
  allPayments: (params) => api.get('/platform/billing/payments', { params }),
  platformInvoicePdf: (id) => api.get(`/platform/invoices/${id}/pdf`, { responseType: 'blob' }),
  licenses: (params) => api.get('/platform/licenses', { params }),
  createLicenses: (data) => api.post('/platform/licenses', data),
  revokeLicense: (id) => api.post(`/platform/licenses/${id}/revoke`),
  platformBillingSettings: () => api.get('/platform/billing/settings'),
  updatePlatformBillingSettings: (data) => api.put('/platform/billing/settings', data),
}

/** Monthly / 6 months / yearly, as the API describes them (fallback for older APIs). */
export const DEFAULT_CYCLES = [
  { key: 'monthly', label: 'Monthly', months: 1, months_charged: 1, discount_percent: 0 },
  { key: 'half_yearly', label: '6 months', months: 6, months_charged: 5.5, discount_percent: 8 },
  { key: 'yearly', label: 'Yearly', months: 12, months_charged: 10, discount_percent: 17 },
]

export const CYCLE_NOUN = { monthly: 'month', half_yearly: '6 months', yearly: 'year' }

/** A plan's base price for a cycle, before GST: per period, effective per month, and the undiscounted monthly. */
export function planPrice(plan, cycle) {
  const base = Number(plan.base_price)
  const perPeriod = Math.round(base * cycle.months_charged * 100) / 100
  return { perPeriod, perMonth: perPeriod / cycle.months, listPerMonth: base }
}

/** Plan modules, as customers read them. */
export const FEATURE_LABELS = {
  core: 'Attendance, leave & employee records',
  self_service: 'Employee self-service app',
  geofence: 'Geo-fenced mobile attendance',
  biometric: 'Biometric device sync',
  shifts: 'Shift rosters & swaps',
  certificates: 'Letters & certificates',
  payroll: 'Payroll & payslips',
  statutory: 'PF, ESI, PT & TDS compliance',
  notifications: 'SMS & WhatsApp alerts',
  audit_log: 'Audit trail',
  multi_branch: 'Multiple branches',
  insights: 'AI insights',
}
