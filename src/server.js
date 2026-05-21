import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';

import { initializeSheet, getStats } from './sheets.js';
import { log, logError } from './utils/logger.js';

import { verifyWhatsApp, handleWhatsApp } from './platforms/whatsapp.js';
import { verifyMessenger, handleMessenger } from './platforms/messenger.js';
import { verifyInstagram, handleInstagram } from './platforms/instagram_dm.js';
import { pollFacebookComments } from './platforms/fb_comments.js';
import { pollInstagramComments } from './platforms/ig_comments.js';
import { pollTikTokComments } from './platforms/tiktok.js';
import { pollTwitterMentions } from './platforms/twitter.js';
import { pollYouTubeComments } from './platforms/youtube.js';

const PORT = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health & stats
app.get('/health', async (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    stats: await getStats(),
  });
});

// WhatsApp
app.get('/webhook/whatsapp', verifyWhatsApp);
app.post('/webhook/whatsapp', handleWhatsApp);

// Messenger
app.get('/webhook/messenger', verifyMessenger);
app.post('/webhook/messenger', handleMessenger);

// Instagram DM
app.get('/webhook/instagram', verifyInstagram);
app.post('/webhook/instagram', handleInstagram);

const INTERVALS = {
  facebook_comments: 5 * 60 * 1000,
  instagram_comments: 5 * 60 * 1000,
  tiktok: 5 * 60 * 1000,
  twitter: 5 * 60 * 1000,
  youtube: 10 * 60 * 1000,
};

// Wrap each poller so an unhandled rejection never crashes the process.
function safe(fn, label) {
  return () =>
    Promise.resolve()
      .then(fn)
      .catch((err) => logError(label, 'فشل غير متوقع في الـ polling', err));
}

const pollers = [
  { fn: safe(pollFacebookComments, 'Facebook'), interval: INTERVALS.facebook_comments },
  { fn: safe(pollInstagramComments, 'Instagram'), interval: INTERVALS.instagram_comments },
  { fn: safe(pollTikTokComments, 'TikTok'), interval: INTERVALS.tiktok },
  { fn: safe(pollTwitterMentions, 'Twitter'), interval: INTERVALS.twitter },
  { fn: safe(pollYouTubeComments, 'YouTube'), interval: INTERVALS.youtube },
];

function startPolling() {
  for (const { fn, interval } of pollers) {
    fn(); // immediate first run
    setInterval(fn, interval);
  }
}

// Keep the process alive even if something slips through.
process.on('unhandledRejection', (reason) => {
  logError('Process', 'unhandledRejection', reason);
});
process.on('uncaughtException', (err) => {
  logError('Process', 'uncaughtException', err);
});

async function start() {
  await initializeSheet();
  startPolling();

  app.listen(PORT, () => {
    console.log(`
🤖 OX Agent Started Successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ WhatsApp Business    (Webhook)
✅ Facebook Messenger   (Webhook)
✅ Instagram DM         (Webhook)
✅ Facebook Comments    (Polling 5min)
✅ Instagram Comments   (Polling 5min)
✅ TikTok Comments      (Polling 5min)
✅ X/Twitter Mentions   (Polling 5min)
✅ YouTube Comments     (Polling 10min)
✅ Google Sheets        (Logging)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Server: http://localhost:${PORT}
📊 Health: http://localhost:${PORT}/health
`);
  });
}

start().catch((err) => logError('Server', 'فشل بدء التشغيل', err));
