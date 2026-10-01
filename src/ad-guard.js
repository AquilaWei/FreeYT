import { isAdPlaying } from './ad-detector.js';

// Time without an ad before the page counts as ad-free and the retry counter is reset.
export const DEFAULT_SETTLE_MS = 3000;

/**
 * Watches a YouTube watch page and reloads it while a video ad is playing.
 *
 * Everything environment-specific is injected so tests can use fakes. Reacts to
 * DOM mutations of the player (no polling). Does nothing outside `/watch`
 * (home, search, Shorts), and never reloads more than once per detection.
 *
 * @param {object} deps
 * @param {{querySelector: Function, body: object}} deps.doc
 * @param {{pathname: string, search: string, reload: () => void}} deps.location
 * @param {ReturnType<import('./retry-policy.js').createRetryPolicy>} deps.policy
 * @param {new (callback: () => void) => {observe: Function, disconnect: Function}} deps.MutationObserver
 * @param {(fn: () => void, ms: number) => unknown} deps.setTimeout
 * @param {(handle: unknown) => void} deps.clearTimeout
 * @param {(message: string) => void} deps.log
 * @param {number} [deps.settleMs]
 * @returns {{start: () => void, stop: () => void}} `start` is a no-op on non-watch pages or without a `v` parameter.
 */
export function createAdGuard({ doc, location, policy, MutationObserver, setTimeout, clearTimeout, log, settleMs = DEFAULT_SETTLE_MS }) {
  let observer = null;
  let reloadTimer = null;
  let settleTimer = null;
  let limitLogged = false;
  let videoId = null;

  function cancel(timer) {
    if (timer !== null) clearTimeout(timer);
    return null;
  }

  function check() {
    if (isAdPlaying(doc)) {
      settleTimer = cancel(settleTimer);
      if (reloadTimer !== null) return; // a reload is already scheduled
      const decision = policy.onAdDetected(videoId);
      if (decision.reload) {
        reloadTimer = setTimeout(() => location.reload(), decision.delayMs);
      } else if (!limitLogged) {
        limitLogged = true;
        log(`FreeYT: ad still present after ${policy.attempts(videoId)} reloads, giving up on this video.`);
      }
      return;
    }
    if (settleTimer === null) {
      settleTimer = setTimeout(() => {
        settleTimer = null;
        if (!isAdPlaying(doc)) policy.onAdFree();
      }, settleMs);
    }
  }

  return {
    start() {
      if (observer !== null || location.pathname !== '/watch') return;
      videoId = new URLSearchParams(location.search).get('v');
      if (!videoId) return;
      // The player may not exist yet; fall back to the body until it does.
      const root = doc.querySelector('#movie_player') ?? doc.body;
      observer = new MutationObserver(check);
      observer.observe(root, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
      check();
    },

    stop() {
      if (observer !== null) observer.disconnect();
      observer = null;
      reloadTimer = cancel(reloadTimer);
      settleTimer = cancel(settleTimer);
      limitLogged = false;
    },
  };
}
