import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpaNavigation } from '../src/spa-navigation.js';
import { createAdGuard } from '../src/ad-guard.js';
import { createRetryPolicy } from '../src/retry-policy.js';

function fakeTarget() {
  const listeners = [];
  return {
    listeners,
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    removeEventListener: (type, fn) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    dispatch: (type) => listeners.filter((l) => l.type === type).forEach((l) => l.fn()),
  };
}

function fakeGuard() {
  const calls = [];
  return { calls, start: () => calls.push('start'), stop: () => calls.push('stop') };
}

test('yt-navigate-finish stops then starts the guard', () => {
  const target = fakeTarget();
  const guard = fakeGuard();
  createSpaNavigation({ target, guard }).init();
  guard.calls.length = 0;
  target.dispatch('yt-navigate-finish');
  assert.deepEqual(guard.calls, ['stop', 'start']);
});

test('init twice registers a single listener', () => {
  const target = fakeTarget();
  const nav = createSpaNavigation({ target, guard: fakeGuard() });
  nav.init();
  nav.init();
  assert.equal(target.listeners.length, 1);
});

test('init twice restarts the guard once per navigation', () => {
  const target = fakeTarget();
  const guard = fakeGuard();
  const nav = createSpaNavigation({ target, guard });
  nav.init();
  nav.init();
  guard.calls.length = 0;
  target.dispatch('yt-navigate-finish');
  assert.deepEqual(guard.calls, ['stop', 'start']);
});

test('dispose removes the listener and stops the guard', () => {
  const target = fakeTarget();
  const guard = fakeGuard();
  const nav = createSpaNavigation({ target, guard });
  nav.init();
  guard.calls.length = 0;
  nav.dispose();
  target.dispatch('yt-navigate-finish');
  assert.deepEqual(guard.calls, ['stop']);
  assert.equal(target.listeners.length, 0);
});

test('navigation to a new video does not inherit the previous attempt count', () => {
  const data = new Map();
  const storage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
  const location = { pathname: '/watch', search: '?v=old', reload: () => {} };
  const policy = createRetryPolicy(storage, { maxAttempts: 2, delayMs: 1000 });
  const doc = {
    addEventListener: () => {},
    removeEventListener: () => {},
    body: {},
    querySelector: (selector) => (selector === '#movie_player.ad-showing' ? {} : selector === '#movie_player' ? {} : null),
  };
  const guard = createAdGuard({
    doc,
    location,
    policy,
    storage,
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout: () => 1,
    clearTimeout: () => {},
    log: () => {},
  });
  const target = fakeTarget();
  createSpaNavigation({ target, guard }).init();
  assert.equal(policy.attempts('old'), 1);

  location.search = '?v=new';
  target.dispatch('yt-navigate-finish');

  assert.equal(policy.attempts('new'), 1);
  assert.equal(policy.attempts('old'), 0);
});
