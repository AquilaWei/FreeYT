import { createAdGuard } from './ad-guard.js';
import { createRetryPolicy } from './retry-policy.js';

// sessionStorage keeps the attempt counter across the reloads this extension causes.
createAdGuard({
  doc: document,
  location,
  policy: createRetryPolicy(sessionStorage),
  MutationObserver,
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
  log: (message) => console.info(message),
}).start();
