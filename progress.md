# FreeYT – plan

Goal: a Chrome extension that, when a YouTube video ad appears, reloads the page (F5) repeatedly until the ad is gone.

## Status
F1 done (scaffold). F2 done (`src/ad-detector.js` `isAdPlaying(doc)`, tested with a hand-written `querySelector` stub, no jsdom). F3 done (`src/retry-policy.js` `createRetryPolicy(storage, {maxAttempts, delayMs})` -> `onAdDetected(videoId)`, `onAdFree()`, `attempts(videoId)`; one tracked video in a single storage key; delay floor 500 ms; non-numeric options and corrupt stored counts fall back to defaults). F4 done (`src/ad-guard.js` `createAdGuard({...}).start()/stop()`, all env injected; `src/content.js` is a classic-script loader that `import()`s `src/main.js`, modules listed in `web_accessible_resources`; settle window 3000 ms resets the counter). F5–F7 pending; see `feature_list.json` (build order). Next: F5 SPA navigation (`yt-navigate-finish` -> `stop()` then `start()`; guard already tolerates repeated start/stop). Resume-after-reload (user request): before reloading, the guard saves the last content `currentTime` (from capture-phase `timeupdate` while no ad shows) under `freeyt.resume` in sessionStorage; after the reload it seeks there on the first ad-free `timeupdate`. Not yet verified in a real browser.

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
- Need manual acceptance (not automatable): load unpacked, open a video with ads, confirm reloads stop when the ad is gone, confirm cap behaviour, confirm no reload on home/Shorts, mid-roll ad -> after reload the video returns to the position before the ad.
- Follow coding-standards: English one-line commits `<type>: <desc>`, feature + its tests in one commit, version only in package.json, no `CLAUDE.md`/`.claude`/`dist` in git.
- Open questions in `feature_list.json` (tooling, behaviour at cap, ad scope, UI, browsers) await the user's answers; defaults are the first option of each.
- F2 modules are ES modules, but MV3 content scripts cannot use static `import`. F4 chose dynamic `import()` + `web_accessible_resources`; new modules must be added to that list (a manifest test checks it).
