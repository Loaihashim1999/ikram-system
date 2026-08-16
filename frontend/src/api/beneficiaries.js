import api from './axios';

// ─── Default export (object) ─────────────────────────────────────────────────
const beneficiaryApi = {
  list:   (params = {}) => api.get('/beneficiaries', { params }),
  get:    (id)          => api.get(`/beneficiaries/${id}`),
  create: (data)        => api.post('/beneficiaries', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data)    => api.put(`/beneficiaries/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id)          => api.delete(`/beneficiaries/${id}`),

  // التحقق من رقم الهوية
  checkNationalId: (nationalId) =>
    api.get(`/beneficiaries/check-national-id/${nationalId}`),

  // استخراج بيانات الهوية (OCR)
  extractOcrData: (formData) =>
    api.post('/beneficiaries/extract-ocr-data', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // استيراد Excel
  importExcel: (formData) =>
    api.post('/beneficiaries/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // المعالون
  addDependent:    (beneficiaryId, data) => api.post(`/beneficiaries/${beneficiaryId}/dependents`, data),
  removeDependent: (beneficiaryId, depId) => api.delete(`/beneficiaries/${beneficiaryId}/dependents/${depId}`),
};

export default beneficiaryApi;

// ─── Named exports (for backward compat with other pages) ────────────────────
export const getBeneficiaries  = (params = {}) => beneficiaryApi.list(params);
export const getBeneficiary    = (id)           => beneficiaryApi.get(id);
export const addBeneficiary    = (data)         => beneficiaryApi.create(data);
export const updateBeneficiary = (id, data)     => beneficiaryApi.update(id, data);
export const deleteBeneficiary = (id)           => beneficiaryApi.remove(id);
export const checkNationalId   = (id)           => beneficiaryApi.checkNationalId(id);
export const extractOcrData    = (fd)           => beneficiaryApi.extractOcrData(fd);
export const getCategories     = ()             => api.get('/categories');
