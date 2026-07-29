import api from './axios'

export const biometricApi = {
  listBranches: () => api.get('/biometric-configs'),
  getConfig: (branchId) => api.get(`/branches/${branchId}/biometric-config`),
  saveConfig: (branchId, data) => api.put(`/branches/${branchId}/biometric-config`, data),
  sync: (branchId, data) => api.post(`/branches/${branchId}/biometric-config/sync`, data),
  logs: (branchId) => api.get(`/branches/${branchId}/biometric-config/logs`),
}
