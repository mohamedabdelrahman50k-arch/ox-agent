// Helpers for formatting timestamps and trimming replies per platform limits.

// Returns the date portion (YYYY-MM-DD) for the configured locale.
export function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Returns the time portion (HH:MM:SS).
export function formatTime(date = new Date()) {
  return date.toISOString().slice(11, 19);
}

// Trim a reply to a hard character limit (used for Twitter's 280 cap).
export function truncate(text, max) {
  if (typeof text !== 'string') return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

// Detects requests to escalate to a human agent (Arabic + English triggers).
const HUMAN_TRIGGERS = ['تحدث مع موظف', 'موظف', 'human'];

export function needsHumanHandoff(text = '') {
  const lower = String(text).toLowerCase();
  return HUMAN_TRIGGERS.some((t) => lower.includes(t.toLowerCase()));
}
