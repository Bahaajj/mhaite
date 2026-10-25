إعداد وتشغيل لوحة إدارة البلدية
================================

الملفات:
- admin.html: واجهة الإدارة.
- admin.js: تسجيل الدخول، قراءة الجداول، البحث، الفلترة، تعديل الحالة، ونشر الأخبار.

طريقة التركيب:
1) احتفظ بنسخة احتياطية من ملفي admin.html وadmin.js الحاليين.
2) استبدل محتوى admin.html وadmin.js بالملفين الموجودين في هذه الحزمة.
3) ضع الملفين في المجلد نفسه الذي يحتوي على style.css وindex.html.
4) افتح الموقع عبر خادم محلي أو استضافة HTTPS، وليس من الضروري فتح HTML مباشرة عبر file://.
5) أنشئ حساب الموظف من Supabase Dashboard > Authentication > Users، أو استخدم حسابًا موجودًا.
6) اختبر تسجيل الدخول، ثم افحص Console وNetwork في أدوات المطور إذا ظهر خطأ.

افتراضات يجب التحقق منها قبل اعتبار النظام جاهزًا:
- الجداول الموجودة: citizen_submissions وcitizen_messages وpublic_news.
- citizen_submissions يحتوي على عمود id (مفتاح أساسي)، وcreated_at، وstatus. إذا كان اسم المفتاح الأساسي مختلفًا، غيّر SUBMISSION_ID_COLUMN في admin.js إلى اسمه الصحيح.
- citizen_submissions قد يحتوي على: reference_code, full_name, phone, email, kind, request_type, complaint_type, details, attachments.
- citizen_messages قد يحتوي على: name, email, phone, message, created_at.
- public_news قد يحتوي على: title, summary, published_at, created_by.
- قيم الحالة المعتمدة في citizen_submissions هي pending وin_progress وcompleted. إذا كانت قاعدة البيانات تستخدم قيمًا مختلفة، يجب توحيدها في الكود وقاعدة البيانات.

صلاحيات Supabase / RLS:
- لا تعطّل RLS لجعل الواجهة تعمل.
- يجب أن تسمح السياسات للمستخدم الإداري الموثّق بقراءة الجداول اللازمة، وتحديث status في citizen_submissions، وإضافة الأخبار إلى public_news.
- لا تضع service_role key في HTML أو JavaScript. المفتاح الموجود في الواجهة يجب أن يكون مفتاحًا عامًا publishable/anon فقط.
- الأفضل تقييد السياسات إلى حسابات الموظفين/دور إداري، لا إلى كل مستخدم مسجّل. لا يمكن كتابة سياسة آمنة نهائية من دون معرفة آلية تمييز حساب الموظف عندك.

المرفقات:
- الكود يفتح attachment.url أو signedUrl أو signed_url، أو path إذا كان رابط HTTP(S) كاملًا.
- إذا كان attachment.path مسارًا داخل Supabase Storage وليس رابطًا عامًا، يحتاج إنشاء signed URL من اسم الـ bucket والمسار الصحيحين. لم يتم تخمين اسم الـ bucket حتى لا تنكسر الصلاحيات أو تنكشف ملفات خاصة.

حدود التحقق:
- الكود أُعدّ بناءً على أسماء الجداول والأعمدة الظاهرة في الكود الذي أرسلته، ولم يتم الاتصال بمشروع Supabase أو اختبار قاعدة بياناتك الفعلية. لذلك يجب التحقق من أسماء الأعمدة وسياسات RLS قبل الاستخدام الحقيقي.

ميزات إضافية ضمن النسخة المحدّثة:
- news.html وnews.js: صفحة عامة للأخبار، تصنيفات، صور، وتفاصيل مستقلة لكل خبر عبر رابط news.html?id=...
- admin.js: نموذج نشر الأخبار يدعم التصنيف والصورة (حد أقصى 5MB) وحذف الخبر.
- public-attachments.js: دالة مساعدة لرفع ملفات المواطن فعليًا إلى Storage وحفظ مساراتها في عمود attachments. يجب دمجها في JavaScript الخاص بنموذج المواطن؛ إضافة اسم الملف كنص وحده لا ترفع الملف.
- SETUP-SUPABASE.sql: إضافة أعمدة الأخبار وسياسات/ملاحظات التخزين. راجع السياسات الموجودة قبل تشغيلها، لأن تكرار أسماء السياسات يؤدي إلى خطأ.

إعداد الأخبار:
1) نفّذ بعناية أوامر ALTER TABLE الخاصة بجدول public_news في SETUP-SUPABASE.sql.
2) من Supabase > Storage أنشئ bucket باسم public-news-images واجعله Public للصور فقط.
3) أنشئ bucket باسم municipality-submissions واجعله Private لمستندات المواطنين.
4) راجع سياسات RLS قبل النشر الحقيقي. السياسات العامة في المثال تحتاج تشديدًا بحسب حسابات الموظفين، ولا ينبغي اعتبارها نموذج صلاحيات نهائيًا.
5) ضع news.html وnews.js بجانب style.css وindex.html وadmin.html.
6) أضف رابطًا إلى news.html في قائمة التنقل بصفحة index.html إذا أردت إظهاره للزوار.

رفع مرفقات المواطنين (مهم):
- أضف <input type="file" id="attachments" multiple accept=".pdf,image/jpeg,image/png,image/webp"> إلى نموذج المواطن.
- حمّل public-attachments.js بعد مكتبة Supabase وبعد إنشاء عميل Supabase في صفحة المواطن.
- قبل إدخال سجل المواطن، نفّذ: const attachments = await window.uploadCitizenAttachments(document.querySelector('#attachments').files, supabaseClient);
- أدرج قيمة attachments نفسها في سجل citizen_submissions. ستُحفظ مصفوفة JSON فيها name/path/size/type، وليس محتوى الملف كنص.
- اسم الـ bucket في دالة الرفع يجب أن يطابق municipality-submissions. لوحة الإدارة تنشئ رابطًا موقّتًا مدته 5 دقائق لفتح الملف.
- لم يتم تعديل نموذج المواطن نفسه لأن ملفه/كوده غير موجود ضمن الملفات التي أرسلتها. لا تعتبر رفع الملفات مكتملًا حتى تدمج الدالة في النموذج وتختبر إرسال PDF فعلي وفتحه من لوحة الإدارة.

ملاحظة تحقق:
هذه الحزمة لم تتصل بمشروع Supabase الحقيقي. يجب التأكد من أن public_news لديه مفتاح id، وأن created_by يقبل user UUID، وأن attachments نوعه json/jsonb، وأن سياسات RLS الحالية متوافقة. لا تشغّل سياسات SQL دون مراجعتها أولًا.
