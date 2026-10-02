import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, normalizeSettings, saveSettings } from '../src/settings.js';

function fakeArea(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(defaults) { return { ...defaults, ...data }; },
    async set(items) { Object.assign(data, items); },
  };
}

test('empty storage loads the defaults', async () => {
  assert.deepEqual(await loadSettings(fakeArea()), { enabled: true, maxAttempts: 20, delayMs: 1000 });
});

test('stored values are returned', async () => {
  const area = fakeArea({ enabled: false, maxAttempts: 3, delayMs: 2000 });
  assert.deepEqual(await loadSettings(area), { enabled: false, maxAttempts: 3, delayMs: 2000 });
});

test('delay below the minimum is clamped up to 500', () => {
  assert.equal(normalizeSettings({ delayMs: 10 }).delayMs, 500);
});

test('delay above the maximum is clamped down to 30000', () => {
  assert.equal(normalizeSettings({ delayMs: 999999 }).delayMs, 30000);
});

test('max attempts of zero or less is clamped up to 1', () => {
  assert.equal(normalizeSettings({ maxAttempts: 0 }).maxAttempts, 1);
});

test('max attempts above the limit is clamped down to 100', () => {
  assert.equal(normalizeSettings({ maxAttempts: 1000 }).maxAttempts, 100);
});

test('non-numeric numbers fall back to the defaults', () => {
  assert.deepEqual(normalizeSettings({ maxAttempts: 'abc', delayMs: NaN }), { enabled: true, maxAttempts: 20, delayMs: 1000 });
});

test('non-boolean enabled does not disable the extension', () => {
  assert.equal(normalizeSettings({ enabled: 'no' }).enabled, true);
});

test('numeric strings from form inputs are accepted', () => {
  assert.equal(normalizeSettings({ maxAttempts: '5' }).maxAttempts, 5);
});

test('null raw settings give the defaults', () => {
  assert.deepEqual(normalizeSettings(null), { enabled: true, maxAttempts: 20, delayMs: 1000 });
});

test('saveSettings stores the clamped merge and keeps untouched fields', async () => {
  const area = fakeArea({ maxAttempts: 4 });
  const saved = await saveSettings(area, { delayMs: 1 });
  assert.deepEqual(saved, { enabled: true, maxAttempts: 4, delayMs: 500 });
  assert.deepEqual(area.data, saved);
});
