import api from "./axios";

const staffApi = {
  list:   () => api.get("/staff"),
  get:    (id) => api.get(`/staff/${id}`),
  create: (data) => api.post("/staff", data),
  update: (id, data) => api.put(`/staff/${id}`, data),
  remove: (id) => api.delete(`/staff/${id}`),
  importExcel: (formData) =>
    api.post("/staff/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default staffApi;