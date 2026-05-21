import axios from 'axios';
import { getAIReply } from '../claude.js';
import { logConversation, getConversationHistory } from '../sheets.js';
import { log, logError } from '../utils/logger.js';

const GRAPH = 'https://graph.facebook.com/v18.0';

// GET /webhook/instagram — Meta webhook verification handshake.
export function verifyInstagram(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    log('Instagram DM', 'ok', 'تم التحقق من الـ webhook');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

// POST /webhook/instagram — incoming Instagram direct messages.
export async function handleInstagram(req, res) {
  res.sendStatus(200);

  try {
    const messaging = req.body?.entry?.[0]?.messaging?.[0];
    const message = messaging?.message;

    if (!message || message.is_echo || !message.text) return;

    const senderId = messaging.sender?.id;
    const messageText = message.text;
    const senderName = await fetchSenderName(senderId);

    log('Instagram DM', 'ok', `رسالة من ${senderName}: "${messageText}"`);

    const history = await getConversationHistory(senderId);
    const reply = await getAIReply('instagram_dm', senderName, messageText, history);

    await logConversation({
      platform: 'Instagram DM',
      senderName,
      senderId,
      message: messageText,
      reply,
    });

    await sendInstagramReply(senderId, reply);
  } catch (err) {
    logError('Instagram DM', 'فشل معالجة الرسالة', err);
  }
}

async function fetchSenderName(senderId) {
  try {
    const res = await axios.get(`https://graph.facebook.com/${senderId}`, {
      params: { fields: 'name', access_token: process.env.META_ACCESS_TOKEN },
    });
    return res.data?.name || 'عميل';
  } catch {
    return 'عميل';
  }
}

async function sendInstagramReply(senderId, reply) {
  try {
    await axios.post(
      `${GRAPH}/me/messages`,
      {
        recipient: { id: senderId },
        message: { text: reply },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    log('Instagram DM', 'ok', 'تم إرسال الرد');
  } catch (err) {
    logError('Instagram DM', 'فشل إرسال الرد', err);
  }
}
