import { google } from 'googleapis';
import { log, logError } from './utils/logger.js';
import { formatDate, formatTime, needsHumanHandoff } from './utils/formatter.js';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Conversations';
const RANGE = `${SHEET_NAME}!A:I`;

const HEADERS = [
  'التاريخ',
  'الوقت',
  'المنصة',
  'اسم العميل',
  'معرف العميل',
  'الرسالة',
  'الرد',
  'الحالة',
  'رابط المنشور',
];

const STATUS_DONE = 'تمت الاستجابة';
const STATUS_NEEDS_HUMAN = '⚠️ يحتاج متابعة بشرية';

let sheetsClient = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Ensure the sheet exists and has the header row.
 * Called once at server startup.
 */
export async function initializeSheet() {
  try {
    const sheets = getSheetsClient();

    // Make sure the target tab exists.
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_NAME);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
        },
      });
      log('Sheets', 'ok', `تم إنشاء صفحة ${SHEET_NAME}`);
    }

    // Add the header row if the first row is empty.
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:I1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1:I1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] },
      });
      log('Sheets', 'ok', 'تم إضافة العناوين');
    } else {
      log('Sheets', 'ok', 'العناوين موجودة');
    }
  } catch (err) {
    logError('Sheets', 'فشل تهيئة الجدول', err);
  }
}

/**
 * Append a conversation row.
 * @returns {Promise<number|null>} the 1-based row number, or null on failure
 */
export async function logConversation({
  platform,
  senderName,
  senderId,
  message,
  reply,
  postUrl = '',
}) {
  try {
    const sheets = getSheetsClient();
    const now = new Date();
    const status = needsHumanHandoff(message) ? STATUS_NEEDS_HUMAN : STATUS_DONE;

    const row = [
      formatDate(now),
      formatTime(now),
      platform,
      senderName || '',
      senderId || '',
      message || '',
      reply || '',
      status,
      postUrl,
    ];

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGE,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    // updatedRange looks like "Conversations!A42:I42" — pull the row number.
    const updatedRange = res.data.updates?.updatedRange || '';
    const match = updatedRange.match(/!A(\d+)/);
    const rowNumber = match ? Number(match[1]) : null;

    log('Sheets', 'ok', rowNumber ? `تم التسجيل في الصف ${rowNumber}` : 'تم التسجيل');
    return rowNumber;
  } catch (err) {
    logError('Sheets', 'فشل تسجيل المحادثة', err);
    return null;
  }
}

/**
 * Return the last N messages for a sender as a Claude-style messages array.
 * @returns {Promise<Array<{role:'user'|'assistant', content:string}>>}
 */
export async function getConversationHistory(senderId, limit = 10) {
  try {
    if (!senderId) return [];
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = res.data.values || [];
    // Skip header row, keep rows for this sender (col index 4 = senderId).
    const matches = rows
      .slice(1)
      .filter((r) => (r[4] || '') === String(senderId))
      .slice(-limit);

    const history = [];
    for (const r of matches) {
      const message = r[5] || '';
      const reply = r[6] || '';
      if (message) history.push({ role: 'user', content: message });
      if (reply) history.push({ role: 'assistant', content: reply });
    }
    return history;
  } catch (err) {
    logError('Sheets', 'فشل جلب سجل المحادثة', err);
    return [];
  }
}

/**
 * Aggregate stats for the /health endpoint.
 * @returns {Promise<{total:number, byPlatform:Object, needsHuman:number, today:number}>}
 */
export async function getStats() {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = (res.data.values || []).slice(1);
    const today = formatDate(new Date());

    const stats = { total: 0, byPlatform: {}, needsHuman: 0, today: 0 };
    for (const r of rows) {
      stats.total += 1;
      const platform = r[2] || 'غير معروف';
      stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
      if ((r[7] || '') === STATUS_NEEDS_HUMAN) stats.needsHuman += 1;
      if ((r[0] || '') === today) stats.today += 1;
    }
    return stats;
  } catch (err) {
    logError('Sheets', 'فشل حساب الإحصائيات', err);
    return { total: 0, byPlatform: {}, needsHuman: 0, today: 0 };
  }
}
