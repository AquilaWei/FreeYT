import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPopup } from '../src/popup.js';

function setup({ stored = {}, reply, sendError } = {}) {
  const elements = {};
  const doc = {
    getElementById(id) {
      elements[id] ??= { checked: false, value: '', textContent: '', handlers: {}, addEventListener(e, fn) { this.handlers[e] = fn; } };
      return elements[id];
    },
  };
  const data = { ...stored };
  const settingsArea = {
    data,
    get: async (defaults) => ({ ...defaults, ...data }),
    set: async (items) => Object.assign(data, items),
  };
  const tabs = {
    query: async () => [{ id: 7 }],
    sendMessage: async () => {
      if (sendError) throw new Error('no receiver');
      return reply;
    },
  };
  return { doc, elements, settingsArea, tabs };
}

test('popup shows default toggle state and values when storage is empty', async () => {
  const { doc, elements, settingsArea, tabs } = setup();
  await initPopup({ doc, settingsArea, tabs });
  assert.equal(elements.enabled.checked, true);
  assert.equal(elements.maxAttempts.value, 20);
  assert.equal(elements.delayMs.value, 1000);
});

test('popup shows a stored disabled state', async () => {
  const { doc, elements, settingsArea, tabs } = setup({ stored: { enabled: false } });
  await initPopup({ doc, settingsArea, tabs });
  assert.equal(elements.enabled.checked, false);
});

test('popup shows the reload count reported by the tab', async () => {
  const { doc, elements, settingsArea, tabs } = setup({ reply: { attempts: 3 } });
  await initPopup({ doc, settingsArea, tabs });
  assert.equal(elements.attempts.textContent, '3');
});

test('popup shows a dash when the tab has no content script', async () => {
  const { doc, elements, settingsArea, tabs } = setup({ sendError: true });
  await initPopup({ doc, settingsArea, tabs });
  assert.equal(elements.attempts.textContent, '–');
});

test('toggling enabled stores false', async () => {
  const { doc, elements, settingsArea, tabs } = setup();
  await initPopup({ doc, settingsArea, tabs });
  elements.enabled.checked = false;
  await elements.enabled.handlers.change();
  assert.equal(settingsArea.data.enabled, false);
});

test('an out-of-range delay is stored clamped and shown clamped', async () => {
  const { doc, elements, settingsArea, tabs } = setup();
  await initPopup({ doc, settingsArea, tabs });
  elements.delayMs.value = '5';
  await elements.delayMs.handlers.change();
  assert.equal(settingsArea.data.delayMs, 500);
  assert.equal(elements.delayMs.value, 500);
});
