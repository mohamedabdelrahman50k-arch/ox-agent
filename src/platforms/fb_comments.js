import axios from 'axios';
import { getAIReply } from '../claude.js';
import { logConversation } from '../sheets.js';
import { getLastCheck, updateLastCheck } from '../utils/lastCheck.js';
import { log, logError } from '../utils/logger.js';

const GRAPH = 'https://graph.facebook.com/v18.0';

// Polls recent Facebook page posts for new comments and replies to them.
export async function pollFacebookComments() {
  const since = getLastCheck('facebook_comments');
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  try {
    log('Facebook', 'wait', 'فحص التعليقات الجديدة...');

    const postsRes = await axios.get(`${GRAPH}/me/posts`, {
      params: {
        fields: 'id,message,created_time',
        limit: 10,
        access_token: token,
      },
    });

    const posts = postsRes.data?.data || [];

    for (const post of posts) {
      const commentsRes = await axios.get(`${GRAPH}/${post.id}/comments`, {
        params: {
          fields: 'id,message,from,created_time',
          filter: 'stream',
          access_token: token,
        },
      });

      const comments = commentsRes.data?.data || [];

      for (const comment of comments) {
        const createdAt = new Date(comment.created_time);
        if (createdAt <= since) continue;
        // Skip the page's own comments.
        if (comment.from?.id && comment.from.id === pageId) continue;
        if (!comment.message) continue;

        const senderName = comment.from?.name || 'متابع';
        log('Facebook', 'ok', `تعليق من ${senderName}: "${comment.message}"`);

        const reply = await getAIReply('facebook_comments', senderName, comment.message);
        await replyToComment(comment.id, reply, token);

        await logConversation({
          platform: 'Facebook Comment',
          senderName,
          senderId: comment.from?.id || '',
          message: comment.message,
          reply,
          postUrl: `https://facebook.com/${post.id}`,
        });
      }
    }

    updateLastCheck('facebook_comments');
  } catch (err) {
    logError('Facebook', 'فشل فحص التعليقات', err);
  }
}

async function replyToComment(commentId, reply, token) {
  try {
    await axios.post(`${GRAPH}/${commentId}/replies`, {
      message: reply,
      access_token: token,
    });
    log('Facebook', 'ok', 'تم إرسال الرد على التعليق');
  } catch (err) {
    logError('Facebook', 'فشل الرد على التعليق', err);
  }
}
