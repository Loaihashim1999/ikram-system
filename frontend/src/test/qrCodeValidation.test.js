import { describe, it, expect } from 'vitest';

/**
 * Validates a scanned QR code based on single-use business rules
 */
export function validateScannedCode(codeData, usedRegistry = {}) {
  const codeKey = codeData.barcode_code || codeData.code;
  if (!codeKey) {
    return {
      isValid: false,
      status: 'revoked',
      canDeliver: false,
      reason: 'رمز غير صالح أو مفقود',
    };
  }

  // 1. Check if recorded in single-use registry
  if (usedRegistry[codeKey]) {
    return {
      isValid: false,
      status: 'used',
      canDeliver: false,
      previousDeliveryDate: usedRegistry[codeKey].delivered_at,
      reason: '⚠️ تم رفض العملية: رمز الاستلام مستخدم مسبقاً (Single-Use Only)',
    };
  }

  // 2. Check backend delivered status
  const backendStatus = String(codeData.status || '').toLowerCase();
  if (backendStatus === 'delivered' || backendStatus === 'used') {
    return {
      isValid: false,
      status: 'used',
      canDeliver: false,
      previousDeliveryDate: codeData.delivered_at || codeData.updated_at,
      reason: '⚠️ تم رفض العملية: رمز الاستلام مستخدم مسبقاً (Single-Use Only)',
    };
  }

  // 3. Check revoked / cancelled status
  if (backendStatus === 'revoked' || backendStatus === 'cancelled') {
    return {
      isValid: false,
      status: 'revoked',
      canDeliver: false,
      reason: 'تم إلغاء هذا الرمز رسمياً من قبل إدارة الجمعية.',
    };
  }

  // 4. Check expiration date
  if (backendStatus === 'expired' || (codeData.expires_at && new Date(codeData.expires_at) < new Date())) {
    return {
      isValid: false,
      status: 'expired',
      canDeliver: false,
      reason: 'لقد تجاوز هذا الرمز التاريخ المحدد للصرف وهو منتهي الصلاحية.',
    };
  }

  // 5. Active & valid for single use
  return {
    isValid: true,
    status: 'active',
    canDeliver: true,
    reason: 'رمز صالح ومؤهل للصرف لمرة واحدة.',
  };
}

describe('Single-Use QR Code Validation & Security Rules', () => {
  it('approves active valid QR code for single-use delivery', () => {
    const code = {
      barcode_code: 'BEN-1001-XYZ',
      status: 'pending',
      beneficiary: { full_name: 'أحمد سعيد' },
    };

    const validation = validateScannedCode(code);
    expect(validation.isValid).toBe(true);
    expect(validation.status).toBe('active');
    expect(validation.canDeliver).toBe(true);
  });

  it('strictly rejects previously delivered codes and provides previous delivery timestamp', () => {
    const deliveredCode = {
      barcode_code: 'BEN-1002-ABC',
      status: 'delivered',
      delivered_at: '2026-09-05T14:30:00Z',
    };

    const validation = validateScannedCode(deliveredCode);
    expect(validation.isValid).toBe(false);
    expect(validation.status).toBe('used');
    expect(validation.canDeliver).toBe(false);
    expect(validation.previousDeliveryDate).toBe('2026-09-05T14:30:00Z');
    expect(validation.reason).toContain('مستخدم مسبقاً');
  });

  it('rejects codes recorded in the single-use registry even if backend payload status was pending', () => {
    const code = {
      barcode_code: 'BEN-1003-REG',
      status: 'pending',
    };

    const registry = {
      'BEN-1003-REG': {
        delivered_at: '2026-09-06T10:00:00Z',
        recipient: 'عبدالله محمد',
      },
    };

    const validation = validateScannedCode(code, registry);
    expect(validation.isValid).toBe(false);
    expect(validation.status).toBe('used');
    expect(validation.canDeliver).toBe(false);
    expect(validation.previousDeliveryDate).toBe('2026-09-06T10:00:00Z');
  });

  it('rejects expired QR codes', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);

    const expiredCode = {
      barcode_code: 'BEN-1004-EXP',
      status: 'pending',
      expires_at: pastDate.toISOString(),
    };

    const validation = validateScannedCode(expiredCode);
    expect(validation.isValid).toBe(false);
    expect(validation.status).toBe('expired');
    expect(validation.canDeliver).toBe(false);
  });

  it('rejects revoked QR codes', () => {
    const revokedCode = {
      barcode_code: 'BEN-1005-REV',
      status: 'revoked',
    };

    const validation = validateScannedCode(revokedCode);
    expect(validation.isValid).toBe(false);
    expect(validation.status).toBe('revoked');
    expect(validation.canDeliver).toBe(false);
  });
});
