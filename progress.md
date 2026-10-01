# FreeYT – plan

Goal: a Chrome extension that, when a YouTube video ad appears, reloads the page (F5) repeatedly until the ad is gone.

## Status
F1 done (scaffold). F2 done (`src/ad-detector.js` `isAdPlaying(doc)`, tested with a hand-written `querySelector` stub, no jsdom). F3 done (`src/retry-policy.js` `createRetryPolicy(storage, {maxAttempts, delayMs})` -> `onAdDetected(videoId)`, `onAdFree()`, `attempts(videoId)`; one tracked video in a single storage key; delay floor 500 ms; non-numeric options and corrupt stored counts fall back to defaults). F4–F7 pending; see `feature_list.json` (build order). Next: F4 content script wiring.

## Design
- Manifest V3, a single content script on `https://www.youtube.com/*`, permission `storage` only.
- Logic is split into small pure modules (ad detector, retry policy, settings) with injected DOM/storage so everything is unit-testable without a browser. The content script is thin wiring.
- Ad detection: `#movie_player.ad-showing`, `.ytp-ad-player-overlay`, `.video-ads .ad-interstitial` (YouTube markup changes; keep selectors in one place).
- Retry counter in `sessionStorage` keyed by video id, so it survives the reload; hard cap and minimum delay prevent an infinite tight loop.
- YouTube is an SPA: handle `yt-navigate-finish`.

## Verify command
`npm test` (`node --test "test/*.test.js"`; the glob is needed on Node 24; no browser, no network).

## Notes for the next session
- Ads are frequently chosen server-side per request, so reloading may show another ad; that is why the cap/backoff matters. Real effectiveness can only be checked in a real browser.
- Need manual acceptance (not automatable): load unpacked, open a video with ads, confirm reloads stop when the ad is gone, confirm cap behaviour, confirm no reload on home/Shorts.
- Follow coding-standards: English one-line commits `<type>: <desc>`, feature + its tests in one commit, version only in package.json, no `CLAUDE.md`/`.claude`/`dist` in git.
- Open questions in `feature_list.json` (tooling, behaviour at cap, ad scope, UI, browsers) await the user's answers; defaults are the first option of each.
- F2 modules are ES modules, but MV3 content scripts cannot use static `import`. F4 must load them via dynamic `import(chrome.runtime.getURL(...))` (needs `web_accessible_resources`) or a bundling step; decide then.
