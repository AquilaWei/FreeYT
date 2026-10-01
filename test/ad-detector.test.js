import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdPlaying } from '../src/ad-detector.js';

// Minimal DOM stub: querySelector answers only for the selectors listed as present.
const pageWith = (...presentSelectors) => ({
  querySelector: (selector) => (presentSelectors.includes(selector) ? {} : null),
});

test('returns true when #movie_player has class ad-showing', () => {
  assert.equal(isAdPlaying(pageWith('#movie_player.ad-showing')), true);
});

test('returns true when .ytp-ad-player-overlay exists', () => {
  assert.equal(isAdPlaying(pageWith('.ytp-ad-player-overlay')), true);
});

test('returns true when .ad-interstitial is inside .video-ads', () => {
  assert.equal(isAdPlaying(pageWith('.video-ads .ad-interstitial')), true);
});

test('returns false for a normal video with the player but no ad markup', () => {
  assert.equal(isAdPlaying(pageWith('#movie_player', '.video-ads')), false);
});

test('returns false for a page with no player', () => {
  assert.equal(isAdPlaying(pageWith()), false);
});
