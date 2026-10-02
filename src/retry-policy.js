export const DEFAULT_MAX_ATTEMPTS = 20;
export const DEFAULT_DELAY_MS = 1000;
// Floor for the reload delay so a misconfiguration cannot cause a tight reload loop.
export const MIN_DELAY_MS = 500;

const STORAGE_KEY = 'freeyt.retry';

function finiteOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Decides whether to reload the page when an ad is detected.
 *
 * The counter lives in `storage` (sessionStorage in the content script) so it
 * survives the reload itself. Only one video is tracked at a time: seeing a
 * different video id starts again from zero.
 *
 * @param {{getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void}} storage
 * @param {{maxAttempts?: number, delayMs?: number}} [options] `delayMs` is raised to MIN_DELAY_MS if lower.
 */
export function createRetryPolicy(storage, { maxAttempts = DEFAULT_MAX_ATTEMPTS, delayMs = DEFAULT_DELAY_MS } = {}) {
  // Settings may come from user-editable storage; non-numeric values must not disable the floor or the cap.
  const effectiveDelayMs = Math.max(finiteOr(delayMs, DEFAULT_DELAY_MS), MIN_DELAY_MS);
  const effectiveMaxAttempts = finiteOr(maxAttempts, DEFAULT_MAX_ATTEMPTS);

  function readCount(videoId) {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    // The key lives in the page's sessionStorage, which youtube.com's own scripts can write too:
    // anything unparseable or of the wrong shape counts as "no attempts"; onAdDetected overwrites it.
    let saved;
    try {
      saved = JSON.parse(raw);
    } catch {
      return 0;
    }
    if (saved === null || typeof saved !== 'object' || saved.videoId !== videoId) return 0;
    return Number.isFinite(saved.count) ? saved.count : 0;
  }

  return {
    /**
     * Call when an ad is seen. Counts the attempt when a reload is granted.
     * @param {string} videoId
     * @returns {{reload: true, delayMs: number} | {reload: false, reason: 'limit'}}
     */
    onAdDetected(videoId) {
      const count = readCount(videoId);
      if (count >= effectiveMaxAttempts) return { reload: false, reason: 'limit' };
      storage.setItem(STORAGE_KEY, JSON.stringify({ videoId, count: count + 1 }));
      return { reload: true, delayMs: effectiveDelayMs };
    },

    /** Call once the player is confirmed ad-free; forgets the attempts. */
    onAdFree() {
      storage.removeItem(STORAGE_KEY);
    },

    /** Reload attempts used so far for `videoId`. */
    attempts(videoId) {
      return readCount(videoId);
    },
  };
}
