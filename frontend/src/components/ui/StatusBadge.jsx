import React from 'react';

/**
 * Unified StatusBadge component conforming to Ikram Association design tokens.
 * Supported status keys:
 * - Items: 'valid', 'near_expiry', 'expired', 'distributed'
 * - Codes / QR: 'active', 'used', 'expired', 'revoked'
 * - Accounts / Beneficiaries: 'active', 'suspended', 'locked', 'under_review'
 */
export default function StatusBadge({ status, label, className = '' }) {
  const configs = {
    // Warehouse item statuses
    valid: { bg: 'bg-[#E6F4EC]', text: 'text-[#2E7D32]', border: 'border-[#A5D6A7]', defaultLabel: 'صالح' },
    near_expiry: { bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FCD34D]', defaultLabel: 'قارب على الانتهاء' },
    expired: { bg: 'bg-[#FEE2E2]', text: 'text-[#B91C1C]', border: 'border-[#FCA5A5]', defaultLabel: 'منتهي الصلاحية' },
    distributed: { bg: 'bg-[#E0F2FE]', text: 'text-[#0369A1]', border: 'border-[#7DD3FC]', defaultLabel: 'تم توزيعه' },

    // QR & Code states
    active: { bg: 'bg-[#E6F4EC]', text: 'text-[#2E7D32]', border: 'border-[#A5D6A7]', defaultLabel: 'نشط' },
    used: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', defaultLabel: 'مستخدم' },
    revoked: { bg: 'bg-[#FEE2E2]', text: 'text-[#B91C1C]', border: 'border-[#FCA5A5]', defaultLabel: 'ملغي' },

    // Account states
    suspended: { bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FCD34D]', defaultLabel: 'موقوف' },
    locked: { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-300', defaultLabel: 'مقفل (3 محاولات)' },
    under_review: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', defaultLabel: 'قيد المراجعة' },

    // Stock levels
    in_stock: { bg: 'bg-[#E6F4EC]', text: 'text-[#2E7D32]', border: 'border-[#A5D6A7]', defaultLabel: 'متوفر' },
    low_stock: { bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FCD34D]', defaultLabel: 'مخزون منخفض' },
    out_of_stock: { bg: 'bg-[#FEE2E2]', text: 'text-[#B91C1C]', border: 'border-[#FCA5A5]', defaultLabel: 'نافذ' },
  };

  const key = String(status || '').toLowerCase().replace(/[-\s]/g, '_');
  const conf = configs[key] || {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    defaultLabel: label || status || 'غير محدد',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${conf.bg} ${conf.text} ${conf.border} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 ml-1 inline-block" />
      {label || conf.defaultLabel}
    </span>
  );
}
