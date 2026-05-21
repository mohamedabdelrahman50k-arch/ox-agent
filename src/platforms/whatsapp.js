import axios from 'axios';
import crypto from 'crypto';
import { getAIReply } from '../claude.js';
import { logConversation, getConversationHistory } from '../sheets.js';
import { log, logError } from '../utils/logger.js';

const GRAPH = 'https://graph.facebook.com/v18.0';

// Verify Meta's X-Hub-Signature-256 against the raw request body.
// Skipped when META_APP_SECRET is unset (local development).
function verifyMetaSignature(req) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true;

  const signature = req.get('x-hub-signature-256');
  if (!signature || !req.rawBody) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');

  const received = Buffer.from(signature);
  const computed = Buffer.from(expected);
  return (
    received.length === computed.length &&
    crypto.timingSafeEqual(received, computed)
  );
}

// GET /webhook/whatsapp — Meta webhook verification handshake.
export function verifyWhatsApp(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    log('WhatsApp', 'ok', 'تم التحقق من الـ webhook');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

// POST /webhook/whatsapp — incoming WhatsApp messages, statuses and receipts.
export async function handleWhatsApp(req, res) {
  // Reject forged payloads before doing any work.
  if (!verifyMetaSignature(req)) {
    logError('WhatsApp', 'توقيع غير صالح للـ webhook (X-Hub-Signature-256)');
    return res.sendStatus(403);
  }

  // Acknowledge immediately so Meta doesn't retry.
  res.sendStatus(200);

  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (!value) return;

    // Delivery / read / sent / failed receipts arrive under `statuses`.
    if (Array.isArray(value.statuses) && value.statuses.length > 0) {
      for (const s of value.statuses) {
        log('WhatsApp', 'ok', `حالة الرسالة ${s.id}: ${s.status}`);
      }
      return;
    }

    const message = value.messages?.[0];
    if (!message) return;

    // Non-text messages (image, audio, location, etc.) — acknowledge and skip.
    if (message.type !== 'text') {
      log('WhatsApp', 'wait', `نوع رسالة غير مدعوم: ${message.type}`);
      return;
    }

    const senderId = message.from;
    const messageText = message.text?.body || '';
    const senderName = value.contacts?.[0]?.profile?.name || 'عميل';

    log('WhatsApp', 'ok', `رسالة من ${senderName}: "${messageText}"`);

    const history = await getConversationHistory(senderId);
    const reply = await getAIReply('whatsapp', senderName, messageText, history);

    await logConversation({
      platform: 'WhatsApp',
      senderName,
      senderId,
      message: messageText,
      reply,
    });

    await sendWhatsAppReply(senderId, reply);
  } catch (err) {
    logError('WhatsApp', 'فشل معالجة الرسالة', err);
  }
}

async function sendWhatsAppReply(to, reply) {
  try {
    await axios.post(
      `${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: reply },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    log('WhatsApp', 'ok', 'تم إرسال الرد');
  } catch (err) {
    logError('WhatsApp', 'فشل إرسال الرد', err);
  }
}
