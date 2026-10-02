import { DEFAULT_DELAY_MS, DEFAULT_MAX_ATTEMPTS, MIN_DELAY_MS } from './retry-policy.js';

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  delayMs: DEFAULT_DELAY_MS,
});

// Upper bounds keep a typo from producing an effectively endless reload loop or a minutes-long wait.
export const MAX_ATTEMPTS_LIMIT = 100;
export const MAX_DELAY_MS = 30000;

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}

/**
 * Turns whatever is stored (empty, partial, hand-edited) into valid settings:
 * missing or non-numeric values fall back to the defaults, out-of-range numbers are clamped.
 * @param {object | undefined | null} raw
 */
export function normalizeSettings(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  return {
    // Only an explicit `false` disables the extension; junk must not silently turn it off.
    enabled: source.enabled !== false,
    maxAttempts: clampInt(source.maxAttempts, 1, MAX_ATTEMPTS_LIMIT, DEFAULT_SETTINGS.maxAttempts),
    delayMs: clampInt(source.delayMs, MIN_DELAY_MS, MAX_DELAY_MS, DEFAULT_SETTINGS.delayMs),
  };
}

/**
 * @param {{get: (keys: object) => Promise<object>}} area chrome.storage.sync-like
 * @returns {Promise<ReturnType<typeof normalizeSettings>>} Rejects if the storage read fails.
 */
export async function loadSettings(area) {
  return normalizeSettings(await area.get({ ...DEFAULT_SETTINGS }));
}

/**
 * Validates `partial` merged over the current settings, stores the result and returns it.
 * @param {{get: Function, set: (items: object) => Promise<void>}} area
 * @param {object} partial
 */
export async function saveSettings(area, partial) {
  const next = normalizeSettings({ ...(await loadSettings(area)), ...partial });
  await area.set(next);
  return next;
}
