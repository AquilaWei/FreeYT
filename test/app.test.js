import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from '../src/app.js';

function setup(settings, search = '?v=abc') {
  const reloads = [];
  const timers = [];
  const listeners = [];
  const store = new Map();
  const doc = {
    body: {},
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
  };
  const env = {
    settingsArea: { get: async (defaults) => ({ ...defaults, ...settings }) },
    runtime: { onMessage: { addListener: (fn) => listeners.push(fn) } },
    guardDeps: {
      doc,
      location: { pathname: '/watch', search, reload: () => reloads.push(1) },
      storage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, v),
        removeItem: (k) => store.delete(k),
      },
      MutationObserver: class { observe() {} disconnect() {} },
      setTimeout: (fn, ms) => timers.push({ fn, ms }),
      clearTimeout() {},
      log() {},
    },
  };
  return { env, reloads, timers, listeners, store };
}

// The real detector asks for '#movie_player.ad-showing'; answer that selector with an element.
function withAd(env) {
  env.guardDeps.doc.querySelector = (selector) => (selector === '#movie_player.ad-showing' ? {} : null);
}

test('enabled=false never reloads and registers nothing', async () => {
  const { env, reloads, timers, listeners } = setup({ enabled: false });
  withAd(env);
  const app = await startApp(env);
  assert.equal(app, null);
  assert.equal(timers.length, 0);
  assert.equal(listeners.length, 0);
  assert.equal(reloads.length, 0);
});

test('enabled=true schedules a reload with the configured delay when an ad shows', async () => {
  const { env, timers } = setup({ delayMs: 2500 });
  withAd(env);
  await startApp(env);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 2500);
});

test('attempts message replies with the count of the current video', async () => {
  const { env, listeners } = setup({}, '?v=abc');
  withAd(env);
  await startApp(env);
  let reply;
  listeners[0]({ type: 'freeyt.attempts' }, {}, (r) => { reply = r; });
  assert.deepEqual(reply, { attempts: 1 });
});

test('unrelated messages get no reply', async () => {
  const { env, listeners } = setup({});
  await startApp(env);
  let reply;
  listeners[0]({ type: 'other' }, {}, (r) => { reply = r; });
  assert.equal(reply, undefined);
});
