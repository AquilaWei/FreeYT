import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { build } from '../scripts/build.js';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// Reads the central directory: [{ name, data }] with data inflated.
function readZip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let pos = buf.readUInt32LE(end + 16);
  const files = [];
  for (let i = 0; i < count; i++) {
    const size = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const local = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    files.push({ name, data: inflateRawSync(buf.subarray(start, start + size)) });
    pos += 46 + nameLen;
  }
  return files;
}

const outDir = mkdtempSync(join(tmpdir(), 'freeyt-build-'));
const zipPath = build(root, outDir);
const files = readZip(readFileSync(zipPath));

test('build writes freeyt-<version>.zip named after the package.json version', () => {
  assert.equal(zipPath, join(outDir, `freeyt-${pkg.version}.zip`));
});

test('zip contains the manifest and the popup page', () => {
  const names = files.map((f) => f.name);
  assert.ok(names.includes('manifest.json'));
  assert.ok(names.includes('popup.html'));
});

test('zip contains every src module and nothing else under src', () => {
  const srcNames = files.map((f) => f.name).filter((n) => n.startsWith('src/'));
  assert.deepEqual(srcNames, [
    'src/ad-detector.js', 'src/ad-guard.js', 'src/app.js', 'src/content.js', 'src/main.js',
    'src/popup-main.js', 'src/popup.js', 'src/retry-policy.js', 'src/settings.js', 'src/spa-navigation.js',
  ]);
});

test('zip excludes tests, scripts, node_modules and package files', () => {
  const bad = files.map((f) => f.name).filter((n) => /^(test|scripts|node_modules|package|dist)/.test(n));
  assert.deepEqual(bad, []);
});

test('zipped manifest is byte-identical to manifest.json', () => {
  const manifest = files.find((f) => f.name === 'manifest.json');
  assert.deepEqual(manifest.data, readFileSync(join(root, 'manifest.json')));
});
