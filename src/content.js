// MV3 content scripts cannot use static `import`, so this stays a classic script
// that loads the real entry point as a module (see web_accessible_resources).
import(chrome.runtime.getURL('src/main.js'));
