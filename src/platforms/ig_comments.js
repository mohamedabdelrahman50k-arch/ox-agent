import axios from 'axios';
import { getAIReply } from '../claude.js';
import { logConversation } from '../sheets.js';
import { getLastCheck, updateLastCheck } from '../utils/lastCheck.js';
import { log, logError } from '../utils/logger.js';

const GRAPH = 'https://graph.facebook.com/v18.0';

// Polls recent Instagram media for new comments and replies to them.
export async function pollInstagramComments() {
  const since = getLastCheck('instagram_comments');
  const token = process.env.META_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_USER_ID;

  try {
    log('Instagram', 'wait', 'فحص التعليقات الجديدة...');

    const mediaRes = await axios.get(`${GRAPH}/${igUserId}/media`, {
      params: {
        fields: 'id,caption,timestamp',
        limit: 10,
        access_token: token,
      },
    });

    const media = mediaRes.data?.data || [];

    for (const item of media) {
      const commentsRes = await axios.get(`${GRAPH}/${item.id}/comments`, {
        params: {
          fields: 'id,text,username,timestamp',
          access_token: token,
        },
      });

      const comments = commentsRes.data?.data || [];

      for (const comment of comments) {
        const createdAt = new Date(comment.timestamp);
        if (createdAt <= since) continue;
        if (!comment.text) continue;

        const username = comment.username || 'متابع';
        log('Instagram', 'ok', `تعليق من ${username}: "${comment.text}"`);

        const reply = await getAIReply('instagram_comments', username, comment.text);
        await replyToComment(comment.id, `@${username} ${reply}`, token);

        await logConversation({
          platform: 'Instagram Comment',
          senderName: username,
          senderId: username,
          message: comment.text,
          reply,
          postUrl: `https://instagram.com/p/${item.id}`,
        });
      }
    }

    updateLastCheck('instagram_comments');
  } catch (err) {
    logError('Instagram', 'فشل فحص التعليقات', err);
  }
}

async function replyToComment(commentId, reply, token) {
  try {
    await axios.post(`${GRAPH}/${commentId}/replies`, {
      message: reply,
      access_token: token,
    });
    log('Instagram', 'ok', 'تم إرسال الرد على التعليق');
  } catch (err) {
    logError('Instagram', 'فشل الرد على التعليق', err);
  }
}
