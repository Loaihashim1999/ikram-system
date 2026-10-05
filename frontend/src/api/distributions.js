import api from './axios';

const distributionApi = {
  list:         (params = {}) => api.get('/distributions', { params }),
  get:          (id)          => api.get(`/distributions/${id}`),
  create:       (data)        => api.post('/distributions', data),
  markReceived: (id)          => api.put(`/distributions/${id}/received`),
};

export default distributionApi;
