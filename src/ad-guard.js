import { isAdPlaying } from './ad-detector.js';

const RESUME_KEY = 'freeyt.resume';

// Time of uninterrupted content playback before the page counts as ad-free and the retry counter is reset.
export const DEFAULT_SETTLE_MS = 3000;

const OBSERVE_OPTIONS = { attributes: true, attributeFilter: ['class'], childList: true, subtree: true };

/**
 * Watches a YouTube watch page and reloads it while a video ad is playing.
 *
 * Everything environment-specific is injected so tests can use fakes. Reacts to
 * DOM mutations of the player (no polling). Does nothing outside `/watch`
 * (home, search, Shorts), and never reloads more than once per detection.
 *
 * A mid-roll ad is interrupting the content, so the last content position
 * (seen via `timeupdate` while no ad was showing) is saved before the reload and
 * restored once the reloaded page plays ad-free. The ad's own `timeupdate`
 * events must not be recorded, hence the ad check in the handler.
 *
 * @param {object} deps
 * @param {{querySelector: Function, body: object}} deps.doc
 * @param {{pathname: string, search: string, reload: () => void}} deps.location
 * @param {ReturnType<import('./retry-policy.js').createRetryPolicy>} deps.policy
 * @param {{getItem: Function, setItem: Function, removeItem: Function}} deps.storage Holds the playback position across the reload.
 * @param {new (callback: () => void) => {observe: Function, disconnect: Function}} deps.MutationObserver
 * @param {(fn: () => void, ms: number) => unknown} deps.setTimeout
 * @param {(handle: unknown) => void} deps.clearTimeout
 * @param {(message: string) => void} deps.log
 * @param {number} [deps.settleMs]
 * @returns {{start: () => void, stop: () => void}} `start` is a no-op on non-watch pages or without a `v` parameter.
 */
export function createAdGuard({ doc, location, policy, storage, MutationObserver, setTimeout, clearTimeout, log, settleMs = DEFAULT_SETTLE_MS }) {
  let observer = null;
  let observingBody = false;
  let reloadTimer = null;
  let settleTimer = null;
  let limitLogged = false;
  let adFree = false;
  let videoId = null;
  let lastContentTime = null;
  let resumeTime = null;

  function readResume() {
    const raw = storage.getItem(RESUME_KEY);
    if (raw === null) return null;
    // Same page-writable storage as the retry counter: ignore anything malformed.
    let saved;
    try {
      saved = JSON.parse(raw);
    } catch {
      return null;
    }
    if (saved === null || typeof saved !== 'object' || saved.videoId !== videoId) return null;
    return Number.isFinite(saved.time) && saved.time > 0 ? saved.time : null;
  }

  // `timeupdate` does not bubble, so it is caught in the capture phase on the document;
  // this also survives YouTube replacing the <video> element.
  function onTimeUpdate(event) {
    const video = event.target;
    if (video?.tagName !== 'VIDEO' || isAdPlaying(doc)) return;
    if (resumeTime !== null) {
      video.currentTime = resumeTime;
      resumeTime = null;
      storage.removeItem(RESUME_KEY);
    } else {
      lastContentTime = video.currentTime;
    }
    startSettleWindow();
  }

  // Only playing content proves the page is ad-free: right after a reload the player may not
  // exist yet, and "no ad visible" then must not reset the counter or the reload cap never triggers.
  function startSettleWindow() {
    if (adFree || settleTimer !== null) return;
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (isAdPlaying(doc)) return;
      adFree = true;
      policy.onAdFree();
    }, settleMs);
  }

  function cancel(timer) {
    if (timer !== null) clearTimeout(timer);
    return null;
  }

  // Watching the whole body is costly on YouTube (comments, recommendations keep mutating),
  // so move to the player as soon as it shows up.
  function narrowToPlayer() {
    const player = doc.querySelector('#movie_player');
    if (player === null) return;
    observer.disconnect();
    observer.observe(player, OBSERVE_OPTIONS);
    observingBody = false;
  }

  function check() {
    if (observingBody) narrowToPlayer();
    if (isAdPlaying(doc)) {
      settleTimer = cancel(settleTimer);
      adFree = false;
      if (reloadTimer !== null) return; // a reload is already scheduled
      const decision = policy.onAdDetected(videoId);
      if (decision.reload) {
        // After the first reload lastContentTime is null; keep the position saved earlier.
        if (lastContentTime !== null) {
          storage.setItem(RESUME_KEY, JSON.stringify({ videoId, time: lastContentTime }));
        }
        reloadTimer = setTimeout(() => location.reload(), decision.delayMs);
      } else if (!limitLogged) {
        limitLogged = true;
        log(`FreeYT: ad still present after ${policy.attempts(videoId)} reloads, giving up on this video.`);
      }
    }
  }

  return {
    start() {
      if (observer !== null || location.pathname !== '/watch') return;
      videoId = new URLSearchParams(location.search).get('v');
      if (!videoId) return;
      // The player may not exist yet; fall back to the body until it does (see narrowToPlayer).
      const player = doc.querySelector('#movie_player');
      observingBody = player === null;
      resumeTime = readResume();
      doc.addEventListener('timeupdate', onTimeUpdate, true);
      observer = new MutationObserver(check);
      observer.observe(player ?? doc.body, OBSERVE_OPTIONS);
      check();
    },

    stop() {
      if (observer !== null) {
        observer.disconnect();
        doc.removeEventListener('timeupdate', onTimeUpdate, true);
      }
      observer = null;
      observingBody = false;
      lastContentTime = null;
      resumeTime = null;
      reloadTimer = cancel(reloadTimer);
      settleTimer = cancel(settleTimer);
      limitLogged = false;
      adFree = false;
    },
  };
}
