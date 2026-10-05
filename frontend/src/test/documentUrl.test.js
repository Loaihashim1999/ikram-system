import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../api/axios';
import {
  downloadDocument,
  fetchProtectedDocument,
  getApiBaseUrl,
  getDocumentPdfUrl,
} from '../utils/documentUrl';

vi.mock('../api/axios', () => ({
  default: {
    defaults: { baseURL: '/api' },
    get: vi.fn(),
  },
}));

describe('document URLs', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_API_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the current origin for same-origin API and document URLs by default', () => {
    expect(getApiBaseUrl()).toBe(window.location.origin);
    expect(new URL(getDocumentPdfUrl('/reports/example'), window.location.origin).origin)
      .toBe(window.location.origin);
  });

  it('rejects a remote document URL before issuing a request', async () => {
    await expect(downloadDocument('https://untrusted.example/document.pdf'))
      .rejects.toThrow('مصدر التنزيل غير معتمد');

    expect(api.get).not.toHaveBeenCalled();
  });

  it('resolves a protected document through the authenticated API response', async () => {
    api.get.mockResolvedValue({
      data: {
        type: 'application/json',
        text: async () => JSON.stringify({ url: 'https://private.blob.example/doc?sig=temporary' }),
      },
    });

    await expect(fetchProtectedDocument('/api/beneficiaries/beneficiary-id/documents/national_id_image_url'))
      .resolves.toEqual({ url: 'https://private.blob.example/doc?sig=temporary', revoke: false });

    expect(api.get).toHaveBeenCalledWith(
      `${window.location.origin}/api/beneficiaries/beneficiary-id/documents/national_id_image_url`,
      expect.objectContaining({
        responseType: 'blob',
        headers: { Accept: 'application/json' },
      }),
    );
  });
});
