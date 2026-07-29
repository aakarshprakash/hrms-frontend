import api from './axios'

export const salaryApi = {
  listComponents: (params) => api.get('/salary-components', { params }),
  createComponent: (data) => api.post('/salary-components', data),
  updateComponent: (id, data) => api.put(`/salary-components/${id}`, data),
  deleteComponent: (id) => api.delete(`/salary-components/${id}`),

  listStructures: (params) => api.get('/salary-structures', { params }),
  createStructure: (data) => api.post('/salary-structures', data),
  updateStructure: (id, data) => api.put(`/salary-structures/${id}`, data),
  deleteStructure: (id) => api.delete(`/salary-structures/${id}`),

  listStatutory: (params) => api.get('/statutory-rules', { params }),
  createStatutory: (data) => api.post('/statutory-rules', data),
  updateStatutory: (id, data) => api.put(`/statutory-rules/${id}`, data),
  deleteStatutory: (id) => api.delete(`/statutory-rules/${id}`),
}

export const payrollApi = {
  listRuns: (params) => api.get('/payroll-runs', { params }),
  createRun: (data) => api.post('/payroll-runs', data),
  getRun: (id) => api.get(`/payroll-runs/${id}`),
  deleteRun: (id) => api.delete(`/payroll-runs/${id}`),
  triggerRun: (id) => api.post(`/payroll-runs/${id}/run`),
  runStatus: (id) => api.get(`/payroll-runs/${id}/status`),
  bankExport: (id) => api.get(`/payroll-runs/${id}/bank-export`, { responseType: 'blob' }),
  summary: (params) => api.get('/payroll/summary', { params }),

  listAdjustments: (runId) => api.get(`/payroll-runs/${runId}/adjustments`),
  createAdjustment: (runId, data) => api.post(`/payroll-runs/${runId}/adjustments`, data),
  deleteAdjustment: (id) => api.delete(`/payroll-adjustments/${id}`),

  listPayslips: (params) => api.get('/payslips', { params }),
  getPayslip: (id) => api.get(`/payslips/${id}`),
  // API auth is a Bearer token, not a cookie, so a plain <a href> to this
  // path can't authenticate — fetch it as a blob instead (see openPayslipPdf).
  fetchPayslipPdf: (id) => api.get(`/payslips/${id}/pdf`, { responseType: 'blob' }),
}

export async function openPayslipPdf(id, { download } = {}) {
  const res = await payrollApi.fetchPayslipPdf(id)
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
  if (download) {
    const a = document.createElement('a')
    a.href = url
    a.download = `payslip-${id}.pdf`
    a.click()
  } else {
    window.open(url, '_blank', 'noopener')
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
