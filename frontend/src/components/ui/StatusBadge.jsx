const tones = {
  success: 'ikram-badge-success',
  warning: 'ikram-badge-warning',
  danger: 'ikram-badge-danger',
  info: 'ikram-badge-info',
  neutral: 'ikram-badge-neutral',
};

const statusTone = {
  valid: 'success', active: 'success', in_stock: 'success', delivered: 'success', approved: 'success',
  near_expiry: 'warning', suspended: 'warning', low_stock: 'warning', pending: 'warning',
  expired: 'danger', revoked: 'danger', locked: 'danger', out_of_stock: 'danger', rejected: 'danger',
  distributed: 'info', under_review: 'info',
  used: 'neutral',
};

const defaultLabels = {
  valid: 'صالح', near_expiry: 'قارب على الانتهاء', expired: 'منتهي الصلاحية', distributed: 'تم توزيعه',
  active: 'نشط', used: 'مستخدم', revoked: 'ملغي', suspended: 'موقوف', locked: 'مقفل',
  under_review: 'قيد المراجعة', in_stock: 'متوفر', low_stock: 'مخزون منخفض', out_of_stock: 'نافذ',
};

export default function StatusBadge({ status, label, tone, className = '' }) {
  const key = String(status || '').toLowerCase().replace(/[-\s]/g, '_');
  const resolved = tone || statusTone[key] || 'neutral';

  return (
    <span className={`ikram-badge ${tones[resolved] || tones.neutral} ${className}`}>
      {label || defaultLabels[key] || status || 'غير محدد'}
    </span>
  );
}
