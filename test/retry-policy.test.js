import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRetryPolicy } from '../src/retry-policy.js';

const fakeStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

test('first ad detection returns reload true and counts one attempt', () => {
  const policy = createRetryPolicy(fakeStorage());
  assert.deepEqual(policy.onAdDetected('abc'), { reload: true, delayMs: 1000 });
  assert.equal(policy.attempts('abc'), 1);
});

test('returns reload false with reason limit after the default 10 attempts', () => {
  const policy = createRetryPolicy(fakeStorage());
  for (let i = 0; i < 10; i++) policy.onAdDetected('abc');
  assert.deepEqual(policy.onAdDetected('abc'), { reload: false, reason: 'limit' });
  assert.equal(policy.attempts('abc'), 10);
});

test('honors a custom max attempts', () => {
  const policy = createRetryPolicy(fakeStorage(), { maxAttempts: 2 });
  policy.onAdDetected('abc');
  policy.onAdDetected('abc');
  assert.equal(policy.onAdDetected('abc').reload, false);
});

test('counter resets when the video id changes', () => {
  const policy = createRetryPolicy(fakeStorage(), { maxAttempts: 1 });
  policy.onAdDetected('abc');
  assert.equal(policy.onAdDetected('xyz').reload, true);
  assert.equal(policy.attempts('abc'), 0);
});

test('counter resets when an ad-free state is confirmed', () => {
  const policy = createRetryPolicy(fakeStorage(), { maxAttempts: 1 });
  policy.onAdDetected('abc');
  policy.onAdFree();
  assert.equal(policy.onAdDetected('abc').reload, true);
});

test('counter persists across policy instances sharing storage (page reload)', () => {
  const storage = fakeStorage();
  createRetryPolicy(storage).onAdDetected('abc');
  assert.equal(createRetryPolicy(storage).attempts('abc'), 1);
});

test('configured delay is used when above the minimum', () => {
  const policy = createRetryPolicy(fakeStorage(), { delayMs: 3000 });
  assert.equal(policy.onAdDetected('abc').delayMs, 3000);
});

test('delay below the minimum is raised to 500 ms', () => {
  const policy = createRetryPolicy(fakeStorage(), { delayMs: 0 });
  assert.equal(policy.onAdDetected('abc').delayMs, 500);
});
