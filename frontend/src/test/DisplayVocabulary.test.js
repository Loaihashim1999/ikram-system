import { describe, it, expect } from 'vitest';
import { displayLabel, templateDisplay, templateStorage } from '../utils/displayVocabulary';
describe('Arabic display vocabulary', () => {
  it('hides unknown internal codes and distinguishes acceptance from delivery', () => {
    expect(displayLabel('status', 'sent')).toBe('تم قبول الرسالة للإرسال');
    expect(displayLabel('status', 'delivered')).toBe('تم التسليم المؤكد');
    expect(displayLabel('status', 'INTERNAL_SECRET')).toBe('غير محدد');
  });
  it('round trips readable template fields and preserves typed text', () => {
    const stored = 'مرحباً {recipient_name}، {verification_code}';
    const readable = templateDisplay(stored);
    expect(readable).not.toContain('recipient_name');
    expect(templateStorage(readable, ['recipient_name', 'verification_code'])).toBe(stored);
    expect(templateStorage(readable + ' تعديل', ['recipient_name', 'verification_code'])).toBe(stored + ' تعديل');
  });
});
