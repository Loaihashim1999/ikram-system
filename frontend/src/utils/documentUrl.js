import api from '../api/axios';
/**
 * Helper to get the correct absolute URL for documents and PDF downloads.
 * Uses an explicitly configured API origin or the current host for same-origin deployments.
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

export async function fetchProtectedDocument(url) {
  const target = new URL(url, window.location.origin);
  const base = new URL(api.defaults.baseURL, window.location.origin);
  if (target.origin !== base.origin) throw new Error('مصدر التنزيل غير معتمد');

  const response = await api.get(target.href, {
    responseType: 'blob',
    headers: { Accept: 'application/json' },
  });
  if (response.data.type.startsWith('application/json')) {
    const payload = JSON.parse(await response.data.text());
    if (typeof payload.url !== 'string') throw new Error('رابط التنزيل غير متوفر');
    return { url: payload.url, revoke: false };
  }

  return { url: URL.createObjectURL(response.data), revoke: true };
}

export async function openProtectedDocument(url) {
  const tab = window.open('', '_blank');
  if (!tab) throw new Error('تعذر فتح نافذة الوثيقة');

  try {
    const document = await fetchProtectedDocument(url);
    tab.opener = null;
    tab.location.href = document.url;
    if (document.revoke) setTimeout(() => URL.revokeObjectURL(document.url), 60000);
  } catch (error) {
    tab.close();
    throw error;
  }
}

export function installDocumentDownloads() {
  const handler = (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const target = new URL(link.href, window.location.origin);
    if (/^\/api\/(?:beneficiaries\/[^/]+\/documents\/|daily-beneficiaries\/[^/]+\/documents\/[^/]+\/download|neighborhood-reps\/[^/]+\/documents\/)/.test(target.pathname)) {
      event.preventDefault();
      openProtectedDocument(target.href).catch(() => window.alert('تعذر فتح الوثيقة. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.'));
      return;
    }
    if (!/^\/api\/(documents\/|reports\/|neighborhood-reps\/.*export-excel)/.test(target.pathname)) return;
    event.preventDefault();
    downloadDocument(target.href).catch(() => window.alert('تعذر تنزيل الملف. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.'));
  };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}
