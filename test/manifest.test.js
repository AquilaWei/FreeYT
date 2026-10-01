import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = readJson('../manifest.json');
const pkg = readJson('../package.json');

test('manifest is Manifest V3', () => {
  assert.equal(manifest.manifest_version, 3);
});

test('manifest has a non-empty name', () => {
  assert.equal(manifest.name, 'FreeYT');
});

test('manifest version equals package.json version', () => {
  assert.equal(manifest.version, pkg.version);
});

test('content script matches https://www.youtube.com/*', () => {
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.youtube.com/*']);
});

test('content script file listed in manifest exists', () => {
  const file = manifest.content_scripts[0].js[0];
  assert.doesNotThrow(() => readFileSync(new URL(`../${file}`, import.meta.url)));
});

test('modules loaded by the content script are web accessible', () => {
  const resources = manifest.web_accessible_resources[0].resources;
  assert.deepEqual(resources.sort(), ['src/ad-detector.js', 'src/ad-guard.js', 'src/main.js', 'src/retry-policy.js', 'src/spa-navigation.js']);
});
