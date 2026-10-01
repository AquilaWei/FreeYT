import { createAdGuard } from './ad-guard.js';
import { createRetryPolicy } from './retry-policy.js';
import { createSpaNavigation } from './spa-navigation.js';
import { loadSettings } from './settings.js';

export const ATTEMPTS_MESSAGE = 'freeyt.attempts';

/**
 * Starts FreeYT on the current page according to the stored settings.
 *
 * With `enabled: false` nothing is observed and no reload can happen. Settings are read once per
 * page load, so a change in the popup applies from the next load. The popup asks for the reload
 * count through a runtime message instead of reading the page's sessionStorage itself, which
 * would need the `scripting` permission.
 *
 * @param {object} env
 * @param {{get: Function}} env.settingsArea chrome.storage.sync-like
 * @param {{onMessage: {addListener: Function}}} env.runtime
 * @param {object} env.guardDeps Everything `createAdGuard` needs except `policy` (doc, location, storage, MutationObserver, timers, log).
 * @returns {Promise<{dispose: () => void} | null>} null when disabled. Rejects if settings cannot be read.
 */
export async function startApp({ settingsArea, runtime, guardDeps }) {
  const settings = await loadSettings(settingsArea);
  if (!settings.enabled) return null;

  const policy = createRetryPolicy(guardDeps.storage, { maxAttempts: settings.maxAttempts, delayMs: settings.delayMs });
  const guard = createAdGuard({ ...guardDeps, policy });
  const navigation = createSpaNavigation({ target: guardDeps.doc, guard, location: guardDeps.location });
  navigation.init();

  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== ATTEMPTS_MESSAGE) return;
    const videoId = new URLSearchParams(guardDeps.location.search).get('v');
    sendResponse({ attempts: videoId ? policy.attempts(videoId) : 0 });
  });
  return navigation;
}
