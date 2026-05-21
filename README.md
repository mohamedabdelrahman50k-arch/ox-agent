# OX Agent 🤖

وكيل ذكاء اصطناعي (AI Agent) يرد تلقائياً على الرسائل والتعليقات عبر كل المنصات
الاجتماعية، ويسجّل كل المحادثات في Google Sheets.

مبني على **Claude** من Anthropic، ويدعم:

| المنصة | الطريقة | الفترة |
| --- | --- | --- |
| WhatsApp Business | Webhook | فوري |
| Facebook Messenger | Webhook | فوري |
| Instagram DM | Webhook | فوري |
| Facebook Comments | Polling | كل 5 دقائق |
| Instagram Comments | Polling | كل 5 دقائق |
| TikTok Comments | Polling | كل 5 دقائق |
| X/Twitter Mentions | Polling | كل 5 دقائق |
| YouTube Comments | Polling | كل 10 دقائق |
| Google Sheets | تسجيل | لكل محادثة |

---

## 🏢 عن المشروع

OX Group تضم شركتين:

1. **Caravanox** — الإنشاءات المعدنية والمباني الجاهزة والكرافانات
2. **Kitchenox** — المطابخ والتجهيزات

الـ Agent يرد بلغة العميل (عربي/إنجليزي)، ويوجّه الاستفسارات الجدية لفريق المبيعات،
ويرفع علامة "⚠️ يحتاج متابعة بشرية" عند طلب التحدث مع موظف.

---

## 📋 المتطلبات

- **Node.js 18+**
- حسابات على:
  - Meta Business (WhatsApp + Messenger + Instagram)
  - Google Cloud (Sheets API + YouTube Data API v3)
  - TikTok Developer
  - Twitter/X Developer
- مفتاح **Anthropic API**

---

## ⚙️ خطوات الإعداد

### 1. Google Service Account

1. أنشئ Project في [Google Cloud Console](https://console.cloud.google.com).
2. فعّل **Google Sheets API** و **YouTube Data API v3**.
3. أنشئ **Service Account** وحمّل ملف الـ JSON.
4. من ملف الـ JSON خذ `client_email` و `private_key` وضعهما في `.env`.
5. أنشئ Google Sheet جديد وشاركه مع الـ Service Account Email (صلاحية "محرر").
6. خذ الـ Sheet ID من رابط الجدول وضعه في `GOOGLE_SHEET_ID`.

> ملاحظة: عند نسخ `GOOGLE_PRIVATE_KEY` ضعه بين علامتي اقتباس واترك `\n` كما هي —
> الكود يحوّلها تلقائياً إلى أسطر جديدة.

### 2. Meta Developer App

1. أنشئ App من نوع **Business** في [developers.facebook.com](https://developers.facebook.com).
2. أضف المنتجات: **Messenger** + **Instagram** + **WhatsApp**.
3. احصل على **Page Access Token** طويل الأمد (`META_ACCESS_TOKEN`).
4. لـ WhatsApp: احصل على `WHATSAPP_PHONE_NUMBER_ID` و `WHATSAPP_ACCESS_TOKEN`.
5. ضع `FACEBOOK_PAGE_ID` و `INSTAGRAM_USER_ID`.
6. اضبط الـ Webhooks بعد تشغيل الـ server (انظر القسم في الأسفل).

### 3. YouTube OAuth

1. من نفس Google Cloud Project أنشئ **OAuth 2.0 Client ID**.
2. استخدم [OAuth Playground](https://developers.google.com/oauthplayground) للحصول
   على **Refresh Token** مع صلاحية `https://www.googleapis.com/auth/youtube.force-ssl`.
3. املأ `YOUTUBE_CLIENT_ID` و `YOUTUBE_CLIENT_SECRET` و `YOUTUBE_REFRESH_TOKEN` و
   `YOUTUBE_CHANNEL_ID`.

### 4. TikTok Developer

1. أنشئ App في [developers.tiktok.com](https://developers.tiktok.com).
2. اطلب صلاحية **Comment API** (تحتاج موافقة من TikTok).
3. احصل على **Access Token** وضعه في `TIKTOK_ACCESS_TOKEN`.

### 5. Twitter/X Developer

1. أنشئ App في [developer.twitter.com](https://developer.twitter.com).
2. مطلوب **Basic Plan** (حوالي 100$/شهر) للوصول لمنشنز الـ API.
3. احصل على المفاتيح الأربعة: `TWITTER_API_KEY` و `TWITTER_API_SECRET` و
   `TWITTER_ACCESS_TOKEN` و `TWITTER_ACCESS_SECRET`، بالإضافة لـ `TWITTER_USER_ID`.

---

## 🚀 التشغيل المحلي

```bash
npm install
cp .env.example .env
# املأ .env بالبيانات
npm run dev
```

- `npm run dev` — تشغيل مع إعادة التحميل التلقائي (`node --watch`).
- `npm start` — تشغيل عادي.

تحقق من الحالة عبر: `http://localhost:3000/health`

---

## ☁️ النشر على Railway

1. ارفع الكود على GitHub.
2. اربط [Railway](https://railway.app) بالـ repo.
3. أضف كل متغيرات البيئة من `.env` في إعدادات Railway.
4. انشر، وخذ الـ URL العام لاستخدامه في الـ Webhooks.

---

## 🔗 إعداد Webhooks في Meta

في إعدادات الـ App على Meta، أضف الـ Callback URLs التالية:

| المنتج | Callback URL |
| --- | --- |
| WhatsApp | `https://your-url.railway.app/webhook/whatsapp` |
| Messenger | `https://your-url.railway.app/webhook/messenger` |
| Instagram | `https://your-url.railway.app/webhook/instagram` |

- **Verify Token**: نفس قيمة `META_VERIFY_TOKEN` في ملف `.env`.
- بعد التحقق، فعّل الاشتراك في حقول مثل `messages` و `comments`.

---

## 📊 Google Sheet

يُنشئ الـ Agent تلقائياً صفحة باسم `Conversations` مع الأعمدة:

```
التاريخ | الوقت | المنصة | اسم العميل | معرف العميل | الرسالة | الرد | الحالة | رابط المنشور
```

نقطة `/health` ترجع إحصائيات مباشرة:

```json
{
  "status": "OK",
  "stats": { "total": 0, "byPlatform": {}, "needsHuman": 0, "today": 0 }
}
```

---

## 🗂️ هيكل المشروع

```
ox-agent/
├── src/
│   ├── server.js          # Express + جدولة الـ polling
│   ├── claude.js          # تكامل Claude والـ system prompts
│   ├── sheets.js          # التسجيل في Google Sheets
│   ├── platforms/         # منطق كل منصة
│   └── utils/             # logger / formatter / lastCheck
├── .env.example
├── package.json
└── README.md
```

---

## 🛡️ معالجة الأخطاء

- فشل أي دالة polling يُسجَّل ولا يوقف الـ server.
- فشل Claude يرجع رد بديل: «عذراً، حدث خطأ مؤقت. سنتواصل معك قريباً 🙏».
- فشل الإرسال يُسجَّل دون إيقاف باقي المعالجة.
