import { createAdGuard } from './ad-guard.js';
import { createRetryPolicy } from './retry-policy.js';
import { createSpaNavigation } from './spa-navigation.js';

// sessionStorage keeps the attempt counter across the reloads this extension causes.
const guard = createAdGuard({
  doc: document,
  location,
  policy: createRetryPolicy(sessionStorage),
  storage: sessionStorage,
  MutationObserver,
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
  log: (message) => console.info(message),
});

// YouTube is an SPA: re-arm the guard on every in-page navigation.
createSpaNavigation({ target: document, guard, location }).init();
