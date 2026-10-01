import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdGuard } from '../src/ad-guard.js';
import { createRetryPolicy } from '../src/retry-policy.js';

function setup({ pathname = '/watch', search = '?v=abc', ad = false, maxAttempts } = {}) {
  const data = new Map();
  const storage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
  const state = { ad, reloads: 0, logs: [], timers: [], observers: [], nextId: 1 };
  const listeners = [];
  const doc = {
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    removeEventListener: (type, fn) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    body: { name: 'body' },
    querySelector: (selector) => {
      if (selector === '#movie_player.ad-showing') return state.ad ? {} : null;
      if (selector === '#movie_player') return { name: 'player' };
      return null;
    },
  };
  class FakeObserver {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
      this.disconnected = false;
      state.observers.push(this);
    }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  const guard = createAdGuard({
    doc,
    location: { pathname, search, reload: () => { state.reloads++; } },
    policy: createRetryPolicy(storage, { maxAttempts, delayMs: 1000 }),
    storage,
    MutationObserver: FakeObserver,
    setTimeout: (fn, ms) => { const id = state.nextId++; state.timers.push({ id, fn, ms }); return id; },
    clearTimeout: (id) => { state.timers = state.timers.filter((t) => t.id !== id); },
    log: (message) => state.logs.push(message),
    settleMs: 3000,
  });
  const fire = (ms) => {
    const timer = state.timers.find((t) => t.ms === ms);
    state.timers = state.timers.filter((t) => t !== timer);
    timer.fn();
  };
  const timeUpdate = (video) => listeners.filter((l) => l.type === 'timeupdate').forEach((l) => l.fn({ target: video }));
  return { guard, state, storage, fire, timeUpdate, listeners };
}

test('ad detected on start reloads once after the policy delay', () => {
  const { guard, state, fire } = setup({ ad: true });
  guard.start();
  assert.equal(state.reloads, 0);
  fire(1000);
  assert.equal(state.reloads, 1);
});

test('repeated mutations during an ad schedule only one reload', () => {
  const { guard, state } = setup({ ad: true });
  guard.start();
  state.observers[0].callback();
  state.observers[0].callback();
  assert.equal(state.timers.filter((t) => t.ms === 1000).length, 1);
});

test('ad appearing after start via a mutation schedules a reload', () => {
  const { guard, state, fire } = setup();
  guard.start();
  state.ad = true;
  state.observers[0].callback();
  fire(1000);
  assert.equal(state.reloads, 1);
});

test('content playing through the settle window resets the counter and does not reload', () => {
  const { guard, state, storage, fire, timeUpdate } = setup();
  storage.setItem('freeyt.retry', JSON.stringify({ videoId: 'abc', count: 3 }));
  guard.start();
  timeUpdate({ tagName: 'VIDEO', currentTime: 5 });
  fire(3000);
  assert.equal(storage.getItem('freeyt.retry'), null);
  assert.equal(state.reloads, 0);
});

test('an ad showing up inside the settle window cancels the reset', () => {
  const { guard, state, storage, timeUpdate } = setup();
  storage.setItem('freeyt.retry', JSON.stringify({ videoId: 'abc', count: 3 }));
  guard.start();
  timeUpdate({ tagName: 'VIDEO', currentTime: 5 });
  state.ad = true;
  state.observers[0].callback();
  assert.equal(state.timers.some((t) => t.ms === 3000), false);
  assert.notEqual(storage.getItem('freeyt.retry'), null);
});

test('no content playback keeps the counter, so a late ad counts as the next attempt', () => {
  const { guard, state, storage, fire } = setup({ maxAttempts: 3 });
  storage.setItem('freeyt.retry', JSON.stringify({ videoId: 'abc', count: 1 }));
  guard.start();
  state.observers[0].callback();
  assert.equal(state.timers.some((t) => t.ms === 3000), false);
  state.ad = true;
  state.observers[0].callback();
  fire(1000);
  assert.equal(JSON.parse(storage.getItem('freeyt.retry')).count, 2);
});

test('timeupdate from an ad does not start the settle window', () => {
  const { guard, state, timeUpdate } = setup({ ad: true });
  guard.start();
  timeUpdate({ tagName: 'VIDEO', currentTime: 1 });
  assert.equal(state.timers.some((t) => t.ms === 3000), false);
});

test('ad still present after the cap does not reload and logs why', () => {
  const { guard, state } = setup({ ad: true, maxAttempts: 1 });
  guard.start();
  state.timers = [];
  guard.stop();
  guard.start();
  assert.equal(state.timers.length, 0);
  assert.equal(state.logs.length, 1);
  assert.match(state.logs[0], /giving up/);
});

test('cap message is logged once even if mutations keep firing', () => {
  const { guard, state } = setup({ ad: true, maxAttempts: 0 });
  guard.start();
  state.observers[0].callback();
  assert.equal(state.logs.length, 1);
});

for (const [name, opts] of [
  ['home page', { pathname: '/', search: '' }],
  ['search page', { pathname: '/results', search: '?search_query=x' }],
  ['Shorts page', { pathname: '/shorts/abc', search: '' }],
  ['watch page without a video id', { pathname: '/watch', search: '' }],
]) {
  test(`does nothing on ${name}`, () => {
    const { guard, state } = setup({ ...opts, ad: true });
    guard.start();
    assert.equal(state.observers.length, 0);
    assert.equal(state.timers.length, 0);
  });
}

test('observes the player element with a MutationObserver', () => {
  const { guard, state } = setup();
  guard.start();
  assert.equal(state.observers[0].target.name, 'player');
});

test('start twice creates a single observer', () => {
  const { guard, state } = setup();
  guard.start();
  guard.start();
  assert.equal(state.observers.length, 1);
});

test('stop disconnects the observer and cancels pending timers', () => {
  const { guard, state } = setup({ ad: true });
  guard.start();
  guard.stop();
  assert.equal(state.observers[0].disconnected, true);
  assert.equal(state.timers.length, 0);
});

test('mid-roll ad saves the last content position before the reload', () => {
  const { guard, state, storage, timeUpdate } = setup();
  guard.start();
  timeUpdate({ tagName: 'VIDEO', currentTime: 125.5 });
  state.ad = true;
  state.observers[0].callback();
  assert.deepEqual(JSON.parse(storage.getItem('freeyt.resume')), { videoId: 'abc', time: 125.5 });
});

test('timeupdate from the ad itself is not recorded as content position', () => {
  const { guard, state, storage, timeUpdate } = setup();
  guard.start();
  timeUpdate({ tagName: 'VIDEO', currentTime: 125.5 });
  state.ad = true;
  timeUpdate({ tagName: 'VIDEO', currentTime: 3 });
  state.observers[0].callback();
  assert.equal(JSON.parse(storage.getItem('freeyt.resume')).time, 125.5);
});

test('reloaded page seeks to the saved position on the first ad-free timeupdate', () => {
  const { guard, storage, timeUpdate } = setup();
  storage.setItem('freeyt.resume', JSON.stringify({ videoId: 'abc', time: 125.5 }));
  guard.start();
  const video = { tagName: 'VIDEO', currentTime: 0 };
  timeUpdate(video);
  assert.equal(video.currentTime, 125.5);
  assert.equal(storage.getItem('freeyt.resume'), null);
});

test('does not seek while the reloaded page still shows an ad', () => {
  const { guard, storage, timeUpdate } = setup({ ad: true });
  storage.setItem('freeyt.resume', JSON.stringify({ videoId: 'abc', time: 125.5 }));
  guard.start();
  const video = { tagName: 'VIDEO', currentTime: 2 };
  timeUpdate(video);
  assert.equal(video.currentTime, 2);
  assert.notEqual(storage.getItem('freeyt.resume'), null);
});

test('a position saved for another video is not applied', () => {
  const { guard, storage, timeUpdate } = setup();
  storage.setItem('freeyt.resume', JSON.stringify({ videoId: 'other', time: 99 }));
  guard.start();
  const video = { tagName: 'VIDEO', currentTime: 0 };
  timeUpdate(video);
  assert.equal(video.currentTime, 0);
});

test('a second reload keeps the position saved before the first one', () => {
  const { guard, state, storage } = setup({ ad: true });
  storage.setItem('freeyt.resume', JSON.stringify({ videoId: 'abc', time: 125.5 }));
  guard.start();
  assert.equal(JSON.parse(storage.getItem('freeyt.resume')).time, 125.5);
  assert.equal(state.timers.some((t) => t.ms === 1000), true);
});

test('corrupt saved position is ignored', () => {
  const { guard, storage, timeUpdate } = setup();
  storage.setItem('freeyt.resume', 'not json');
  guard.start();
  const video = { tagName: 'VIDEO', currentTime: 0 };
  timeUpdate(video);
  assert.equal(video.currentTime, 0);
});

test('stop removes the timeupdate listener', () => {
  const { guard, listeners } = setup();
  guard.start();
  guard.stop();
  assert.equal(listeners.length, 0);
});
