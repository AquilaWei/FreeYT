// YouTube changes its markup from time to time; keep every selector here.
export const AD_SELECTORS = [
  '#movie_player.ad-showing',
  '.ytp-ad-player-overlay',
  '.video-ads .ad-interstitial',
];

/**
 * Tells whether a video ad is currently playing.
 *
 * Takes the document as a parameter so tests can pass a stub; only
 * `querySelector` is used. Never throws on a page without a player (home,
 * search): it just returns false.
 *
 * @param {{querySelector: (selector: string) => unknown}} doc
 * @returns {boolean}
 */
export function isAdPlaying(doc) {
  return AD_SELECTORS.some((selector) => doc.querySelector(selector) !== null);
}
