import api from './axios';

// ─── المستفيدون اليوميون ─────────────────────────────────────────────────────
export const getDailyBeneficiaries = (params) => api.get('/daily-beneficiaries', { params });
export const getDailyBeneficiary = (id) => api.get(`/daily-beneficiaries/${id}`);
export const createDailyBeneficiary = (data) => api.post('/daily-beneficiaries', data);
export const updateDailyBeneficiary = (id, data) => api.put(`/daily-beneficiaries/${id}`, data);
export const deleteDailyBeneficiary = (id) => api.delete(`/daily-beneficiaries/${id}`);
export const checkNationalId = (nationalId, ignoreId = null) =>
  api.get(`/daily-beneficiaries/check-national-id/${nationalId}`, { params: { ignore_id: ignoreId } });
export const getReceivingHistory = (id, params) => api.get(`/daily-beneficiaries/${id}/receiving-history`, { params });

// الوثائق
export const uploadDocument = (id, formData) =>
  api.post(`/daily-beneficiaries/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const deleteDocument = (docId) => api.delete(`/daily-beneficiaries/documents/${docId}`);

// ─── مستودع المستفيدين اليوميين ───────────────────────────────────────────────
export const getDailyInventory = (params) => api.get('/daily-inventory', { params });
export const getDailyInventoryItem = (id) => api.get(`/daily-inventory/${id}`);
export const createDailyInventoryItem = (data) => api.post('/daily-inventory', data);
export const updateDailyInventoryItem = (id, data) => api.put(`/daily-inventory/${id}`, data);
export const deleteDailyInventoryItem = (id) => api.delete(`/daily-inventory/${id}`);
export const adjustDailyInventoryStock = (id, data) => api.post(`/daily-inventory/${id}/adjust`, data);
export const getDailyInventoryMovements = (params) => api.get('/daily-inventory/movements', { params });

// ─── تسليم واستلام المستفيدين اليوميين ────────────────────────────────────────
export const getDailyReceivingTransactions = (params) => api.get('/daily-receiving', { params });
export const createDailyReceivingTransaction = (data) => api.post('/daily-receiving', data);
export const getDailyReceivingTransaction = (id) => api.get(`/daily-receiving/${id}`);

// ─── التحليلات الشاملة والحوكمة ──────────────────────────────────────────────
export const getAnalytics = (params) => api.get('/analytics', { params });
