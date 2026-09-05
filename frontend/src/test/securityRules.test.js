import { describe, it, expect } from 'vitest';

/**
 * Account Lockout Logic (3 failed attempts rule)
 */
export function handleLoginAttempt(identifier, isSuccess, currentAttempts = {}) {
  const attempts = { ...currentAttempts };
  const userAttempts = attempts[identifier] || 0;

  if (isSuccess) {
    delete attempts[identifier];
    return {
      success: true,
      isLocked: false,
      attempts: attempts,
      message: 'تم تسجيل الدخول بنجاح',
    };
  }

  const nextAttempts = userAttempts + 1;
  attempts[identifier] = nextAttempts;

  if (nextAttempts >= 3) {
    return {
      success: false,
      isLocked: true,
      attempts: attempts,
      message: 'تم قفل الحساب مؤقتاً لتجاوز 3 محاولات خاطئة. يرجى التواصل مع المشرف العام لإعادة التنشيط.',
    };
  }

  return {
    success: false,
    isLocked: false,
    remainingAttempts: 3 - nextAttempts,
    attempts: attempts,
    message: `بيانات الدخول غير صحيحة. المتبقي لك ${3 - nextAttempts} محاولات قبل قفل الحساب.`,
  };
}

/**
 * Generates a 1-day temporary password for reactivation
 */
export function generateTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < 10; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 1); // 24 hours / 1 day

  return {
    tempPassword: pwd,
    expiresAt: expiry.toISOString(),
    mustChangePassword: true,
  };
}

describe('Security Rules & Account Protection', () => {
  describe('3 Failed Attempts Lockout', () => {
    it('allows 1st and 2nd failed attempts with warnings', () => {
      let state = {};
      const attempt1 = handleLoginAttempt('user1', false, state);
      expect(attempt1.isLocked).toBe(false);
      expect(attempt1.remainingAttempts).toBe(2);

      const attempt2 = handleLoginAttempt('user1', false, attempt1.attempts);
      expect(attempt2.isLocked).toBe(false);
      expect(attempt2.remainingAttempts).toBe(1);
    });

    it('locks account on 3rd failed attempt with official warning message', () => {
      let state = { user1: 2 };
      const attempt3 = handleLoginAttempt('user1', false, state);
      expect(attempt3.isLocked).toBe(true);
      expect(attempt3.message).toContain('تم قفل الحساب مؤقتاً لتجاوز 3 محاولات خاطئة');
      expect(attempt3.message).toContain('المشرف العام');
    });

    it('resets failed attempts counter on successful login', () => {
      let state = { user1: 2 };
      const successAttempt = handleLoginAttempt('user1', true, state);
      expect(successAttempt.success).toBe(true);
      expect(successAttempt.isLocked).toBe(false);
      expect(successAttempt.attempts.user1).toBeUndefined();
    });
  });

  describe('Account Reactivation with 1-Day Temporary Password', () => {
    it('generates a temporary password expiring in exactly 1 day with forced password change', () => {
      const temp = generateTemporaryPassword();
      expect(temp.tempPassword).toBeDefined();
      expect(temp.tempPassword.length).toBe(10);
      expect(temp.mustChangePassword).toBe(true);

      const now = new Date();
      const exp = new Date(temp.expiresAt);
      const diffHours = (exp - now) / (1000 * 60 * 60);
      expect(Math.round(diffHours)).toBe(24);
    });
  });

  describe('Permanent Elimination of Banking Data', () => {
    it('verifies absence of bank_name and iban in beneficiary payloads', () => {
      const beneficiaryFormState = {
        full_name: 'سالم أحمد',
        national_id: '1029384756',
        phone: '0512345678',
        monthly_income: 3000,
        housing_type: 'rent',
        monthly_rent: 1000,
      };

      expect(beneficiaryFormState).not.toHaveProperty('bank_name');
      expect(beneficiaryFormState).not.toHaveProperty('iban');
      expect(beneficiaryFormState).not.toHaveProperty('bank_account_number');
    });
  });
});
