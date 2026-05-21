// In-memory store of the last poll time per platform.
// Initialized to 10 minutes ago so the first poll picks up recent activity.
const tenMinutesAgo = () => new Date(Date.now() - 10 * 60 * 1000);

const lastCheckTimes = {
  facebook_comments: tenMinutesAgo(),
  instagram_comments: tenMinutesAgo(),
  tiktok: tenMinutesAgo(),
  youtube: tenMinutesAgo(),
  twitter: tenMinutesAgo(),
};

export function getLastCheck(platform) {
  return lastCheckTimes[platform];
}

export function updateLastCheck(platform) {
  lastCheckTimes[platform] = new Date();
}
