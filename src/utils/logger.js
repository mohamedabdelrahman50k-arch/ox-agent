const ICONS = {
  ok: '✅',
  error: '❌',
  wait: '⏳',
};

function pad(label) {
  // Keep the bracketed source aligned to a fixed width for readable columns.
  return `[${label}]`.padEnd(12, ' ');
}

// status: 'ok' | 'error' | 'wait' (or pass a raw emoji)
export function log(platform, status, message) {
  const icon = ICONS[status] || status || '';
  console.log(`${pad(platform)} ${icon} ${message}`);
}

export function logError(platform, message, err) {
  const detail = err?.response?.data
    ? JSON.stringify(err.response.data)
    : err?.message || err || '';
  console.error(`${pad(platform)} ${ICONS.error} ${message}${detail ? ` — ${detail}` : ''}`);
}
