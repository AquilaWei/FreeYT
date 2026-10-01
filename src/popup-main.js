import { initPopup } from './popup.js';

initPopup({ doc: document, settingsArea: chrome.storage.sync, tabs: chrome.tabs });
