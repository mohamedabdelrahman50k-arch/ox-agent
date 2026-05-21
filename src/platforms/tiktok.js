import axios from 'axios';
import { getAIReply } from '../claude.js';
import { logConversation } from '../sheets.js';
import { getLastCheck, updateLastCheck } from '../utils/lastCheck.js';
import { log, logError } from '../utils/logger.js';

const API = 'https://open.tiktokapis.com/v2';

// Polls recent TikTok videos for new comments and replies to them.
export async function pollTikTokComments() {
  const since = getLastCheck('tiktok');
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  const authHeaders = { Authorization: `Bearer ${token}` };

  try {
    log('TikTok', 'wait', 'فحص التعليقات الجديدة...');

    const videosRes = await axios.post(
      `${API}/video/list/`,
      { max_count: 20 },
      { headers: authHeaders, params: { fields: 'id,title,create_time' } }
    );

    const videos = videosRes.data?.data?.videos || [];

    for (const video of videos) {
      const commentsRes = await axios.get(`${API}/research/video/comment/list/`, {
        headers: authHeaders,
        params: { video_id: video.id, count: 20 },
      });

      const comments = commentsRes.data?.data?.comments || [];

      for (const comment of comments) {
        // TikTok returns create_time as a UNIX timestamp (seconds).
        const createdAt = new Date((comment.create_time || 0) * 1000);
        if (createdAt <= since) continue;
        const text = comment.text || '';
        if (!text) continue;

        const username = comment.username || comment.user?.username || 'متابع';
        log('TikTok', 'ok', `تعليق من ${username}: "${text}"`);

        const reply = await getAIReply('tiktok', username, text);
        await replyToComment(video.id, comment.id, reply, authHeaders);

        await logConversation({
          platform: 'TikTok Comment',
          senderName: username,
          senderId: comment.user?.id || username,
          message: text,
          reply,
          postUrl: `https://tiktok.com/video/${video.id}`,
        });
      }
    }

    updateLastCheck('tiktok');
  } catch (err) {
    logError('TikTok', 'فشل فحص التعليقات', err);
  }
}

async function replyToComment(videoId, commentId, reply, authHeaders) {
  try {
    await axios.post(
      `${API}/comment/reply/`,
      { video_id: videoId, comment_id: commentId, text: reply },
      { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
    );
    log('TikTok', 'ok', 'تم إرسال الرد على التعليق');
  } catch (err) {
    logError('TikTok', 'فشل الرد على التعليق', err);
  }
}
