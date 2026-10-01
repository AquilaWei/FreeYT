import { startApp } from './app.js';

// sessionStorage keeps the attempt counter across the reloads this extension causes.
await startApp({
  settingsArea: chrome.storage.sync,
  runtime: chrome.runtime,
  guardDeps: {
    doc: document,
    location,
    storage: sessionStorage,
    MutationObserver,
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle),
    log: (message) => console.info(message),
  },
});
