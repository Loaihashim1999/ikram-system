<?php

namespace App\Services\Communications;

use App\Models\Setting;
use Illuminate\Validation\ValidationException;

class MessageTemplates
{
    public function definitions(): array
    {
        $sms = ['recipient_name', 'beneficiary_name', 'staff_name', 'organization_name', 'fulfillment_method', 'delivery_date', 'verification_code', 'association_name'];
        $definitions = [];
        foreach (['beneficiary', 'staff', 'organization'] as $type) {
            $definitions[$type.'_pickup'] = [
                'allowed' => [...$sms, 'pickup_location_name', 'pickup_location_url'],
                'required' => ['verification_code', 'pickup_location_name', 'pickup_location_url'],
                'default' => '{recipient_name}، استلام الدعم من {pickup_location_name} {pickup_location_url} في {delivery_date}. رمز الاستلام: {verification_code}. {association_name}',
            ];
            $definitions[$type.'_delivery'] = [
                'allowed' => $sms, 'required' => ['verification_code'],
                'default' => '{recipient_name}، توصيل الدعم في {delivery_date}. رمز الاستلام: {verification_code}. {association_name}',
            ];
        }

        return $definitions + [
            'driver_assignment_sms' => [
                'allowed' => ['driver_name', 'temporary_driver_link', 'link_expiry', 'association_name'],
                'required' => ['temporary_driver_link'],
                'default' => "لديك مهمة توصيل جديدة من جمعية إكرام الجود.\nللدخول إلى مهام التوصيل استخدم الرابط الآمن التالي:\n{temporary_driver_link}",
            ],
            'password_reset_subject' => ['allowed' => ['association_name'], 'required' => [], 'default' => 'استعادة الحساب — {association_name}'],
            'password_reset_body' => ['allowed' => ['user_name', 'reset_link', 'reset_expiry', 'association_name'], 'required' => ['reset_link'], 'default' => '{user_name}، لاستعادة حسابك: {reset_link} صالح حتى {reset_expiry}. {association_name}'],
            // Active recovery channel: 6-digit SMS OTP (email reset links retired).
            'password_reset_otp' => [
                'allowed' => ['reset_code', 'expiry_minutes', 'association_name'],
                'required' => ['reset_code'],
                'default' => "رمز التحقق لإعادة تعيين كلمة المرور في نظام إكرام هو:\n{reset_code}\n\nتنتهي صلاحية الرمز خلال {expiry_minutes} دقائق.\nلا تشارك الرمز مع أي شخص.",
            ],
        ];
    }

    public function validate(string $key, string $template): string
    {
        $definition = $this->definitions()[$key] ?? null;
        $error = fn ($message) => throw ValidationException::withMessages([$key => $message]);
        if (! $definition || trim($template) === '' || mb_strlen($template) > 4000) {
            $error('القالب غير صالح أو يتجاوز الطول المسموح.');
        }
        if (preg_match('/[<>]|\{\{|\}\}|<\?|\x00/', $template)) {
            $error('يسمح بنص عادي ومتغيرات معتمدة فقط.');
        }
        preg_match_all('/\{([a-z_]+)\}/', $template, $matches);
        if (preg_match('/[{}]/', preg_replace('/\{[a-z_]+\}/', '', $template))) {
            $error('صياغة المتغير غير صحيحة.');
        }
        foreach ($matches[1] as $placeholder) {
            if (! in_array($placeholder, $definition['allowed'], true)) {
                $error('متغير غير مدعوم: {'.$placeholder.'}');
            }
        }
        foreach ($definition['required'] as $required) {
            if (! in_array($required, $matches[1], true)) {
                $error('المتغير المطلوب مفقود: {'.$required.'}');
            }
        }
        if ($key === 'password_reset_subject' && preg_match('/[\r\n]/', $template)) {
            $error('عنوان البريد يجب أن يكون في سطر واحد.');
        }

        return $template;
    }

    public function content(): array
    {
        $result = ['association_name' => \App\Support\AssociationIdentity::name()];
        foreach ($this->definitions() as $key => $definition) {
            $result[$key] = Setting::get('communications.'.$key, $definition['default']);
        }

        return $result;
    }

    public function render(string $key, array $values, ?string $template = null): string
    {
        $template ??= $this->content()[$key] ?? '';
        $this->validate($key, $template);
        $values['association_name'] ??= $this->content()['association_name'];

        return preg_replace_callback('/\{([a-z_]+)\}/', function ($m) use ($values, $key) {
            if (! array_key_exists($m[1], $values)) {
                throw ValidationException::withMessages([$key => 'بيانات الرسالة غير مكتملة.']);
            }

            return (string) $values[$m[1]];
        }, $template);
    }

    public function preview(string $key, string $template): string
    {
        return $this->render($key, [
            'recipient_name' => 'مستلم تجريبي', 'beneficiary_name' => 'مستفيد تجريبي', 'staff_name' => 'موظف تجريبي', 'organization_name' => 'جهة تجريبية',
            'fulfillment_method' => str_ends_with($key, '_pickup') ? 'استلام' : 'توصيل', 'delivery_date' => '2026-10-01 10:00', 'verification_code' => '0042',
            'pickup_location_name' => 'موقع تجريبي', 'pickup_location_url' => 'https://example.invalid/location',
            'driver_name' => 'سائق تجريبي', 'recipient_count' => '3', 'temporary_driver_link' => 'https://example.test/driver/task/demo',
            'link_expiry' => '2026-10-01 18:00', 'delivery_locations' => 'حي تجريبي', 'user_name' => 'مستخدم تجريبي',
            'reset_link' => 'https://example.invalid/reset#SAMPLE', 'reset_expiry' => '2026-10-01 11:00', 'association_name' => 'جمعية تجريبية',
            'reset_code' => '482731', 'expiry_minutes' => '10',
        ], $template);
    }
}
