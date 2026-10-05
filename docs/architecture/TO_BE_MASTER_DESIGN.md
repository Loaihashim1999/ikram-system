# وثيقة التصميم المعماري المستقبلي المعتمد (TO-BE MASTER DESIGN)

> **SUPERSEDED FOR ACTIVE COMMUNICATIONS (2026-09-24):** Driver delivery now uses SMS and WhatsApp is retired. See [ADR-007](ADR-007-WHATSAPP-RETIREMENT-DRIVER-SMS.md). Historical text below is retained as decision history.
## Current communication authority — 2026-09-24

[ADR-007](ADR-007-WHATSAPP-RETIREMENT-DRIVER-SMS.md) is authoritative for active communication routing:

- beneficiary, staff, organization, and driver → SMS through the existing outbox and Taqnyat SMS adapter;
- driver temporary access delivery → editable `driver_assignment_sms` template over SMS;
- password recovery → six-digit SMS OTP;
- WhatsApp Business → retired, with no runtime provider, template, consent, environment, API, or UI dependency.

Historical WhatsApp text later in this document records superseded decisions and must not be used to implement or accept the current system.


**مشروع:** نظام إكرام لحفظ النعمة وإدارة المستفيدين (IKRAM SYSTEM)  

> **Current status — 2026-09-24:** **GOVERNANCE / REPORTS FINALIZATION VERIFIED**. Phase 2A, Phase 2B, POLICY-A through POLICY-G, Notification Coverage, and PDF Finalization remain accepted. UI/UX Finalization is next and requires separate authorization; Phase 2C live-provider evidence remains deferred.

**الحالة:** STATUS: APPROVED ARCHITECTURE BASELINE  
**الإصدار:** VERSION: 2.0 — MASTER COMMUNICATION, DELIVERY & DEPLOYMENT UPDATE  
**التاريخ:** سبتمبر 2026  
**المرجعية:** قرارات المعمارية المعتمدة للمرحلة التنفيذية الأولى وما بعدها (Implementation Phase 1 & Beyond)

**FINAL STATUS — 2026-09-23:** PHASE 2A — VERIFIED · PHASE 2B — VERIFIED — ACCEPTED · BENEFICIARY POLICY ENGINE POLICY-A…POLICY-G — VERIFIED — ACCEPTED · NOTIFICATION COVERAGE — VERIFIED · PDF FINALIZATION — VERIFIED · PHASE 2C — TAQNYAT — PARTIAL — DECISIONS REQUIRED · FINAL DEPLOYMENT TARGET — MICROSOFT AZURE. Phase 2C code, mocked HTTP and guarded PostgreSQL acceptance are complete; production/account credentials, approved senders/template, driver opt-in and authorized live-sandbox evidence remain outside the repository.

---

## 1. المقدمة والغرض (Purpose & Scope)

تُعد هذه الوثيقة المرجع الهندسي والمعماري الدائم والمُلزم لكافة المطورين وأدوات الذكاء الاصطناعي في مشروع نظام إكرام.  
يُحظر إجراء أي تعديل هيكلي صامت على المعمارية المعتمدة هنا؛ وأي تغيير مستقبلي يتطلب تحديث هذه الوثيقة وتدوين ملحق قرار معماري (ADR Note) يوضح الأسباب والمبررات والموافقات.

---

## 2. القرارات المعمارية العشرون المعتمدة (The 20 Approved Architecture Decisions)

### القرار 1: المكدس التقني الأساسي (Core Tech Stack)
- يظل إطار العمل الأساسي للنظام مبنياً على:
  - **الواجهة الخلفية (Backend):** Laravel 13.x على PHP 8.3+ (وفق ملفات الاعتماد الحالية).
  - **الواجهة الأمامية (Frontend):** React 19 / Vite 8 SPA مع Tailwind CSS.
  - **قاعدة البيانات (Database):** PostgreSQL عبر محرك Eloquent ORM (مرجع قاعدة البيانات المعتمد للمرحلة 2A).

### القرار 2: موثوقية ومرجعية الخادم الخلفي (Backend Authoritative Source)
- الخادم الخلفي (Laravel Backend) هو المصدر الحصري والنهائي للحقيقة (Single Source of Truth) فيما يلي:
  - الحسابات والمعادلات المالية (Financial Calculations).
  - الصلاحيات والأمان والتحكم بالوصول (Authorization & RBAC).
  - كميات وحركات وأرصدة المخزون (Inventory Quantities).
  - تصنيفات الاستحقاق ودرجات الاحتياج (Classifications & Need Levels).
  - انتقالات حالات التوزيع والتسليم (Delivery State Transitions).
  - التحقق من سندات وأكواد الاستلام (Receipt Confirmation).

### القرار 3: دور الواجهة الأمامية في الاحتساب (Frontend Live Preview vs Backend Recalculation)
- يُسمح للواجهة الأمامية بحساب القيم وعرضها لحظياً (Live Preview) لتحسين تجربة المستخدم (UX).
- يُلزم الخادم الخلفي بإعادة احتساب كافة القيم المشتقة ذاتياً عند استلام الطلب، متجاهلاً تماماً أي قيم مجاميع أو تصنيفات مرسلة من العميل لمنع أي تلاعب (Zero Trust Client Calculations).

### القرار 4: تدفق تسجيل المستفيد الدائم والشرطية (Permanent Beneficiary Registration)
- **البيانات الأساسية (Basic Data):** إلزامية لجميع المستفيدين.
- **بيانات الأسرة والمعالين (Family Data):** إلزامية متى ما تطلب مسار العمل ذلك (متزوج، لديه معالون).
- **مصادر الدخل المالي (Financial Sources):** شرطية؛ لا يظهر حقل المبلغ إلا عند تحديد مصدر الدخل المقابل.
- **وثائق الإثبات المالي (Proof Documents):** شرطية؛ لا يظهر حقل رفع الإثبات إلا للمصادر المحددة التي تتطلب إثباتاً رسمياً.
- **أخطاء التحقق (Validation Errors):** يجب أن تحدد بدقة الحقل المتأثر وسبب الخطأ المفصل، ويُحظر استخدام رسائل عامة مبهمة.

### القرار 5: المعادلة المالية القياسية الموحدة (Standard Financial Formula)
- **إجمالي الدخل الشهري (Gross Monthly Income):**
  $$\text{Gross Income} = \sum (\text{Selected Valid Monthly Income Sources})$$
- **الإيجار الشهري (Monthly Rent):**
  $$\text{Monthly Rent} = \frac{\text{Annual Rent}}{12} \quad \text{(في حال تطبيق الإيجار السنوي، أو القيمة الشهرية المباشرة)}$$
- **صافي الدخل الشهري المعتمد (Net Monthly Income):**
  $$\text{Net Income} = \max(0, \text{Gross Income} - \text{Monthly Rent})$$

### القرار 6: محرك مالي مركزي وحيد (Single Financial Implementation)
- يوجد تطبيق وحيد ومعتمد للمنطق المالي وتصنيف الاستحقاق في الباك إند وهو `App\Services\FinancialCalculationService`.
- تُعامل أي خدمات موازية أو قديمة — وعلى رأسها `BeneficiaryClassificationService` — باعتبارها **Deprecated / Non-Authoritative / No Runtime Use**.
- يُحظر حذف `BeneficiaryClassificationService` أو أي خدمة قديمة مشابهة حذفًا عشوائيًا. لا تتم الإزالة الفعلية إلا بعد **Verified Dependency Audit** يثبت عدم وجود أي استدعاء أو اعتماد Runtime/Import/Job/Test/Route عليها، مع توثيق نتيجة التدقيق قبل الحذف.

### القرار 7: تصنيف المواطنين (Citizen Degree Classification)
- يقتصر تصنيف المواطن السعودي على درجتين فقط:
  - **درجة أولى (First Degree):** إذا كان صافي الدخل $\le$ حد الفئة الأولى (المعرف في إعدادات النظام `first_class_max_income`، افتراضياً 3000 ريال).
  - **درجة ثانية (Second Degree):** إذا كان صافي الدخل أكبر من حد الفئة الأولى.

### القرار 8: تصنيف المقيمين (Resident Classification)
- المقيم يتبع **دائماً وبشكل قاطع الدرجة الثانية (Second Degree)**.
- يُحظر تماماً ترقية أي مقيم إلى "الدرجة الأولى" سواء عبر واجهة المستخدم، أو الـ API، أو ملفات الاستيراد الذكي، أو التعديل المباشر على قاعدة البيانات.

### القرار 9: فصل درجة التصنيف عن مستوى الاحتياج (Separation of Degree vs Need Level)
- يُفصل معمارياً بين "درجة الاستحقاق" (Degree Classification) و "مستوى الاحتياج" (Need Level).
- المقيمون يصنفون جميعاً كـ **درجة ثانية**، وتحدد درجة احتياجهم داخلياً إلى:
  - **احتياج شديد (Severe Need):** إذا كان الدخل $\le$ حد الاحتياج المعتمد.
  - **احتياج عادي (Normal Need):** إذا كان الدخل أعلى من حد الاحتياج المعتمد.
- **مفتاح الإعداد المعتمد:** يُمنع تضمين أو كتابة أي حد مالي ثابت في الكود (Hardcoded Threshold). يتم استرجاع الحد حصرياً من جدول الإعدادات عبر المفتاح المعتمد:
  `resident_need_threshold` (مع قراءة المفتاح القديم `resident_degree_threshold` كخيار احتياطي فقط)، مع تمكين مدير النظام العام من تعديله مستقبلاً من شاشة إعدادات النظام.

### القرار 10: الغرض من التصنيف وتحديد الأولوية (Purpose of Classification)
- الهدف الأساسي من درجات الاستحقاق ومستويات الاحتياج هو المساعدة في تحديد وترتيب أولويات توزيع المساعدات والسلال الغذائية عند محدودية الكميات المتاحة.

### القرار 11: محرك الأولوية المستقبلي وتاريخ الدعم (Future Aid Priority Engine)
- يجب أن تتكامل أولوية الاستحقاق مستقبلاً مع **سجل الدعم التاريخي (Aid History)** للمستفيد:
  - نوع وكمية آخر صنف أو سلة استلمها.
  - تاريخ آخر استلام فعلي.
  - المدة الزمنية المنقضية منذ آخر عملية دعم.
- **ملاحظة معمارية:** هذا المحرك موثق كمتطلب مستقبلي معتمد، ويُحظر تنفيذه في المرحلة الأولى (Phase 1).

### القرار 12: استقلالية مخزون الحالات اليومية (Daily Beneficiary Inventory Independence)
- يظل مخزون وجبات ومواد الحالات اليومية الطارئة (`DailyInventoryItem` و `DailyInventoryMovement`) مستقلاً تماماً في جدول منفصل عن المستودع العام للسلال والمواد الدائمة (`InventoryItem`).

### القرار 13: معمارية مهام السائقين والروابط المؤقتة (Driver Access Architecture)
- تظل البيانات الأساسية للسائق مسجلة ومحفوظة بشكل دائم في جدول السائقين `drivers`.
- في المعمارية المستقبلية المستهدفة: **لن يمتلك السائق حساب تسجيل دخول دائم للنظام**.
- سيتم وصول السائق لمهامه الميدانية عبر **روابط مهام تسليم مؤقتة ومؤمنة (Temporary Delivery-Task Links)** يحدد المشرف مدة صلاحيتها عند إسناد الإرساليات.
- ينتهي الرابط تلقائياً باكتمال تسليم جميع الشحنات المخصصة أو بانتهاء المدة الزمنية المحددة للرابط.
- انتهاء الرابط لا يحذف سجلات الإرساليات أو سندات الاستلام أو التاريخ الرقابي.
- واجهة السائق في Phase 2B ستكون Mobile First عربية RTL دون تسجيل دخول دائم للمهام؛ يُرسل رابط التكليف عبر WhatsApp Business، والتحقق برمز أربعة أرقام فقط وفق الأقسام 6 و9. (عبارة التخطيط هذه **HISTORICAL — SUPERSEDED**: نُفذت الواجهة وتحققت في Phase 2B بتاريخ 2026-09-21 وفق [ADR-006](ADR-006-DELIVERY-VERIFICATION-COMMUNICATION-ARCHITECTURE.md) وتقرير المرحلة.)

### القرار 14: مركز الإشعارات الموحد (Centralized Notification Center)
- يتم توسيع وتطوير مركز الإشعارات الحالي في قاعدة البيانات دون استبداله.
- العمليات التشغيلية الهامة تولد إشعارات فورية موجهة بحسب الأدوار والصلاحيات.
- النقر على الإشعار يوجه المستخدم مباشرة إلى السجل أو المستند المعني عند امتلاكه للصلاحية اللازمة.

### القرار 15: سرية معلومات الصلاحية في المستودع (Warehouse Expiry Internal Confidentiality)
- بيانات تواريخ الصلاحية وحالات قرب الانتهاء مخصصة للاستخدام الرقابي الداخلي وتظهر في المستودع والحوكمة فقط.
- يُمنع منعاً باتاً ظهور تواريخ الصلاحية أو عبارات قرب الانتهاء في رسائل SMS الموجهة للمستلم أو أي اتصال خارجي أو في سندات الاستلام الفردية ما لم يصدر استثناء رسمي معتمد.
- قرب الانتهاء ($\le 5$ أيام) يولد تنبيهات رقابية داخلية لإدارة المستودع لاتخاذ إجراءات الصرف العاجل.

### القرار 16: الإطار الرسمي الموحد للوثائق والسندات (Official Document Branding)
- كافة وثائق وسندات الـ PDF الرسمية تُصدر حصرياً عبر محرك الباك إند (mPDF) متضمنة الإطار والترويسة والختم الرسمي لجمعية إكرام.
- لا يُعتبر أمر طباعة المتصفح (`window.print`) بديلاً للوثائق الرسمية.
- بيانات السائق الشخصية (رقم هويته أو هاتفه الخاص) تُحجب من السند الشامل للمستفيد.
- تظهر طريقة الاستلام في السندات كـ "استلام من الفرع" أو "توصيل ميداني".

### القرار 17: محرك الدعم الموحد المستقبلي (Unified Support Delivery Engine)
- سيعتمد صرف المساعدات مستقبلاً على محرك خطي موحد:
  $$\text{المستفيد} \rightarrow \text{الأصناف} \rightarrow \text{الكميات} \rightarrow \text{حجز المخزون} \rightarrow \text{طريقة التسليم} \rightarrow \text{السائق (إن وجد)} \rightarrow \text{التحقق} \rightarrow \text{السند النهائي} \rightarrow \text{السجل التاريخي} \rightarrow \text{الإشعارات}$$
- موثق كمتطلب معتمد للمراحل القادمة.

### القرار 18: الفصل بين بيانات الوصول المؤقتة والسجلات الدائمة (Temporary Access vs Permanent History)
- بيانات روابط التوصيل والرموز المؤقتة هي بيانات وصول مؤقتة تزول بانتهاء مهمتها.
- بيانات المستفيدين، الإرساليات، حركات المخزون، وسندات الاستلام هي **سجلات تاريخية رقابية دائمة غير قابلة للحذف العشوائي**.

### القرار 19: نموذج الصلاحيات الصارم والتحكم الخلفي (Strict RBAC & Authoritative Enforcement)
- المدير العام (`admin`) يمتلك صلاحية كاملة وغير مقيدة.
- المساعد الإداري (`assistant_admin`) وباقي الأدوار تُمنح صلاحياتها صراحة.
- عدم وجود الصلاحية يعني **الرفض التلقائي (Deny by Default)**.
- التحقق في الباك إند هو الحاسم والملزم، وإخفاء العناصر في واجهة المستخدم هو لتحسين تجربة الاستخدام فقط.

### القرار 20: معالجة التقارير الضخمة وتفادي انقطاع الاتصال (Asynchronous Reporting Scalability)
- مع نمو حجم البيانات، يجب تصميم استخراج التقارير الموسعة وتصدير ملفات الإكسل الضخمة بما يضمن تفادي انقطاع الاتصال (`504 Gateway Timeout`) عبر التجزئة أو المعالجة الموجهة بالتفق تدريجياً.

---

## 3. سجل تعديلات المعمارية (Architecture Decision Records - ADR Log)

| رقم القرار (ADR) | الموضوع | الحالة | تاريخ الاعتماد |
|---|---|:---:|:---:|
| **ADR-001** | توحيد كيان الموظفين واعتماد جدول `staff` ككيان نشط وتجميد `staff_members` | APPROVED | سبتمبر 2026 |
| **ADR-002** | اعتماد `FinancialCalculationService` كمصدر وحيد للحقيقة، مع إبقاء `BeneficiaryClassificationService` Deprecated/Non-Authoritative حتى اكتمال Verified Dependency Audit قبل أي حذف | APPROVED | سبتمبر 2026 |
| **ADR-003** | فصل درجة تصنيف المقيم (دائماً درجة ثانية) عن مستوى احتياجه (شديد/عادي) اعتماداً على إعدادات النظام | APPROVED | سبتمبر 2026 |
| **ADR-004** | [Unified Support Engine](ADR-004-UNIFIED-SUPPORT-ENGINE.md) — محرك الدعم الموحد، الحجز، السجل التاريخي، الصلاحيات الدقيقة وPostgreSQL acceptance | IMPLEMENTED & VERIFIED | سبتمبر 2026 |
| **ADR-005** | [Communication, Delivery & Deployment](ADR-005-COMMUNICATION-DELIVERY-DEPLOYMENT.md) — قنوات SMS/WhatsApp/Email، رمز 4 أرقام، واجهة السائق، Taqnyat وAzure كهدف النشر النهائي | APPROVED — COMM/DELIVERY IMPLEMENTED IN PHASE 2B | سبتمبر 2026 |
| **ADR-006** | [Delivery, Verification & Communication Implementation](ADR-006-DELIVERY-VERIFICATION-COMMUNICATION-ARCHITECTURE.md) — تنفيذ Phase 2B: التحقق بأربعة أرقام، روابط السائق المؤقتة، الموفرات الوهمية، تقاعد QR | IMPLEMENTED & VERIFIED — ACCEPTED | سبتمبر 2026 |
| **ADR-007** | [Versioned Beneficiary Policy Engine](ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md) — محرك سياسة المستفيدين: نموذج البيانات والإصدارات ولقطات التقييم والتدقيق والصلاحيات الدقيقة وواجهة API/UI دنيا | APPROVED — POLICY-A, POLICY-B, POLICY-C AND POLICY-D IMPLEMENTED & VERIFIED | سبتمبر 2026 |

## Phase 2A implementation addendum — 2026-09-20

ADR-004-UNIFIED-SUPPORT-ENGINE.md records the implemented unified support backend and its boundaries. The authoritative database is PostgreSQL, not the historical MySQL baseline. Actual installed versions are Laravel 13 / PHP 8.3 and React 19 / Vite 8. Support uses explicit beneficiary/staff/organization recipients, decimal reservations, mandatory transactional audits, granular permissions and item-specific population history. General and daily warehouses remain separate. Driver/mobile/temporary-link work remains deferred to Phase 2B. (عبارة التأجيل هذه **HISTORICAL — SUPERSEDED**: سلّمها وأنجزها Phase 2B بتاريخ 2026-09-21.)

Phase 2A has passed SQLite/frontend regression and isolated PostgreSQL acceptance: 54 PostgreSQL tests, 239 assertions, real two-process reservation contention, fractional rollback refusal, and rollback/re-migration. The implementation report records the evidence. Verdict: PHASE 2A VERIFIED — READY FOR PHASE 2B. This does not authorize deployment or starting Phase 2B. (حكم تاريخي صادر في 2026-09-20 قبل بدء Phase 2B؛ راجع القسم 16 لقرار التنفيذ الصريح اللاحق.)


## 4. اعتماد تحديث الاتصالات والتسليم والنشر — 2026-09-20

هذا التحديث هو المرجع المعتمد للـ TO-BE ويعلو على أي قرار سابق متعارض في الخطط أو الجلسات. تفاصيل الإحلال موثقة في [ADR-005](ADR-005-COMMUNICATION-DELIVERY-DEPLOYMENT.md)، وتسلسل التنفيذ في [خارطة التنفيذ](../implementation/IMPLEMENTATION_ROADMAP.md).

حالة التنفيذ: **Phase 2A VERIFIED**؛ اكتملت بوابة PostgreSQL المعزولة بالفعل، بما فيها 54 اختبارًا و239 تحققًا والتزامن بعمليتين ودورة rollback/re-migrate، وفق [تقرير المرحلة](../implementation/PHASE_02A_IMPLEMENTATION_REPORT.md). لا تُعاد بوابة مكتملة بسبب هذا التحديث التوثيقي. (عبارة «مرحلة 2B مخططة فقط، ولا تبدأ دون موافقة صريحة جديدة» تاريخية — كُتبت في 2026-09-20 قبل تنفيذ Phase 2B؛ الحالة الحالية: **PHASE 2B VERIFIED — ACCEPTED** — راجع القسم 16.) لا يغيّر هذا القرار سلوك Phase 2A الحالي أو يفعّل إرسالًا خارجيًا أو نشرًا.

### إحلال القرارات السابقة

- **QR REMOVED FROM TO-BE:** أُلغي QR نهائيًا من معمارية التحقق المستقبلية. لا وظائف QR جديدة، ولا اعتماد على QR كمسار بديل. يُدقّق الكود القديم وتُزال تبعياته بأمان في خطوة انتقال مضبوطة ضمن Phase 2B (نُفذت هذه الخطوة بتاريخ 2026-09-21 — راجع [تقرير Phase 2B](../implementation/PHASE_02B_IMPLEMENTATION_REPORT.md))؛ وجوده في وثائق AS-IS يصف التاريخ ولا يمنح إذنًا لتوسيعه. لا تُحذف سجلات الاستلام التاريخية عند الإزالة.
- وسيلة التحقق الوحيدة المستهدفة هي **رمز استلام من أربعة أرقام رقمية بالضبط**. تُلغى خيارات الرموز الأبجدية أو 5/8 خانات للـ TO-BE؛ يظل التحويل الفعلي مؤجلًا للمرحلة المختصة (نُفذ التحويل الفعلي في Phase 2B بتاريخ 2026-09-21 وتحققت منه بوابات الاختبار).
- **WhatsApp Business متقاعد نهائيًا (2026-09-24):** السائق والمستفيد والموظف والجهة يستخدمون SMS؛ تبقى إشارات WhatsApp الأخرى أدناه كسجل قرار تاريخي متجاوز فقط.
- **(تاريخي — SUPERSEDED) Azure SUPERSEDED BY HOSTINGER (2026-09-20):** كان Hostinger هدف الإنتاج النهائي وفق تحديث 2026-09-20. صُحح القرار في 2026-09-21: **Microsoft Azure هو هدف النشر الإنتاجي النهائي**. أي ملفات نشر Azure أو غيرها في المشروع تمثل إعدادات سابقة حتى يعتمد تدقيق النشر اللاحق الطوبولوجيا النهائية، وليست إذنًا لتنفيذه.

## 5. مصفوفة قنوات الاتصال المعتمدة

- المستفيد الدائم → SMS → Taqnyat SMS API عبر المزود المنفذ عند تفعيل الوضع الحقيقي.
- الموظف/موظفة الجمعية → SMS → Taqnyat SMS API عبر المزود المنفذ عند تفعيل الوضع الحقيقي.
- الجهة المستفيدة/المنظمة → SMS → Taqnyat SMS API عبر المزود المنفذ عند تفعيل الوضع الحقيقي.
- السائق → SMS → Taqnyat SMS API عبر outbox والقالب `driver_assignment_sms`، دون شرط WhatsApp opt-in.
- إعادة تعيين كلمة المرور واستعادة الحساب المعتمدة → SMS → Taqnyat SMS API عبر مسار outbox الحالي (رمز OTP من 6 أرقام). **SUPERSEDED (2026-09-24):** كانت القناة Email عبر Taqnyat Email API؛ أُحيلت استعادة البريد إلى خارج التصميم المستقبلي الفعّال — راجع القسم 10 والقرار في القسم 17.

Taqnyat هو المزود المعتمد للقنوات الثلاث ولا مزود بديل أو fallback دون قرار معماري صريح جديد. تحققت Phase 2C من عقود SMS وWhatsApp Business وEmail الرسمية ونفذت adapters خلف العقود الحالية. توفر الخدمة في حساب المستخدم، المرسلون والقالب وopt-in والإرسال الحي ما زالت بوابات خارجية غير مكتملة.

مركز الإشعارات الداخلي وخدمة NotificationService يظلان قائمين. خدمات الاتصال الخارجي لا تستبدلهما أو تنشئ مركز إشعارات موازٍ.

## 6. التحقق برمز استلام من أربعة أرقام فقط

الرمز سلسلة من أربع خانات رقمية بالضبط، مثل `4827`، مع الحفاظ على الأصفار البادئة. يُولّد بمصدر عشوائي آمن على الخادم، ويخص عملية دعم/تسليم واحدة، ولا يُشتق من رقم المستفيد أو الهاتف أو معرف الدعم أو التسليم.

متطلبات Phase 2B الملزمة:

- مؤقت وله وقت انتهاء؛ يستخدم مرة واحدة؛ يتحقق منه الخادم فقط.
- حد أقصى للمحاولات الفاشلة، rate limiting، وقفل مؤقت بعد تجاوز الحد؛ لا يكفي إخفاء زر الواجهة.
- يصبح غير صالح فور التأكيد الناجح. يجب أن يمنع التأكيد المتزامن إعادة استخدامه، وأن يرتبط استهلاكه وإكمال العملية بانتقال أعمال ذري موثوق.
- تُدقّق أحداث التحقق والنجاح والفشل والقفل دون تسجيل الرمز نفسه أو أي سر.
- لا رمز صريح في سجلات التطبيق أو التدقيق أو الاتصالات. تُصمّم وسيلة تحقق محمية تناسب مساحة الأربعة أرقام الصغيرة، ولا يُعامل تجزئتها وحدها كحماية كافية من التخمين خارج النظام.
- تحدد Phase 2B قيم الانتهاء وعدد المحاولات ومعدل الطلبات ومدة القفل وسياسة إعادة الإصدار قبل اعتمادها؛ لا تُخترع قيم نهائية في هذا التحديث. (نفذت Phase 2B ذلك بقيم TEST افتراضية موثقة في `config/delivery.php` بتاريخ 2026-09-21؛ قيم الإنتاج ما زالت بانتظار موافقة صريحة من المستخدم.)

## 7. SMS للمستلمين ومواقع الاستلام

الرسالة تُشتق من نوع المستلم وعملية الدعم وطريقة التسليم. المعلومات المشتركة الممكنة: اسم المستلم، طريقة التسليم، تاريخ/وقت التسليم أو الاستلام، رمز الاستلام، واسم الجمعية.

**Pickup:** اسم موقع الاستلام، رابط الموقع، تاريخ/وقت الاستلام ورمز الأربعة أرقام. **Delivery:** صياغة توصيل، تاريخ/وقت التوصيل ورمز الأربعة أرقام؛ لا يُضمّن اسم موقع الاستلام أو رابطه أو معلوماته في رسالة التوصيل.

مواقع الاستلام المستهدفة تدعم `name`, `address`, `city`, `district`, `location_url`, `is_active`. يزوّد المستخدم الرابط الرسمي لاحقًا؛ لا يُختلق رابط. تستخدم رسالة الاستلام الموقع النشط المضبوط للعملية، وتحتفظ سجلات الدعم باللقطات اللازمة للاسم والرابط والتفاصيل التاريخية المعتمدة. قواعد PATCH للتفعيل/التعطيل وحماية الموقع المرتبط بالتاريخ باقية. أُضيفت `location_url` ولقطاتها في Phase 2B بتاريخ 2026-09-21 (العبارة الأصلية «إضافة `location_url` عمل مستقبلي في Phase 2B» **HISTORICAL — SUPERSEDED**؛ لم تكن موجودة في مخطط Phase 2A).

## 8. قوالب الاتصالات وإعدادات النظام

**محتوى SMS وWhatsApp للسائق وبريد إعادة التعيين قابل للتحرير من المدير العام فقط في System Settings.** لا صياغة نهائية ثابتة داخل المتحكمات. يحفظ النظام قوالب افتراضية آمنة مع معاينة على الخادم، وقواعد تحقق تمنع القالب غير الصحيح من كسر توليد الرسائل. رفض الحفظ غير الصالح واضح؛ وجود fallback لا يخفي خطأ إعداد المدير.

قسم Communications المستقبلي بسيط وعربي، ويجمع:

- SMS: قوالب المستفيد والموظف والجهة، مع الفصل بين pickup وdelivery عند الحاجة ومعاينة.
- WhatsApp: قالب تكليف السائق ومعاينة.
- Email: عنوان بريد إعادة التعيين، قالب المتن، اسم الجمعية الظاهر ومعاينة.
- Locations: اسم الموقع ورابطه، مرتبطان بسجل PickupLocation دون مصادر متعارضة.

يمكن دعم ستة قوالب SMS: Beneficiary Pickup/Delivery، Staff Pickup/Delivery، Organization Pickup/Delivery. إذا أثبتت مراجعة Phase 2B كفاية قالب مشترك بمتغيرات، يُتجنب التكرار غير الضروري مع بقاء فصل مضمون الرسائل بين الاستلام والتوصيل إلزاميًا. (نفذت Phase 2B مراجعة القوالب وأقرّت الفصل بين Pickup/Delivery بتاريخ 2026-09-21؛ العبارة الشرطية أعلاه تاريخية.)

### خدمة عرض القوالب والتحقق

تُنشأ خدمة Template Rendering مضبوطة، لا تنفيذ نصوص أو `eval` ولا محرك قوالب يسمح بكود اعتباطي. تُستخدم allowlist لكل قناة/حالة، ويُرفض المتغير غير المعروف أو غير الملائم للحالة بخطأ تحقق واضح. المثال `{password}` مرفوض. تُمنع الصياغة المكسورة؛ وتُحمى معاينة HTML والنص وفق نوع القناة. تستخدم المعاينات بيانات تجريبية وروابط/رموز وهمية، لا أسرار عمليات حقيقية.

متغيرات SMS المعتمدة للتصميم:
`{recipient_name}`, `{beneficiary_name}`, `{staff_name}`, `{organization_name}`, `{fulfillment_method}`, `{pickup_location_name}`, `{pickup_location_url}`, `{delivery_date}`, `{verification_code}`, `{association_name}`.

`{recipient_name}` هو الاسم المشترك، والمتغيرات المتخصصة تُربط فقط بنوع المستلم الصحيح. `{delivery_date}` يمثل الموعد المنسق بحسب الطريقة؛ ليست هذه القائمة إذنًا لاستخدام متغير موقع الاستلام في delivery. قالب SMS الخاص بالتحقق يجب أن يحتوي `{verification_code}` ما لم يعتمد تغيير صريح لاحقًا. يجب ضمان ظهور معلومات الموقع والموعد المطلوبة لرسالة pickup حتى عند توحيد القوالب.

متغيرات WhatsApp للسائق:
`{driver_name}`, `{recipient_count}`, `{temporary_driver_link}`, `{link_expiry}`, `{delivery_locations}`, `{association_name}`.

متغيرات البريد:
`{user_name}`, `{reset_link}`, `{reset_expiry}`, `{association_name}`.
يجب وجود `{reset_link}` في قالب متن إعادة التعيين. يخضع العنوان والمتن لقواعد القناة، مع default/fallback آمن ومعاينة. لا صلاحية للقالب لتجاوز سياسات انتهاء الروابط أو حدود المحاولات.

### المحتوى الآمن منفصل عن الأسرار

المحتوى القابل للتحرير: القوالب والعناوين واسم الجمعية وبيانات الموقع، وقيم المرسل الظاهر الآمنة حيث يلزم، وأعلام تمكين/تعطيل الاتصال فقط حيث تُعتمد. أسماء المرسل الظاهرة لا تمنح صلاحية تغيير هوية إرسال غير معتمدة لدى المزود.

API keys وAPI secrets والرموز الخاصة وبيانات اعتماد المزود تبقى في environment/secret configuration؛ لا تعرض أو تعدل في System Settings، ولا تخزن في جدول الإعدادات العادي، ولا ترسل إلى React أو استجابات API أو السجلات أو التقارير أو Git. قائمة مفاتيح Settings المطبقة في Phase 2A لا تتوسع الآن؛ يُضاف نطاق الاتصالات الآمن مع التحقق والصلاحيات في Phase 2B. (نُفذ نطاق الاتصالات في System Settings خلال Phase 2B بتاريخ 2026-09-21 — العبارة الأصلية **HISTORICAL — SUPERSEDED**.)

## 9. تكليف السائق عبر SMS والواجهة المحمولة

بيانات السائق الدائمة محفوظة في `drivers`؛ لا يحتاج السائق إلى حساب تطبيق دائم لمهام التسليم. التدفق المستهدف:

1. يختار المدير سائقًا مسجلًا ويسند المهام ويحدد مدة الوصول المؤقت.
2. يولد النظام رابط وصول مؤقتًا آمنًا ومقيدًا بالإسناد والمهام المسموح بها.
3. يرسل التكليف عبر SMS من خلال outbox و`TaqnyatSmsProvider` في الوضع الحقيقي، وعبر fake provider في الاختبار. لا يعتمد المسار على WhatsApp أو opt-in له.
4. يفتح السائق واجهة مستقلة Mobile First عربية RTL، بتخطيط شبيه بالتطبيق وأهداف لمس كبيرة وتنقل بسيط مناسب لاستخدام الهاتف بيد واحدة، دون شريط Admin الجانبي.
5. ينتهي الرابط عند الموعد المحدد **أو فور اكتمال جميع المهام المسندة، أيهما أولًا**. انتهاء الوصول لا يحذف تاريخ الدعم أو التسليم أو الاستلام أو التدقيق.

رسالة SMS للسائق تقتصر على البيانات المسموحة في قالب `driver_assignment_sms` والرابط المؤقت ووقت انتهائه واسم الجمعية. لا تفاصيل مستفيدين غير ضرورية فيها؛ التفاصيل المسموحة داخل واجهة السائق الآمنة فقط.

محتوى المهمة المسموح عند الحاجة: اسم المستلم، الهاتف، مرجع الأعمال/الهوية المعتمد الضروري، المدينة، الحي، العنوان، رابط الخريطة/الموقع، الأصناف والكميات وحالة التسليم ومدخل رمز الأربعة أرقام. لا بيانات دخل أو وثائق تصنيف أو ملفات مستفيدين غير مرتبطة أو وحدات إدارية. التفويض الخلفي يقيّد الوصول إلى المهام المسندة فقط.

قالب `driver_assignment_sms` قابل للتعديل والتحقق والمعاينة وله default آمن. لا توجد إدارة قالب مزود WhatsApp أو تزامن أو تفعيل في المسار النشط.

## 10. إعادة تعيين كلمة المرور عبر SMS (رمز OTP من 6 أرقام)

**(مُحدَّث 2026-09-24 — القناة الرسمية: SMS عبر Taqnyat. استعادة البريد الإلكتروني: RETIRED FROM ACTIVE TO-BE. استعادة WhatsApp: NOT USED.)**

مسار الاستعادة المعتمد: «نسيت كلمة المرور» → اسم المستخدم → إرسال رمز تحقق SMS → إدخال رمز من 6 أرقام → كلمة مرور جديدة وتأكيدها. يُرسل الرمز إلى رقم الجوال المسجل والمصرح به للحساب فقط؛ لا يقبل الخادم رقم وجهة من الطلب. رمز OTP مكوّن من 6 أرقام بالضبط، عشوائي تشفيريًا، أحادي الاستخدام، مرتبط بالحساب وبالغرض `password_reset`، تنتهي صلاحيته بعد 10 دقائق، مع الحفاظ على الأصفار البادئة، وحد أقصى 5 محاولات فاشلة ثم قفل مؤقت، وفترة سماح إعادة إرسال 60 ثانية مع حد أقصى لمعدل الطلبات لكل حساب ولكل IP. كل رمز جديد يُبطل السابق فورًا، والتحقق الناجح يمنح تفويض استعادة قصير العمر منفصلًا عن الرمز نفسه.

لا يُحفظ الرمز نصًا صريحًا أبدًا؛ يُحفظ مادة تحقق HMAC بنمط مشابه لرمز الاستلام لكن في فضاء أسماء مستقل تمامًا (`password_reset:`)، ويُفصل كليًا عن آلية رمز الاستلام رباعي الأرقام (جداول ومحاولات وحالة مستقلة). الاستجابة العامة لطلب الاستعادة موحدة ولا تكشف وجود الحساب أو الجوال أو حالته. بعد نجاح التحقق تُطبق سياسة كلمة المرور الحالية، ويُبطل التفويض فور الاستخدام، وتُلغى جلسات التفويض الأخرى، وتُسحب رموز Sanctum النشطة. تُسجّل أحداث PASSWORD_RESET_REQUESTED / OTP_SENT / OTP_FAILED / OTP_LOCKED / OTP_VERIFIED / COMPLETED دون الرمز أو كلمة المرور أو الرقم الكامل. عند فشل إرسال SMS لا تُنشأ جلسة استعادة قابلة للاستخدام ولا تتغير بيانات الحساب.

قالب SMS الاستعادة (`password_reset_otp`) يُدار من System Settings → Communications بمتغيرات `{reset_code}` (مطلوب) و`{expiry_minutes}` و`{association_name}` فقط، ويُرفض أي متغير آخر.

نُفذ `TaqnyatEmailProvider` خلف عقد Email ومسار outbox، مع بقاء fake Email هو الوضع الآمن الافتراضي؛ لم تعد الاستعادة تعتمد عليه، ولم يعد Taqnyat Email مانعًا لقبول استعادة كلمة المرور. تبقى بنية البريد التحتية (المزود، القوالب `password_reset_subject/body`، جدول `password_reset_tokens`، إشعار `ResetAccountPassword`) محفوظة ككود تاريخي موقوف عن المسار الفعّال ولا تُستدعى من أي مسار نشط.

## 11. تجريد الاتصال والطوابير وسلامة الأعمال

تستخدم خدمات المجال `CommunicationService` و`SmsProviderInterface` للقنوات التشغيلية المعتمدة، ويطبق `TaqnyatSmsProvider` عقد SMS في الوضع الحقيقي مع fake provider للاختبار. لا يوجد عقد أو adapter WhatsApp نشط، ولا طلبات Taqnyat HTTP موزعة داخل المتحكمات.

يُستخدم Laravel Queue للإرسال غير المتزامن حيث يلائم: حد محاولات وإعادة محاولة مع backoff تصاعدي، idempotency ومنع التكرار، timeouts، معالجة انقطاع المزود وحالة فشل نهائية مرئية مع retry مضبوط. إعادة إرسال الرسالة لا تولد رمز استلام جديدًا إلا بقرار أعمال صريح. تصميم Phase 2B يحدد حفظ مادة الإرسال الحساسة المؤقتة بصورة محمية وبمدة محدودة لدعم إعادة الإرسال (نفذت Phase 2B هذا الحفظ المحمي بتاريخ 2026-09-21)؛ لا تُترك رموز/روابط صريحة في payloads أو تقارير failed jobs أو سجلات المعاينة.

فشل المزود معزول عن المعاملات الأساسية: نجاح الحجز يبقى صحيحًا عند تعذر SMS؛ لا يُحذف الدعم ولا يُزال الحجز ولا يُفسد المخزون أو يُمحى التاريخ. يُسجل الفشل ويظهر وضع الإرسال وتتاح إعادة محاولة مضبوطة. تُجدول الاتصالات بعد نجاح معاملة الأعمال، مع تصميم موثوق يمنع ضياع مهمة الإرسال أو ازدواجها. لا تنتظر معاملة قفل المخزون اتصالًا خارجيًا.

سجل الاتصال المستقبلي يتضمن: القناة، مرجع العملية، نوع المستلم ومرجعه، وجهة الاتصال بالقدر اللازم وبوصول مضبوط، مرجع رسالة المزود، الحالة، `requested_at`, `sent_at`, `delivered_at` حيث يدعم المزود، `failed_at`، سبب/رمز خطأ منقح، عدد retries والطوابع الزمنية. لا كلمات مرور أو reset tokens أو رموز روابط السائق أو رمز الأربعة أرقام بنص صريح في هذه السجلات. لا يُحفظ النص المعروض الكامل إذا احتوى أسرارًا؛ تستخدم بيانات تدقيق منقحة.

## 12. بوابة الاكتشاف والتدقيق الإلزامية قبل Phase 2B (Mandatory Discovery/Audit Gate) — نُفذت بتاريخ 2026-09-21

قبل تنفيذ أي حذف أو تعطيل أو استبدال متعلق بالتسليم أو التحقق أو الاتصالات، تبدأ Phase 2B ببوابة **Discovery/Audit** إلزامية ومثبتة بالأدلة. (نُفذت البوابة ونتائجها موثقة في [خريطة الاكتشاف](../implementation/PHASE_02B_DISCOVERY_MAP.md) — العبارات التالية تصف ما نُفذ.)

يجب أن يغطي التدقيق على الأقل:

- جميع مسارات QR الحالية: Backend routes/controllers/services/models، واجهات React، الطباعة/PDF، الاختبارات، وأي تخزين أو حقول تاريخية مرتبطة به.
- نظام السائق الحالي: الحساب/تسجيل الدخول، الصلاحيات، المسارات، واجهة السائق، وربط `drivers` بأي `users` أو منطق قديم.
- مسار إعادة تعيين كلمة المرور الحالي: الطلب، التوكن، البريد/المزود، الواجهة، المعدلات، والسجلات الأمنية.
- أي كود اتصالات حالي أو قديم: WhatsApp اليدوي، روابط WhatsApp، SMS/email stubs، notification hooks، queues/jobs أو configuration ذات الصلة.
- جميع الـroutes والـPDFs والاختبارات والوثائق التي تعتمد على أي من المسارات القديمة السابقة.

### قاعدة الانتقال الآمن

- **لا يُحذف QR القديم، ولا يُعطل تسجيل دخول السائق القديم، ولا يُزال مسار Password Reset أو أي كود اتصال حالي لمجرد وجود البديل على الورق.**
- يُبنى المسار البديل أولًا، ويُختبر ويُثبت أنه يغطي السيناريوهات المطلوبة.
- بعد نجاح اختبارات البديل، تُحدد التبعيات القديمة بدقة، ثم يتم تعطيل/إزالة القديم في خطوة انتقال مضبوطة وقابلة للتراجع حيث يلزم.
- يجب الحفاظ على السجلات التاريخية وعدم حذف بيانات استلام/تسليم أو أدلة تدقيق قديمة بسبب إزالة واجهة أو آلية قديمة.
- أي dependency غير مفهومة أو غير مغطاة بالاختبار توقف الإزالة حتى يتم حسمها.

مخرجات بوابة الاكتشاف يجب أن تتضمن خريطة **CURRENT → REPLACEMENT → MIGRATION/RETIREMENT → TEST EVIDENCE** قبل تنفيذ الإزالة.

---

## 13. Phase 2B وPhase 2C: فصل التنفيذ عن المزود الحقيقي

**Phase 2B — Delivery & Communication Architecture:** رمز الأربعة أرقام وسياساته، روابط السائق المؤقتة وواجهة الهاتف، إعدادات القوالب وخدمة عرضها والتحقق منها، مواقع وروابط الاستلام، توجيه القنوات، عقود الخدمات، queue/jobs، fake SMS/WhatsApp/Email وسجلات الاتصال والتدقيق، وانتقال QR المضبوط. بُنيت واختُبرت دون credentials خارجية أو اعتماد على توفر Taqnyat، وكل موفري الاتصال المحليين محاكاة، ولم يُشغَّل إرسال حقيقي ضمن هذه المرحلة. **نفذتها Phase 2B وتحققت بتاريخ 2026-09-21** — راجع [تقرير المرحلة](../implementation/PHASE_02B_IMPLEMENTATION_REPORT.md).

**Phase 2C — Taqnyat Communication Integration — PARTIAL — DECISIONS REQUIRED (2026-09-23):** نُفذت موفرات القنوات الثلاث وفق العقود الرسمية، اختيار fake/taqnyat الصريح، توحيد رقم الجوال السعودي، المهلات، تصنيف الأخطاء، outbox claim ومنع العامل المكرر والاختبارات الوهمية وPostgreSQL. يلزم لإكمال القبول بيانات الحساب والمرسلين المعتمدين، قالب WhatsApp ذي المتغير الواحد، قرار وإثبات opt-in للسائقين، ومستلمو sandbox بتفويض إرسال منفصل. لا تُخترع أي قيمة.

أسماء مثل `TAQNYAT_SMS_TOKEN`, `TAQNYAT_SMS_SENDER`, `TAQNYAT_EMAIL_TOKEN`, `TAQNYAT_EMAIL_SENDER` أمثلة مفاهيمية فقط؛ الأسماء النهائية بعد قراءة التوثيق الرسمي. المرحلة تشمل sandbox/testing خارجيًا، وربط القوالب المعتمدة، واستقبال تحديثات حالة التسليم حيث تكون مدعومة، مع التحقق من مصدر callbacks ومنع إعادة معالجتها. عدم دعم قدرة في التوثيق يُوثق ويُحسم دون اختراع API أو تبديل مزود صامت.

## 14. Microsoft Azure: هدف النشر النهائي وبوابة التدقيق (تصحيح 2026-09-21)

**Microsoft Azure هو هدف الإنتاج النهائي.** توجيه Hostinger السابق (2026-09-20) **SUPERSEDED** ويُحتفظ به كتاريخ فقط. لا نشر في Phase 2A أو Phase 2B. لا نختار拓扑 الخدمات أو مسار PostgreSQL قبل التدقيق.

بعد قبول النظام الكامل، يُنشأ **AZURE DEPLOYMENT AUDIT** للتحقق بالدليل من:

- دعم Laravel/PHP والإصدارات والإضافات المطلوبة فعليًا.
- بناء وتقديم React/Vite static assets وضبط توجيه التطبيق والـ API.
- معمارية PostgreSQL واتصاله وأمنه وتوافق الهجرات، دون افتراض أن قاعدة QA أو التشغيل الحالية هي هدف النشر.
- Laravel queues/workers وscheduler/cron والإشراف على العمليات وإعادة التشغيل.
- persistent storage وصلاحياته وملفات المستخدمين وتوليد PDF وخطوطه ومتطلباته.
- outbound HTTPS إلى Taqnyat وSSL وإدارة environment secrets.
- السجلات المنقحة والنسخ الاحتياطية واختبار الاستعادة وإجراءات التشغيل.

بعد نجاح التدقيق فقط تأتي خطوة Azure Production Deployment بموافقة نشر منفصلة. لا إعداد موارد ولا شراء خدمات سحابية ولا اتصالات إنتاج في هذا التحديث.

## 15. تسلسل التنفيذ المعتمد وحدود الإذن

Phase 2A (Unified Support Engine + PostgreSQL acceptance، **VERIFIED**) → Phase 2B (Delivery & Communication Architecture، fake providers، **VERIFIED — ACCEPTED**) → **Beneficiary Policy Engine** (POLICY-A…POLICY-G، **VERIFIED — ACCEPTED**) → System-wide Notification Coverage Audit (**VERIFIED**) → PDF / Official Document Finalization (**VERIFIED**) → Governance / Report Finalization (**VERIFIED**) → UI/UX Finalization → Phase 2C Taqnyat Finalization → Full System Acceptance Test → Azure Deployment Audit → Azure Production Deployment.

هذا تسلسل اعتماد معماري، وليس إذناً بالانتقال التلقائي. الحالة الحالية: Phase 2A وPhase 2B ومحرك السياسة POLICY-A…POLICY-G وتدقيق تغطية الإشعارات وPDF Finalization وGovernance / Reports Finalization متحققة؛ التالي UI/UX Finalization بتفويض مستقل. تبقى Phase 2C جزئية حتى إغلاق قرارات الحساب والقالب وopt-in والإرسال التجريبي المصرح.

## 16. Phase 2B execution decision — 2026-09-21

أذن المستخدم صراحة بتنفيذ Phase 2B بعد تحقق Phase 2A. نُفذت المعمارية وفق [ADR-006](ADR-006-DELIVERY-VERIFICATION-COMMUNICATION-ARCHITECTURE.md)، وخريطة الاكتشاف [PHASE_02B_DISCOVERY_MAP](../implementation/PHASE_02B_DISCOVERY_MAP.md). يصف [تقرير Phase 2B](../implementation/PHASE_02B_IMPLEMENTATION_REPORT.md) نتائج القبول الفعلية. عبارات تأجيل Phase 2B في وصف Phase 2A أعلاه توثّق حدود تلك المرحلة السابقة؛ القرار الحالي يسمح بتنفيذ Phase 2B فقط.

التحقق الحالي أربعة أرقام فقط، HMAC مرتبط بالعملية وبسر الخادم، واستلام ذري مع سجل دائم. وصول السائق برابط مؤقت مستقل عن تسجيل دخول الإدارة، مع واجهة RTL مخصصة للهاتف وتحقق خلفي لكل طلب. قنوات SMS للمستفيد/الموظف/الجهة، WhatsApp للسائق، واستعادة كلمة المرور عبر SMS برمز OTP من 6 أرقام (أُحيلت قناة Email للاستعادة بتاريخ 2026-09-24 — القسم 17)؛ جميع الموفرين محاكاة محلية. إعدادات المحتوى والمعاينة للمدير العام فقط، دون أسرار موفر. سجل اتصال منقح وحمولة مؤقتة مشفرة، وصف انتظار ومعالجة إعادة محاولة محدودة مع ثبات الرمز.

السياسة الرقمية في config/delivery.php قيم اختبار محدودة ومتحقق منها وليست سياسة إنتاج معتمدة. تحتاج موافقة المستخدم قبل قبول الإنتاج. يسمح توجيه تنفيذ Phase 2B الصريح باستمرار التنفيذ والاختبار بهذه القيم؛ لا يُستنتج منه إذن نشر.

عُطلت مسارات QR والتحقق اليدوي القديمة بعد إثبات البدائل؛ حُفظت مراجع PDF وسجلات التاريخ. تظل بعض ملفات الواجهة القديمة غير مركبة في المسارات الفعالة لأغراض التاريخ والاختبارات، ويبيّن تصنيفها سجل الاكتشاف. لا إعادة ربط صامتة بين جهات NeighborhoodRep التاريخية وOrganization المعتمدة.

Phase 2C **PARTIAL — DECISIONS REQUIRED**: التكامل البرمجي والقبول المحلي مكتملان، لكن قبول الحساب/القالب/opt-in والإرسال الحي المصرح لم يكتمل. أما **POLICY-A…POLICY-G فقد اكتملت وتحققت، ومحرك سياسة المستفيدين مقبول** بتاريخ 2026-09-23. **Microsoft Azure هو هدف النشر النهائي** بعد التدقيق والموافقات المحددة.

## 18. UI/UX Finalization — VERIFIED — 2026-09-24

اكتمل توحيد واجهة React ضمن نظام تصميم عربي مؤسسي محلي بالكامل: ألوان ودلالات ومسافات وحقول وجداول وبطاقات وحالات وتركيز لوحة المفاتيح وحوارات قابلة للوصول. أصبحت قائمة المستفيدين الموحدة، المستفيدون اليوميون، الملفات والنماذج، POLICY-D/E، الدعم والتسليم، المستودعات، الحوكمة، الحسابات، الإعدادات، الجهات والموظفون تستخدم لغة عرض مشتركة مع بقاء هرمية كل وحدة مستقلة.

حُفظت عقود backend والصلاحيات والحسابات والتقارير وPDF/Excel، وبقي الفصل بين الدائمين واليوميين وبين المستودع العام والمستودع اليومي. أزيل اعتماد خط Google الخارجي، وثبت القبول المحلي عند 360/390/430/768/1024/1440 بكسل دون overflow أو طلبات شبكة بعيدة. الأدلة في [UI_UX_FINALIZATION_AUDIT](../implementation/UI_UX_FINALIZATION_AUDIT.md) و[UI_UX_FINALIZATION_REPORT](../implementation/UI_UX_FINALIZATION_REPORT.md). المرحلة التالية هي Phase 2C Taqnyat Finalization بعد إغلاق القرارات الخارجية الموثقة، ولا يتضمن هذا الاعتماد نشرًا أو اتصالًا بالإنتاج.

## 17. حالة النظام المعتمدة — 2026-09-21

الحالة الرسمية المتسقة عبر الوثائق:

- **PHASE 2A — VERIFIED**
- **PHASE 2B — VERIFIED — ACCEPTED**
- **BENEFICIARY POLICY ENGINE**:
  - **POLICY-A — VERIFIED — ACCEPTED — 2026-09-21** (نموذج البيانات + دورة حياة الإصدارات + الإعدادات المرنة المبنية + لقطات التقييم + أساس التدقيق + صلاحيات دقيقة + API/UI دنيا؛ لا إعادة احتساب مباشر/محاكاة/تقييم جماعي. الأدلة: [POLICY_A_IMPLEMENTATION_REPORT](../implementation/POLICY_A_IMPLEMENTATION_REPORT.md) و[ADR-007](ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md) — APPROVED)
  - **POLICY-B — VERIFIED — ACCEPTED — 2026-09-21** (العقد المالي الموثوق عبر `FinancialCalculationService::calculatePolicyFinancials` وحده: مصادر الدخل المحتسبة، وضعا الإيجار الآمنان [سنوي ÷ 12 افتراضيًا / شهري مباشر عبر عمود المدخل الخام الجديد `monthly_rent_direct_input`]، حجم الأسرة الموثوق = 1 + التابعين النشطين، حسم الفرد من إعدادات النسخة [100 ريال افتراضيًا]، صافي الدخل المعدل ونصيب الفرد الحتمي؛ حكم الأهلية مع أكواد أسباب ثابتة عبر `BeneficiaryPolicyEligibilityService`؛ لقطات POLICY-A الدائمة الممتدة عبر `PolicyFinancialEvaluationService`؛ `POST /beneficiary-policy/evaluate` بصلاحية `evaluate` الدقيقة؛ واجهة الإعدادات المالية للإدارة العامة + `تقييم مالي` في صلاحيات المستخدمين. لا تصنيف/نقاط (POLICY-C) ولا مستندات (POLICY-D) ولا نطاق/محاكاة/جماعي (POLICY-E) ولا قوائم/فلترة (POLICY-F) ولا إعادة احتساب جماعية ولا حذف حقول/خدمات قديمة؛ `final_policy_decision`/`income_category`/`policy_score`/`score_category` تبقى null. الأدلة: [POLICY_B_IMPLEMENTATION_REPORT](../implementation/POLICY_B_IMPLEMENTATION_REPORT.md) — SQLite 229/1/0 + مجموعتا POLICY-B 56/56 + PostgreSQL QA معزول 26/26 + Pint + ESLint + vitest + build + قبول متصفح 8/8)
  - **POLICY-C — VERIFIED — ACCEPTED — 2026-09-21** (فئات الدخل أ–د على نصيب الفرد الموثوق من POLICY-B وحده: أ 0–400، ب 400.01–600، ج 600.01–800، د 800.01–1000، ومن يتجاوز حد الاستبعاد [1000 افتراضيًا] → `financially_excluded`؛ نقاط التقييم ستة أبعاد بالحد الأقصى 75 من الإعدادات: الدخل/حالة المسكن/ملكية المسكن/إعاقة رب الأسرة/الأطفال المتأثرين/العمر — حدود صحيحة حتمية بالهللة، والبيانات المفقودة → يتطلب مراجعة برموز ثابتة وليست صفرًا صامتًا، ونسبة إعاقة خارجة عن النطاق مرفوضة؛ فئات النقاط أ 51–75/ب 26–50/ج 5–25/د 0–4 مخزنة منفصلة عن فئة الدخل — لا تحويل من الدرجة القديمة إلى أ–د أبدًا؛ استثناءات إصدارية آمنة: `orphan_mother` بسقف [1200 افتراضيًا > حد الاستبعاد] ومراجعة افتراضية (~`exception_review_required`) أو تطبيق تلقائي عند كون الإعداد موثوقًا؛ `PolicyOutcomeService::resolve` بترتيب أولوية ثابت و`final_policy_decision` يبقى null؛ تتضمن اللقطة `scoring_snapshot` و`income_category` و`policy_score` (decimal:4) و`score_category` و`exception_code`/`exception_details`؛ واجهة المسودة بأقسام POLICY-C الأربعة مع ملخص أقصى النقاط وأخطاء ظاهرة تمنع الحفظ. الأدلة: [POLICY_C_IMPLEMENTATION_REPORT](../implementation/POLICY_C_IMPLEMENTATION_REPORT.md) — SQLite 314/1/0 + مجموعات POLICY-C 85/85 + PostgreSQL QA معزول 25/25 + Pint + ESLint + vitest + build + قبول متصفح 25/25 [جميع /api/ عبر وسيط إلى الخادم المعزول — صفر اتصال خارجي])
  - **POLICY-D — VERIFIED — ACCEPTED — 2026-09-22** (المستندات / التحقق من الأدلة / التقييم الاجتماعي / سير العمل الإداري على أساس العقود الموثوقة من POLICY-B وPOLICY-C: قواعد وثائق منظمة (`documents` في إعدادات النسخة مع رموز مسموحة فقط ولا تعبيرات تنفيذية)، سجل التحقق من الوثائق (`verified`/`rejected`/`under_review`/`missing` — لا نسخ ثنائي في اللقطات)، دليل طبي (`verified_disability_percentage` 0..100 حتمي فقط من بيانات موثوقة منظمة — لا اشتقاق من `has_special_needs` أو نص حر)، حالة المسكن (`poor`/`average`/`good`)، منطقة الخدمة (`verified_inside`/`verified_outside`/`review_required`)، علاقة المؤجر (`no_prohibited_relationship`/`prohibited_relationship`/`review_required`)، تقييم اجتماعي منظم (`draft`/`submitted`/`reviewed` مع توصية منظمة وملاحظات محكومة)، سير عمل الموافقة/الرفض (`PolicyApprovalService` → `PolicyDecision` مع رمز سبب ثابت ومرجع أدلة منظم ولا ثنائيات)، الأرملة العامة (`widow`) تبقى `review_required` حتى ثبوت الوثائق عبر `DocumentVerification` ولا يُطبَّق سقف 1200 تلقائيًا؛ جداول منفصلة (`social_assessments`، `document_verifications`، `medical_evidence`، `policy_decisions`) مرتبطة بالتقييم؛ لا تقييم جماعي ولا إعادة احتساب جماعي ولا محاكاة نطاق. الأدلة: [POLICY_D_DOCUMENT_WORKFLOW_AUDIT.md](../implementation/POLICY_D_DOCUMENT_WORKFLOW_AUDIT.md) و[POLICY_D_IMPLEMENTATION_REPORT.md](POLICY_D_IMPLEMENTATION_REPORT.md) — متصفح المراجعة الفعلي 44/44 (صفر اتصال خارجي) + backend 355 ناجح واختبار متجاوز سابقًا /1543 تأكيدًا + PostgreSQL 51/51 /268 تأكيدًا + frontend 56 ناجح + Pint + lint/build + git diff --check نظيف + لا اتصال خارجي ولا نشر ولا نشر.
  - **POLICY-E — VERIFIED — ACCEPTED — 2026-09-23** (E1–E5: ledger, read-only simulation, controlled execution/retry, future registration and real admin/browser integration)
  - **POLICY-F — VERIFIED — ACCEPTED — 2026-09-23** (query-level unified page, server filtering/pagination, authorized complete filtered XLSX export; domains and inventories remain separate)
  - **POLICY-G — VERIFIED — BENEFICIARY POLICY ENGINE ACCEPTED — 2026-09-23** (final cross-policy, PostgreSQL, concurrency, browser/mobile, security and regression acceptance)
- **PDF FINALIZATION — VERIFIED — 2026-09-23** (all existing operational PDF paths audited; safe authorized streaming, local Arabic font/assets, immutable policy history, privacy/QR removal, pagination and PostgreSQL/visual acceptance)
- **GOVERNANCE / REPORTS FINALIZATION — VERIFIED — 2026-09-24** (one authoritative filtered read model for API/Excel/PDF; immutable policy history; current support workflow; separate beneficiary/inventory domains; server pagination; independent view/Excel/PDF permissions; four local chart types; six-width browser acceptance with zero remote requests)
- **PHASE 2C — TAQNYAT — PARTIAL — DECISIONS REQUIRED** (provider code + offline/PostgreSQL acceptance complete; account/template/opt-in/live sandbox pending)
- **FINAL DEPLOYMENT TARGET — MICROSOFT AZURE** (Hostinger متجاوز: HISTORICAL — SUPERSEDED)

## POLICY-D application integration acceptance — 2026-09-22

- Review route: `/admin/beneficiary-policy/review/:evaluationId`, linked from beneficiary details. UI business data and action results come from authenticated evaluation-scoped APIs, not local demonstration state.
- Five independently enforced permissions: `view_documents`, `verify_documents`, `social_assessment`, `review`, `decide`; users administration supports those grants.
- Existing document/social/approval services own transitions and audits. `PolicyDecision` retains the permanent decision; financial/input/scoring snapshots and the evaluation's `final_policy_decision` field remain unchanged.
- The 10/10 System Settings browser smoke is HISTORICAL. Current acceptance executes actual verification, social transitions and decisions through local APIs with zero unexpected remote requests. Required HTTP acceptance tests are included in `php artisan test` automatically.
- Unknown policy ambiguities, under-age exceptions, unresolved orphan proof and more than three affected children remain blocked. No mass recalculation, alternate scoring, simulation or bulk evaluation was introduced.
- Exact current results and verdict: `POLICY_D_IMPLEMENTATION_REPORT.md`. The current amendment supersedes conflicting earlier POLICY-D status/counts and claims that `final_policy_decision` was rewritten.

Required order is now: Notification Coverage Audit (**VERIFIED**) → PDF Finalization (**VERIFIED**) → Governance / Reports Finalization (**VERIFIED**) → UI/UX Finalization → Phase 2C Taqnyat Finalization → Full System Acceptance → Azure Deployment Audit → Azure Production Deployment. No commit, push or deployment occurred in Governance Finalization.

## POLICY-E final acceptance — 2026-09-23

POLICY-E is verified through E1–E5: scoped application ledger, simulation, controlled execution/retry, future-registration integration, Arabic admin UI, and isolated real-API browser acceptance. The E5 gate passed 31/31 with `UNEXPECTED_REMOTE_REQUESTS=0`. POLICY-F remains the next separately authorized phase.

## 17. قرار قناة استعادة كلمة المرور — 2026-09-24

اعتُمدت SMS عبر Taqnyat قناةً وحيدة لاستعادة كلمة المرور برمز OTP من 6 أرقام يُرسل إلى الجوال المسجل للحساب عبر NotificationService → CommunicationService → outbox، مع تحقق ذري وتفويض استعادة قصير العمر بعد نجاح الرمز. **Email password recovery: RETIRED FROM ACTIVE TO-BE** و**WhatsApp password recovery: NOT USED**. تبقى آلية التحقق بأربعة أرقام الخاصة بسندات الاستلام منفصلة تمامًا ودون أي تغيير، وتبقى بنية البريد التحتية محفوظة ككود تاريخي غير مستدعى. القبول موثق باختبارات `PasswordResetOtpTest` (28 حالة) ونسختها على PostgreSQL المحلي QA. لم يُنفذ أي commit أو push أو نشر ضمن هذا القرار.
