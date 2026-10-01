export const NAVIGATE_EVENT = 'yt-navigate-finish';

/**
 * Re-arms the ad guard when YouTube switches videos without a full page load.
 *
 * `yt-navigate-finish` fires after the URL (and so the `v` parameter) has changed, so
 * `stop()` + `start()` makes the guard pick up the new video id; the retry policy
 * starts again from zero for a different id. A navigation that leaves `pathname` and `v`
 * unchanged (YouTube also fires the event after its first load) does nothing: restarting
 * would cancel a pending reload and count the same ad as a second attempt. `init` is idempotent: calling it twice
 * never registers a second listener, so one navigation restarts the guard once.
 *
 * @param {{location: {pathname: string, search: string}, target: {addEventListener: Function, removeEventListener: Function}, guard: {start: () => void, stop: () => void}}} deps
 * @returns {{init: () => void, dispose: () => void}} `dispose` removes the listener and stops the guard.
 */
export function createSpaNavigation({ target, guard, location }) {
  let active = false;
  let watched = null;

  function watchKey() {
    return `${location.pathname}?v=${new URLSearchParams(location.search).get('v')}`;
  }

  function onNavigate() {
    if (watchKey() === watched) return;
    watched = watchKey();
    guard.stop();
    guard.start();
  }

  return {
    init() {
      if (active) return;
      active = true;
      watched = watchKey();
      target.addEventListener(NAVIGATE_EVENT, onNavigate);
      guard.start();
    },

    dispose() {
      if (!active) return;
      active = false;
      target.removeEventListener(NAVIGATE_EVENT, onNavigate);
      guard.stop();
    },
  };
}
