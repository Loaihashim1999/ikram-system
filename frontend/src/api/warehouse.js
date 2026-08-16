import api from './axios';

export const getInventory = () => api.get('/inventory');
export const addInventoryItem = (data) => api.post('/inventory', data);
export const updateInventoryItem = (id, data) => api.put(`/inventory/${id}`, data);
export const deleteInventoryItem = (id) => api.delete(`/inventory/${id}`);
export const adjustStock = (id, data) => api.post(`/inventory/${id}/adjust`, data);