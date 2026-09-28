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

  // Public
  publicConfig: () => api.get('/public/config'),
  signup: (data) => api.post('/auth/signup', data),

  // Platform
  plans: () => api.get('/platform/plans'),
  updatePlan: (id, data) => api.put(`/platform/plans/${id}`, data),
  companySubscription: (companyId) => api.get(`/platform/companies/${companyId}/subscription`),
  updateCompanySubscription: (companyId, data) => api.put(`/platform/companies/${companyId}/subscription`, data),
  issueInvoice: (companyId) => api.post(`/platform/companies/${companyId}/invoices`),
  markInvoicePaid: (invoiceId, data) => api.post(`/platform/invoices/${invoiceId}/mark-paid`, data),
  voidInvoice: (invoiceId) => api.post(`/platform/invoices/${invoiceId}/void`),
}

/** Plan modules, as customers read them. */
export const FEATURE_LABELS = {
  core: 'Attendance, leave & employee records',
  self_service: 'Employee self-service app',
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
