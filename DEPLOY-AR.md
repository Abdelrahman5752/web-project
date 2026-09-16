# النشر المجاني على Render + Neon

## ما تغير؟

المشروع يدعم طريقتين: SQLite على جهازك، وPostgreSQL على Neon عند تعيين `DATABASE_URL`. ينشئ الجداول والمنتجات تلقائيًا عند التشغيل. الحسابات والطلبات المحلية لا تُنقل تلقائيًا إلى Neon؛ النسخة المنشورة تبدأ بحسابات جديدة.

## 1. Neon

من لوحة المشروع اضغط **Connect**، اختر فرع `production` وقاعدة البيانات والدور الافتراضيين. استخدم رابط **Connection string**، ويفضل تفعيل **Connection pooling** إن ظهر الخيار. انسخ رابط PostgreSQL نفسه بدون الأمر `psql` وبدون علامات الاقتباس المحيطة.

الرابط يحتوي كلمة مرور: لا تضفه إلى GitHub أو الصور أو المحادثات. سيُحفظ فقط في متغير سري على Render.

## 2. Render

سجّل في Render، ثم اختر **New → Web Service** واربط مستودع `Abdelrahman5752/web-project`.

| الخانة | القيمة |
|---|---|
| Branch | main |
| Language / Runtime | Node |
| Root Directory | اتركها فارغة |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

اختر منطقة قريبة من منطقة مشروع Neon قدر الإمكان. لا تنشئ قاعدة Render مدفوعة أو تضف قرصًا مدفوعًا.

أضف **Environment Variables** التالية:

| الاسم | القيمة |
|---|---|
| `DATABASE_URL` | رابط Neon السري المنسوخ من Connect |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `HOST` | `0.0.0.0` |

لا تحتاج `APP_ORIGIN` لرابط Render الافتراضي؛ الكود يستخدم `RENDER_EXTERNAL_URL` الذي توفره Render تلقائيًا. لو استخدمت نطاقًا مختلفًا عيّن `APP_ORIGIN` لرابط HTTPS الكامل بدون مسار أو شرطة مائلة نهائية.

بديل: ملف `render.yaml` يحتوي نفس الإعدادات ويمكن استخدامه عبر **New → Blueprint**، وسيطلب رابط قاعدة البيانات كمتغير سري.

بعد التأكد من اختيار Free، ابدأ إنشاء الخدمة وانتظر حالة Live. رابط الموقع ينتهي بـ `onrender.com`.

## 3. التحقق بعد النشر

1. افتح `/api/health` على رابط الموقع وتأكد من ظهور `{"ok":true}`.
2. أنشئ حسابًا تجريبيًا جديدًا.
3. أضف منتجًا، وسجّل الطلب، وراجع My orders.
4. جرّب الخروج والدخول وإرسال رسالة تواصل.
5. بعد إعادة تشغيل خدمة Render، سجّل الدخول وتأكد من بقاء الطلب؛ البيانات محفوظة في Neon.

الاستضافة المجانية على Render تتوقف عند الخمول، لذلك قد تتأخر أول زيارة. حدود الخطط قد تتغير؛ راجع صفحة الاستخدام لكل خدمة. لا توجد بوابة دفع فعلية في المشروع.

## التشغيل المحلي بعد التحديث

نفّذ `npm ci` مرة بعد تحميل هذه النسخة، ثم `npm start` أو `Start-Local.cmd`. بدون `DATABASE_URL` يستخدم المشروع SQLite المحلية كما سبق. `npm test` يشغّل اختبارات SQLite واختبارات محرك PostgreSQL محلي PGlite؛ لا يحتاج حساب Neon ولا يتصل به.

## في حالة الخطأ

- `Database initialization failed`: راجع DATABASE_URL وأعد نسخه بدون `psql` أو اقتباسات وتأكد من نشاط Neon. لا تنشر قيمة الرابط في السجلات أو الصور.
- `Request origin is not allowed`: افتح رابط Render الأصلي، أو صحح APP_ORIGIN لو استخدمت نطاقًا مخصصًا.
- تعارض منفذ محلي: أوقف النسخة السابقة أو غيّر PORT.

المراجع: https://render.com/docs/free — https://render.com/docs/web-services — https://neon.com/docs/connect/connect-from-any-app
