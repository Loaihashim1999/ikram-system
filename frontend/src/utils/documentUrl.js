/**
 * Helper to get the correct absolute URL for documents and PDF downloads.
 * Handles production Render URL, local dev server, and proxying.
 */
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/?$/, '');
  }
  return 'https://ikram-system.onrender.com';
};

export const getDocumentPdfUrl = (path) => {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullApiPath = cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`;
  return `${base}${fullApiPath}`;
};
