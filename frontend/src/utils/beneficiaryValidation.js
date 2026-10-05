export const incomeFields = {
  salary: ['monthly_salary', 'salary_certificate'],
  retirement: ['retirement_pension', 'pension_certificate_image'],
  citizen_account: ['citizen_account_amount', 'citizen_account_image'],
  social_security: ['social_security_amount', 'social_security_image'],
  family_support: ['family_support', null],
};

export function beneficiaryErrorStep(field) {
  if (field.includes('image') || field === 'salary_certificate') return 4;
  if (Object.values(incomeFields).some(([amount]) => amount === field) || field.startsWith('income_sources')) return 3;
  if (['family_status', 'family_members_count', 'housing_type', 'annual_rent_amount', 'monthly_rent_amount', 'wives_count', 'working_members_count', 'non_working_children_count'].includes(field) || field.startsWith('dependents')) return 2;
  return 1;
}

export function focusBeneficiaryError(errors) {
  const field = Object.keys(errors)[0];
  if (!field) return;
  requestAnimationFrame(() => {
    const element = document.getElementsByName(field)[0];
    element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    element?.focus();
  });
}

export function validateBeneficiaryStep(step, form, files = {}, existingDocs = {}) {
  const errors = {};
  const required = (field, label) => {
    if (String(form[field] ?? '').trim() === '') errors[field] = [`${label} مطلوب.`];
  };
  if (step === 1) {
    Object.entries({ full_name: 'الاسم الكامل', national_id: 'رقم الهوية أو الإقامة', phone: 'رقم الجوال', date_of_birth: 'تاريخ الميلاد', city: 'المدينة', district: 'الحي', street: 'العنوان' }).forEach(([field, label]) => required(field, label));
    if (form.beneficiary_type === 'resident') required('nationality', 'الجنسية');
    if (form.date_of_birth && new Date(form.date_of_birth) > new Date()) errors.date_of_birth = ['تاريخ الميلاد لا يمكن أن يكون في المستقبل.'];
  }
  if (step === 2) {
    required('family_status', 'الحالة الأسرية');
    required('housing_type', 'نوع السكن');
    if (!Number.isInteger(Number(form.family_members_count)) || Number(form.family_members_count) < 1) errors.family_members_count = ['عدد أفراد الأسرة يجب أن يكون عدداً صحيحاً لا يقل عن 1.'];
    if (form.housing_type === 'rent' && (String(form.annual_rent_amount ?? '').trim() === '' || Number(form.annual_rent_amount) < 0)) errors.annual_rent_amount = ['أدخل قيمة الإيجار السنوي الصحيحة.'];
  }
  if (step === 3) {
    for (const source of form.income_sources || []) {
      const field = incomeFields[source]?.[0];
      if (field && (String(form[field] ?? '').trim() === '' || !Number.isFinite(Number(form[field])) || Number(form[field]) < 0)) errors[field] = ['أدخل مبلغاً صحيحاً لمصدر الدخل المحدد.'];
    }
  }
  if (step === 4) {
    const requiredFiles = [form.beneficiary_type === 'resident' ? 'residence_id_image' : 'national_id_image', 'national_address_image', 'rental_contract_image'];
    for (const source of form.income_sources || []) {
      const proof = incomeFields[source]?.[1];
      if (proof) requiredFiles.push(proof);
    }
    for (const field of requiredFiles) {
      if (!files[field] && !existingDocs[field]) errors[field] = ['المستند الداعم مطلوب، يرجى إرفاقه.'];
    }
  }
  return errors;
}

export function appendBeneficiaryFields(fd, payload) {
  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      // Empty multipart arrays otherwise disappear, so explicitly clear selected sources.
      if (value.length === 0) fd.append(key, '[]');
      else value.forEach((item, index) => fd.append(`${key}[${index}]`, item));
    } else fd.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : value);
  }
}
