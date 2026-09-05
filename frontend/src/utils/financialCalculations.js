/**
 * Helper utility for financial calculations and automatic classification.
 * Follows Ikram Association business rules:
 * - If tenant (housing_type === 'rent'), subtract monthly rent from total income.
 *   (If annual_rent_amount is provided, monthly rent = annual / 12, or use monthly_rent if direct).
 * - Total income = salary + social_security + citizen_account + retirement + family_support
 * - Eligible/Calculated Income = max(0, Total income - rentDeduction)
 *
 * Classification rules:
 * - Citizens:
 *   - If calculatedIncome <= firstClassMax (default: 3000) => First Degree (درجة أولى)
 *   - Otherwise => Second Degree (درجة ثانية)
 *   - If has_special_needs => Special Needs priority
 *   - If age >= elderlyMinAge (default: 60) => Elderly priority
 * - Residents:
 *   - Always Second Degree!
 *   - Subdivided based on income:
 *     - If calculatedIncome <= residentSubThreshold (default: 3000) => Second Degree A (درجة ثانية - أ)
 *     - Otherwise => Second Degree B (درجة ثانية - ب)
 */

export function calculateIncomeAndClassification({
  beneficiaryType = 'citizen',
  monthlySalary = 0,
  socialSecurityAmount = 0,
  citizenAccountAmount = 0,
  retirementPension = 0,
  familySupport = 0,
  housingType = 'rent', // 'rent' | 'own' | 'charitable_housing'
  annualRentAmount = 0,
  monthlyRentAmount = 0,
  hasSpecialNeeds = false,
  dateOfBirth = null,
  // Configurable thresholds passed from settings
  thresholds = {
    firstClassMaxIncome: 3000,
    secondClassMaxIncome: 6000,
    residentDegreeThreshold: 3000,
    elderlyMinAge: 60,
  },
}) {
  const salary = parseFloat(monthlySalary) || 0;
  const social = parseFloat(socialSecurityAmount) || 0;
  const citizen = parseFloat(citizenAccountAmount) || 0;
  const pension = parseFloat(retirementPension) || 0;
  const support = parseFloat(familySupport) || 0;

  const totalGrossIncome = salary + social + citizen + pension + support;

  // Determine rent deduction
  let monthlyRent = 0;
  if (housingType === 'rent') {
    if (parseFloat(monthlyRentAmount) > 0) {
      monthlyRent = parseFloat(monthlyRentAmount);
    } else if (parseFloat(annualRentAmount) > 0) {
      monthlyRent = Math.round((parseFloat(annualRentAmount) / 12) * 100) / 100;
    }
  }

  const eligibleIncome = Math.max(0, totalGrossIncome - monthlyRent);

  // Age calculation
  let age = null;
  if (dateOfBirth) {
    const birthYear = new Date(dateOfBirth).getFullYear();
    const currentYear = new Date().getFullYear();
    if (!isNaN(birthYear)) {
      age = currentYear - birthYear;
    }
  }

  const firstLimit = parseFloat(thresholds.firstClassMaxIncome) || 3000;
  const secondLimit = parseFloat(thresholds.secondClassMaxIncome) || 6000;
  const residentLimit = parseFloat(thresholds.residentDegreeThreshold) || 3000;
  const elderlyAge = parseFloat(thresholds.elderlyMinAge) || 60;

  let category = 'second_class';
  let categoryLabel = 'الدرجة الثانية';
  let subCategory = null;
  let reason = '';

  if (beneficiaryType === 'resident') {
    category = 'second_class';
    if (eligibleIncome <= residentLimit) {
      subCategory = 'second_class_a';
      categoryLabel = 'الدرجة الثانية (أ) - المقيم الأشد حاجة';
      reason = `مقيم مع دخل محتسب (${eligibleIncome} ريال) أقل أو يساوي حد الفئة أ (${residentLimit} ريال)`;
    } else {
      subCategory = 'second_class_b';
      categoryLabel = 'الدرجة الثانية (ب) - المقيم دخل متوسط';
      reason = `مقيم مع دخل محتسب (${eligibleIncome} ريال) أعلى من حد الفئة أ (${residentLimit} ريال)`;
    }
  } else {
    // Citizen
    if (eligibleIncome <= firstLimit) {
      category = 'first_class';
      categoryLabel = 'الدرجة الأولى (الأشد حاجة)';
      reason = `مواطن بدخل محتسب (${eligibleIncome} ريال) ضمن سقف الفئة الأولى (${firstLimit} ريال)`;
    } else {
      category = 'second_class';
      categoryLabel = 'الدرجة الثانية (الدخل المتوسط)';
      reason = `مواطن بدخل محتسب (${eligibleIncome} ريال) أعلى من سقف الفئة الأولى (${firstLimit} ريال)`;
    }
  }

  // Priority flags
  let priority = category;
  if (hasSpecialNeeds) {
    priority = 'special_needs';
  } else if (age !== null && age >= elderlyAge) {
    priority = 'elderly';
  }

  // Formula description
  const incomeParts = [];
  if (salary > 0) incomeParts.push(`راتب: ${salary}`);
  if (social > 0) incomeParts.push(`ضمان: ${social}`);
  if (citizen > 0) incomeParts.push(`حساب المواطن: ${citizen}`);
  if (pension > 0) incomeParts.push(`تقاعد: ${pension}`);
  if (support > 0) incomeParts.push(`دعم أقارب: ${support}`);

  const formulaText = housingType === 'rent' && monthlyRent > 0
    ? `(${incomeParts.length > 0 ? incomeParts.join(' + ') : 'الدخل 0'} = ${totalGrossIncome} ريال) - اقتطاع إيجار شهري (${monthlyRent} ريال) = الدخل المحتسب: ${eligibleIncome} ريال`
    : `(${incomeParts.length > 0 ? incomeParts.join(' + ') : 'الدخل 0'} = ${totalGrossIncome} ريال) [لا يوجد اقتطاع إيجار]`;

  return {
    totalGrossIncome,
    monthlyRent,
    eligibleIncome,
    category,
    subCategory,
    categoryLabel,
    priority,
    age,
    reason,
    formulaText,
  };
}

/**
 * Convenience helper for rent deduction calculation and formula
 */
export function calculateEligibleIncome({
  monthly_income = 0,
  housing_type = 'rent',
  monthly_rent = 0,
}) {
  const grossIncome = parseFloat(monthly_income) || 0;
  const isRent = housing_type === 'rent';
  const rent = isRent ? Math.max(0, parseFloat(monthly_rent) || 0) : 0;
  const eligibleIncome = Math.max(0, grossIncome - rent);
  const deductedRent = isRent && rent > 0;

  return {
    grossIncome,
    monthlyRent: rent,
    eligibleIncome,
    deductedRent,
    formulaText: deductedRent
      ? `${grossIncome} - ${rent} = ${eligibleIncome}`
      : `${grossIncome} (لا يوجد اقتطاع)`,
  };
}

/**
 * Convenience helper for classifying beneficiary
 */
export function classifyBeneficiary({
  eligibleIncome = 0,
  nationalityType = 'citizen',
  firstLimit = 4000,
  residentThreshold = 2500,
}) {
  const income = parseFloat(eligibleIncome) || 0;

  if (nationalityType === 'resident') {
    const isA = income <= residentThreshold;
    return {
      priority: 'second_class',
      category: 'second_class',
      subCategory: isA ? 'A' : 'B',
      categoryLabel: isA ? 'درجة ثانية - الفئة (أ)' : 'درجة ثانية - الفئة (ب)',
    };
  }

  // Citizen
  if (income <= firstLimit) {
    return {
      priority: 'first_class',
      category: 'first_class',
      subCategory: null,
      categoryLabel: 'درجة أولى (الأشد حاجة)',
    };
  }

  return {
    priority: 'second_class',
    category: 'second_class',
    subCategory: null,
    categoryLabel: 'درجة ثانية (متوسط الدخل)',
  };
}

/**
 * End-to-end financial calculation wrapper
 */
export function calculateBeneficiaryFinancials({
  monthly_income = 0,
  housing_type = 'rent',
  monthly_rent = 0,
  nationality_type = 'citizen',
  firstLimit = 4000,
  residentThreshold = 2500,
}) {
  const incomeDetails = calculateEligibleIncome({
    monthly_income,
    housing_type,
    monthly_rent,
  });

  const classification = classifyBeneficiary({
    eligibleIncome: incomeDetails.eligibleIncome,
    nationalityType: nationality_type,
    firstLimit,
    residentThreshold,
  });

  return {
    ...incomeDetails,
    ...classification,
    formulaText: `الدخل الإجمالي (${incomeDetails.grossIncome}) - الإيجار (${incomeDetails.monthlyRent}) = الدخل المحتسب (${incomeDetails.eligibleIncome} ريال)`,
  };
}

