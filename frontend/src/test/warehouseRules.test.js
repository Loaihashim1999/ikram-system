import { describe, it, expect } from 'vitest';

/**
 * Warehouse item status & expiration logic
 */
export function calculateItemExpiration(item, thresholdDays = 10) {
  if (item.status === 'distributed' || (item.current_quantity === 0 && item.stock_quantity === 0)) {
    return {
      status: 'distributed',
      daysRemaining: null,
      isExpired: false,
      isNearExpiry: false,
      shouldNotify: false,
    };
  }

  const expDateStr = item.expiry_date || item.expiration_date;
  if (!expDateStr) {
    return {
      status: 'valid',
      daysRemaining: null,
      isExpired: false,
      isNearExpiry: false,
      shouldNotify: false,
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expDateStr);
  exp.setHours(0, 0, 0, 0);

  const diffTime = exp.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      status: 'expired',
      daysRemaining,
      isExpired: true,
      isNearExpiry: false,
      shouldNotify: true,
    };
  }

  if (daysRemaining <= thresholdDays) {
    return {
      status: 'near_expiry',
      daysRemaining,
      isExpired: false,
      isNearExpiry: true,
      shouldNotify: true,
    };
  }

  return {
    status: 'valid',
    daysRemaining,
    isExpired: false,
    isNearExpiry: false,
    shouldNotify: false,
  };
}

describe('Warehouse Inventory Expiration & Notification Rules', () => {
  it('identifies expired items when expiration date is in the past', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    const result = calculateItemExpiration({
      id: 1,
      name: 'حليب مجفف',
      expiry_date: pastDate.toISOString().slice(0, 10),
      current_quantity: 50,
    });

    expect(result.status).toBe('expired');
    expect(result.isExpired).toBe(true);
    expect(result.daysRemaining).toBeLessThan(0);
    expect(result.shouldNotify).toBe(true);
  });

  it('identifies near-expiry items when days remaining are within configurable threshold (default 10 days)', () => {
    const nearDate = new Date();
    nearDate.setDate(nearDate.getDate() + 5);
    const yyyy = nearDate.getFullYear();
    const mm = String(nearDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nearDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const result = calculateItemExpiration(
      {
        id: 2,
        name: 'أرز فاخر',
        expiry_date: dateStr,
        current_quantity: 30,
      },
      10
    );

    expect(result.status).toBe('near_expiry');
    expect(result.isNearExpiry).toBe(true);
    expect(result.daysRemaining).toBe(5);
    expect(result.shouldNotify).toBe(true);
  });


  it('identifies valid items when expiration date is beyond threshold', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45);

    const result = calculateItemExpiration(
      {
        id: 3,
        name: 'زيت نباتي',
        expiry_date: futureDate.toISOString().slice(0, 10),
        current_quantity: 100,
      },
      10
    );

    expect(result.status).toBe('valid');
    expect(result.isExpired).toBe(false);
    expect(result.isNearExpiry).toBe(false);
    expect(result.shouldNotify).toBe(false);
  });

  it('respects custom threshold setting (e.g. 15 days)', () => {
    const customDate = new Date();
    customDate.setDate(customDate.getDate() + 12);

    const defaultResult = calculateItemExpiration({
      id: 4,
      name: 'تمر فاخر',
      expiry_date: customDate.toISOString().slice(0, 10),
      current_quantity: 20,
    }, 10);
    expect(defaultResult.status).toBe('valid'); // 12 > 10

    const customResult = calculateItemExpiration({
      id: 4,
      name: 'تمر فاخر',
      expiry_date: customDate.toISOString().slice(0, 10),
      current_quantity: 20,
    }, 15);
    expect(customResult.status).toBe('near_expiry'); // 12 <= 15
    expect(customResult.shouldNotify).toBe(true);
  });

  it('marks distributed items when stock is zero', () => {
    const result = calculateItemExpiration({
      id: 5,
      name: 'معكرونة',
      expiry_date: '2026-12-31',
      current_quantity: 0,
      stock_quantity: 0,
    });
    expect(result.status).toBe('distributed');
    expect(result.shouldNotify).toBe(false);
  });
});
