import { TwitterApi } from 'twitter-api-v2';
import { getAIReply } from '../claude.js';
import { logConversation } from '../sheets.js';
import { getLastCheck, updateLastCheck } from '../utils/lastCheck.js';
import { log, logError } from '../utils/logger.js';
import { truncate } from '../utils/formatter.js';

let client = null;

function getClient() {
  if (client) return client;
  client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
  return client;
}

// Polls mentions of our account and replies to each new one.
export async function pollTwitterMentions() {
  const since = getLastCheck('twitter');
  const userId = process.env.TWITTER_USER_ID;

  try {
    log('Twitter', 'wait', 'فحص المنشنز الجديدة...');
    const twitter = getClient();

    const mentions = await twitter.v2.userMentionTimeline(userId, {
      start_time: since.toISOString(),
      'tweet.fields': ['author_id', 'text', 'created_at'],
      expansions: ['author_id'],
      'user.fields': ['name', 'username'],
    });

    const tweets = mentions.data?.data || [];
    const users = mentions.data?.includes?.users || [];
    const userById = new Map(users.map((u) => [u.id, u]));

    for (const tweet of tweets) {
      // Skip our own tweets.
      if (tweet.author_id === userId) continue;

      const author = userById.get(tweet.author_id);
      const name = author?.name || author?.username || 'متابع';

      log('Twitter', 'ok', `منشن من ${name}: "${tweet.text}"`);

      let reply = await getAIReply('twitter', name, tweet.text);
      reply = truncate(reply, 280);

      await replyToTweet(twitter, reply, tweet.id);

      await logConversation({
        platform: 'X (Twitter)',
        senderName: name,
        senderId: tweet.author_id,
        message: tweet.text,
        reply,
        postUrl: `https://x.com/i/web/status/${tweet.id}`,
      });
    }

    updateLastCheck('twitter');
  } catch (err) {
    logError('Twitter', 'فشل فحص المنشنز', err);
  }
}

async function replyToTweet(twitter, reply, tweetId) {
  try {
    await twitter.v2.reply(reply, tweetId);
    log('Twitter', 'ok', 'تم إرسال الرد');
  } catch (err) {
    logError('Twitter', 'فشل إرسال الرد', err);
  }
}
