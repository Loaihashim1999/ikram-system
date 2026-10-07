export function canonicalSaudiPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
  return digits;
}

export function displaySaudiPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^9665\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^05\d{8}$/.test(digits)) return digits;
  return String(value || '');
}
