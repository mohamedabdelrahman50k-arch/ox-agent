import Anthropic from '@anthropic-ai/sdk';
import { log, logError } from './utils/logger.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';
const MAX_TOKENS = 1024;

const BASE_PROMPT = `أنت مساعد OX Group الذكي والاحترافي.
OX Group تضم شركتين:
1. Caravanox: متخصصة في الإنشاءات المعدنية والمباني الجاهزة والكرافانات
2. Kitchenox: متخصصة في المطابخ والتجهيزات

قواعد عامة:
- رد دائماً بنفس لغة العميل (عربي أو إنجليزي)
- كن ودوداً ومهنياً
- لا تختلق أسعاراً أو معلومات غير موجودة
- إذا كتب العميل "تحدث مع موظف" أو "human" أو "موظف":
  أجب بـ "سيتواصل معك أحد ممثلينا قريباً ✅"`;

const PLATFORM_PROMPTS = {
  whatsapp: `رسالة خاصة - رد مفصل ومهني (3-5 جمل).
إذا سأل عن أسعار: اطلب تفاصيل المشروع (النوع، المساحة، الموقع)
ثم قل سيتواصل معك فريق المبيعات.`,
  messenger: `رسالة خاصة - رد مفصل ومهني (3-5 جمل).
إذا سأل عن أسعار: اطلب تفاصيل المشروع (النوع، المساحة، الموقع)
ثم قل سيتواصل معك فريق المبيعات.`,
  instagram_dm: `رسالة خاصة - رد مفصل ومهني (3-5 جمل).
إذا سأل عن أسعار: اطلب تفاصيل المشروع (النوع، المساحة، الموقع)
ثم قل سيتواصل معك فريق المبيعات.`,
  facebook_comments: `تعليق عام على منشور - رد قصير وجذاب (جملتان).
استخدم emoji مناسب واحد.
لو استفسار جدي قل: تواصل معنا على الواتساب للحصول على عرض سعر مجاني 👇`,
  instagram_comments: `تعليق عام على منشور - رد قصير وجذاب (جملتان).
استخدم emoji مناسب واحد.
لو استفسار جدي قل: تواصل معنا على الواتساب للحصول على عرض سعر مجاني 👇`,
  tiktok: `تعليق على TikTok - رد قصير جداً وجذاب (جملة واحدة).
استخدم emoji واحد.
وجّه للواتساب أو الـ DM للتفاصيل.`,
  youtube: `تعليق على YouTube - رد مفيد ومهني (2-3 جمل).
لو سؤال تقني أجب عليه.
لو سعر أو مشروع وجّه للواتساب أو الـ DM.`,
  twitter: `تغريدة أو رد على X/تويتر - رد قصير جداً (أقل من 250 حرف).
استخدم emoji واحد فقط.
وجّه للواتساب للتفاصيل.`,
};

const ERROR_REPLY = 'عذراً، حدث خطأ مؤقت. سنتواصل معك قريباً 🙏';

function buildSystemPrompt(platform) {
  const platformPrompt = PLATFORM_PROMPTS[platform] || '';
  return `${BASE_PROMPT}\n\n---\n${platformPrompt}`;
}

/**
 * Generate an AI reply for a given platform and message.
 * @param {string} platform - one of the PLATFORM_PROMPTS keys
 * @param {string} senderName - display name of the sender
 * @param {string} messageText - the incoming message/comment text
 * @param {Array<{role:'user'|'assistant', content:string}>} conversationHistory
 * @returns {Promise<string>} the reply text
 */
export async function getAIReply(platform, senderName, messageText, conversationHistory = []) {
  const start = Date.now();
  try {
    const history = conversationHistory.slice(-10);
    const messages = [
      ...history,
      {
        role: 'user',
        content: senderName ? `${senderName}: ${messageText}` : messageText,
      },
    ];

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(platform),
      messages,
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    log('Claude', 'ok', `رد جاهز (${seconds}s)`);

    return reply || ERROR_REPLY;
  } catch (err) {
    logError('Claude', 'فشل توليد الرد', err);
    return ERROR_REPLY;
  }
}
