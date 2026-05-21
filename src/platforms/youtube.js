import { google } from 'googleapis';
import { getAIReply } from '../claude.js';
import { logConversation } from '../sheets.js';
import { getLastCheck, updateLastCheck } from '../utils/lastCheck.js';
import { log, logError } from '../utils/logger.js';

let youtubeClient = null;

function getYouTube() {
  if (youtubeClient) return youtubeClient;

  const oauth2 = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

  youtubeClient = google.youtube({ version: 'v3', auth: oauth2 });
  return youtubeClient;
}

// Polls recent uploads for new comments and replies to them.
export async function pollYouTubeComments() {
  const since = getLastCheck('youtube');
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  try {
    log('YouTube', 'wait', 'فحص التعليقات الجديدة...');
    const youtube = getYouTube();

    const search = await youtube.search.list({
      part: ['id'],
      forMine: true,
      type: ['video'],
      maxResults: 10,
    });

    const videoIds = (search.data.items || [])
      .map((item) => item.id?.videoId)
      .filter(Boolean);

    for (const videoId of videoIds) {
      let threads;
      try {
        threads = await youtube.commentThreads.list({
          part: ['snippet'],
          videoId,
          moderationStatus: 'published',
          order: 'time',
          maxResults: 20,
        });
      } catch (err) {
        // Comments may be disabled on a video — skip it.
        logError('YouTube', `تعذر جلب تعليقات الفيديو ${videoId}`, err);
        continue;
      }

      const items = threads.data.items || [];

      for (const item of items) {
        const top = item.snippet?.topLevelComment;
        const snippet = top?.snippet;
        if (!snippet) continue;

        const publishedAt = new Date(snippet.publishedAt);
        if (publishedAt <= since) continue;
        // Skip our own channel's comments.
        if (snippet.authorChannelId?.value === channelId) continue;

        const authorName = snippet.authorDisplayName || 'مشاهد';
        const text = snippet.textOriginal || '';
        if (!text) continue;

        log('YouTube', 'ok', `تعليق من ${authorName}: "${text}"`);

        const reply = await getAIReply('youtube', authorName, text);
        await replyToComment(youtube, top.id, reply);

        await logConversation({
          platform: 'YouTube Comment',
          senderName: authorName,
          senderId: snippet.authorChannelId?.value || '',
          message: text,
          reply,
          postUrl: `https://youtube.com/watch?v=${videoId}`,
        });
      }
    }

    updateLastCheck('youtube');
  } catch (err) {
    logError('YouTube', 'فشل فحص التعليقات', err);
  }
}

async function replyToComment(youtube, parentId, reply) {
  try {
    await youtube.comments.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          parentId,
          textOriginal: reply,
        },
      },
    });
    log('YouTube', 'ok', 'تم إرسال الرد على التعليق');
  } catch (err) {
    logError('YouTube', 'فشل الرد على التعليق', err);
  }
}
