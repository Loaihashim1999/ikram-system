import { describe, it, expect } from 'vitest';
import {
  calculateEligibleIncome,
  classifyBeneficiary,
  calculateBeneficiaryFinancials,
} from '../utils/financialCalculations';

describe('Financial Calculations and Beneficiary Classification Rules', () => {
  describe('Rent Deduction Rule (eligible_income = total_income - rent)', () => {
    it('deducts rent for tenants correctly', () => {
      const result = calculateEligibleIncome({
        monthly_income: 5000,
        housing_type: 'rent',
        monthly_rent: 1500,
      });

      expect(result.grossIncome).toBe(5000);
      expect(result.monthlyRent).toBe(1500);
      expect(result.eligibleIncome).toBe(3500);
      expect(result.deductedRent).toBe(true);
      expect(result.formulaText).toContain('5000 - 1500 = 3500');
    });

    it('does not deduct rent for homeowners or charitable housing', () => {
      const ownedResult = calculateEligibleIncome({
        monthly_income: 4000,
        housing_type: 'owned',
        monthly_rent: 1000,
      });
      expect(ownedResult.monthlyRent).toBe(0);
      expect(ownedResult.eligibleIncome).toBe(4000);
      expect(ownedResult.deductedRent).toBe(false);

      const charitableResult = calculateEligibleIncome({
        monthly_income: 3000,
        housing_type: 'charitable',
        monthly_rent: 1200,
      });
      expect(charitableResult.monthlyRent).toBe(0);
      expect(charitableResult.eligibleIncome).toBe(3000);
      expect(charitableResult.deductedRent).toBe(false);
    });

    it('ensures eligible income never falls below zero', () => {
      const result = calculateEligibleIncome({
        monthly_income: 1000,
        housing_type: 'rent',
        monthly_rent: 2000,
      });
      expect(result.eligibleIncome).toBe(0);
    });
  });

  describe('Citizen Automatic Classification', () => {
    it('classifies citizens with eligible income <= 4000 as First Degree (درجة أولى)', () => {
      const res1 = classifyBeneficiary({
        eligibleIncome: 3500,
        nationalityType: 'citizen',
      });
      expect(res1.priority).toBe('first_class');
      expect(res1.categoryLabel).toBe('درجة أولى (الأشد حاجة)');

      const resEdge = classifyBeneficiary({
        eligibleIncome: 4000,
        nationalityType: 'citizen',
      });
      expect(resEdge.priority).toBe('first_class');
      expect(resEdge.categoryLabel).toBe('درجة أولى (الأشد حاجة)');
    });

    it('classifies citizens with eligible income > 4000 as Second Degree (درجة ثانية)', () => {
      const res = classifyBeneficiary({
        eligibleIncome: 4500,
        nationalityType: 'citizen',
      });
      expect(res.priority).toBe('second_class');
      expect(res.categoryLabel).toBe('درجة ثانية (متوسط الدخل)');
    });
  });

  describe('Resident Automatic Classification', () => {
    it('always classifies residents as Second Degree, subclassified into A or B', () => {
      // Category A: eligible income <= 2500
      const resA = classifyBeneficiary({
        eligibleIncome: 2000,
        nationalityType: 'resident',
      });
      expect(resA.priority).toBe('second_class');
      expect(resA.categoryLabel).toBe('درجة ثانية - الفئة (أ)');
      expect(resA.subCategory).toBe('A');

      // Category B: eligible income > 2500
      const resB = classifyBeneficiary({
        eligibleIncome: 3000,
        nationalityType: 'resident',
      });
      expect(resB.priority).toBe('second_class');
      expect(resB.categoryLabel).toBe('درجة ثانية - الفئة (ب)');
      expect(resB.subCategory).toBe('B');
    });

    it('respects configurable resident threshold', () => {
      const res = classifyBeneficiary({
        eligibleIncome: 2800,
        nationalityType: 'resident',
        residentThreshold: 3000,
      });
      expect(res.subCategory).toBe('A');
      expect(res.categoryLabel).toBe('درجة ثانية - الفئة (أ)');
    });
  });

  describe('End-to-End Beneficiary Financials & Formula Display', () => {
    it('produces full financial summary with rent deduction and classification', () => {
      const summary = calculateBeneficiaryFinancials({
        monthly_income: 6000,
        housing_type: 'rent',
        monthly_rent: 2500,
        nationality_type: 'citizen',
      });

      expect(summary.grossIncome).toBe(6000);
      expect(summary.monthlyRent).toBe(2500);
      expect(summary.eligibleIncome).toBe(3500); // 6000 - 2500 = 3500
      expect(summary.priority).toBe('first_class');
      expect(summary.formulaText).toBe('الدخل الإجمالي (6000) - الإيجار (2500) = الدخل المحتسب (3500 ريال)');
    });
  });
});
