import axios from 'axios';
import { getAIReply } from '../claude.js';
import { logConversation, getConversationHistory } from '../sheets.js';
import { log, logError } from '../utils/logger.js';

const GRAPH = 'https://graph.facebook.com/v18.0';

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

// POST /webhook/whatsapp — incoming WhatsApp messages.
export async function handleWhatsApp(req, res) {
  // Acknowledge immediately so Meta doesn't retry.
  res.sendStatus(200);

  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    // Ignore status updates and non-text messages.
    if (!message || message.type !== 'text') return;

    const senderId = message.from;
    const messageText = message.text?.body || '';
    const senderName = value?.contacts?.[0]?.profile?.name || 'عميل';

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
