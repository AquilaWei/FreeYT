import { isAdPlaying } from './ad-detector.js';

const RESUME_KEY = 'freeyt.resume';

// Time without an ad before the page counts as ad-free and the retry counter is reset.
export const DEFAULT_SETTLE_MS = 3000;

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
  let reloadTimer = null;
  let settleTimer = null;
  let limitLogged = false;
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
      return;
    }
    lastContentTime = video.currentTime;
  }

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
        // After the first reload lastContentTime is null; keep the position saved earlier.
        if (lastContentTime !== null) {
          storage.setItem(RESUME_KEY, JSON.stringify({ videoId, time: lastContentTime }));
        }
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
      resumeTime = readResume();
      doc.addEventListener('timeupdate', onTimeUpdate, true);
      observer = new MutationObserver(check);
      observer.observe(root, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
      check();
    },

    stop() {
      if (observer !== null) {
        observer.disconnect();
        doc.removeEventListener('timeupdate', onTimeUpdate, true);
      }
      observer = null;
      lastContentTime = null;
      resumeTime = null;
      reloadTimer = cancel(reloadTimer);
      settleTimer = cancel(settleTimer);
      limitLogged = false;
    },
  };
}
