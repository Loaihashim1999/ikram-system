import api from '../api/axios';
/**
 * Helper to get the correct absolute URL for documents and PDF downloads.
 * Handles production Render URL, local dev server, and proxying.
 */
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/?$/, '');
  }
  return new URL(api.defaults.baseURL, window.location.origin).origin;
};

export const getDocumentPdfUrl = (path) => {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullApiPath = cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`;
  return `${base}${fullApiPath}`;
};

export async function downloadDocument(url, filename) {
  const target = new URL(url, window.location.origin);
  const base = new URL(api.defaults.baseURL, window.location.origin);
  if (target.origin !== base.origin) throw new Error('مصدر التنزيل غير معتمد');
  const response = await api.get(target.href, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename || (target.pathname.endsWith('pdf') ? 'ikram-report.pdf' : 'ikram-data.xlsx');
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}
export function installDocumentDownloads() {
  const handler = (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const target = new URL(link.href, window.location.origin);
    if (!/^\/api\/(documents\/|reports\/|neighborhood-reps\/.*export-excel)/.test(target.pathname)) return;
    event.preventDefault();
    downloadDocument(target.href).catch(() => window.alert('تعذر تنزيل الملف. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.'));
  };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}
