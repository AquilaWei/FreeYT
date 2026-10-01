import { loadSettings, saveSettings } from './settings.js';
import { ATTEMPTS_MESSAGE } from './app.js';

/**
 * Fills the popup from storage and saves every change.
 *
 * The reload count comes from the content script of the active tab; on other pages (or before
 * the content script is ready) there is nobody to answer, which is shown as "–".
 *
 * @param {object} deps
 * @param {{getElementById: (id: string) => object}} deps.doc Needs #enabled, #maxAttempts, #delayMs (inputs), #attempts and #status.
 * @param {{get: Function, set: Function}} deps.settingsArea
 * @param {{query: Function, sendMessage: Function}} deps.tabs
 * @returns {Promise<void>} Rejects if the settings cannot be read.
 */
export async function initPopup({ doc, settingsArea, tabs }) {
  const enabled = doc.getElementById('enabled');
  const maxAttempts = doc.getElementById('maxAttempts');
  const delayMs = doc.getElementById('delayMs');
  const attempts = doc.getElementById('attempts');
  const status = doc.getElementById('status');

  function show(settings) {
    enabled.checked = settings.enabled;
    maxAttempts.value = settings.maxAttempts;
    delayMs.value = settings.delayMs;
  }

  async function save() {
    try {
      // Show the clamped values so the user sees what was really stored.
      show(await saveSettings(settingsArea, {
        enabled: enabled.checked,
        maxAttempts: maxAttempts.value,
        delayMs: delayMs.value,
      }));
      status.textContent = 'Saved. Applies from the next page load.';
    } catch (error) {
      status.textContent = `Could not save: ${error.message}`;
    }
  }

  show(await loadSettings(settingsArea));
  for (const input of [enabled, maxAttempts, delayMs]) input.addEventListener('change', save);

  attempts.textContent = '–';
  try {
    const [tab] = await tabs.query({ active: true, currentWindow: true });
    const reply = tab ? await tabs.sendMessage(tab.id, { type: ATTEMPTS_MESSAGE }) : undefined;
    if (reply && Number.isFinite(reply.attempts)) attempts.textContent = String(reply.attempts);
  } catch {
    // No content script in this tab (not YouTube, or disabled): keep the placeholder.
  }
}
