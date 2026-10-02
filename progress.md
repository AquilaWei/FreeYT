# FreeYT – plan

Goal: a Chrome extension that, when a YouTube video ad appears, reloads the page (F5) repeatedly until the ad is gone.

## Status
F1 done (scaffold). F2 done (`src/ad-detector.js` `isAdPlaying(doc)`, tested with a hand-written `querySelector` stub, no jsdom). F3 done (`src/retry-policy.js` `createRetryPolicy(storage, {maxAttempts, delayMs})` -> `onAdDetected(videoId)`, `onAdFree()`, `attempts(videoId)`; one tracked video in a single storage key; delay floor 500 ms; non-numeric options and corrupt stored counts fall back to defaults). F4 done (`src/ad-guard.js` `createAdGuard({...}).start()/stop()`, all env injected; `src/content.js` is a classic-script loader that `import()`s `src/main.js`, modules listed in `web_accessible_resources`; settle window 3000 ms resets the counter). F5 done (`src/spa-navigation.js` `createSpaNavigation({target, guard}).init()/dispose()`; `yt-navigate-finish` -> `stop()` then `start()`, idempotent init; wired in `main.js`, listed in `web_accessible_resources`). F6 done (`src/settings.js` defaults/clamp/load/save on `chrome.storage.sync`; `src/app.js` `startApp` reads settings once per page load, `enabled=false` -> nothing runs, answers popup's `freeyt.attempts` runtime message; `popup.html` + `src/popup.js` single page with toggle, max reloads, delay, per-tab count; manifest `permissions: [storage]`, `action.default_popup`). F7 done (`scripts/build.js`, `npm run build` -> `dist/freeyt-<version>.zip` via a dependency-free zip writer, manifest + popup + `src/` only; `CHANGELOG.md` top entry checked against package version; README has the manual acceptance checklist). All features pass; real-browser acceptance is done, version bumped to 0.1.0, tagged `v0.1.0` and released on GitHub (release assets: `freeyt-0.1.0.zip` + `.sha256`). Resume-after-reload (user request): before reloading, the guard saves the last content `currentTime` (from capture-phase `timeupdate` while no ad shows) under `freeyt.resume` in sessionStorage; after the reload it seeks there on the first ad-free `timeupdate`. Not yet verified in a real browser.

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
- Settle window (ad-free → reset retry counter) starts only after a non-ad `<video>` `timeupdate`, never from "no ad visible" alone; otherwise a slow-loading pre-roll resets the counter and the reload cap never triggers.
- `yt-navigate-finish` for the same `pathname` + `v` is ignored by `createSpaNavigation` (it needs `location`); otherwise the restart cancels a pending reload and counts one ad as two attempts.
- Manual real-browser check, resume seek: the seek runs on the first ad-free `timeupdate`. If YouTube adds `ad-showing` only after the pre-roll's first `timeupdate`, the guard would set `currentTime` on the ad's video and drop the saved position.
- Manual real-browser check, observer scope: without `#movie_player` the guard observes class changes on the whole `body`, which can be expensive; it switches to the player only after the next navigation restarts it.
- F6: no separate options page; the popup holds all settings. Changes apply from the next page load (not live). The popup gets the reload count via `tabs.sendMessage` to the content script (avoids the `scripting` permission). Real-browser check: popup shows the count on a watch page and `–` elsewhere; disabling stops reloads after a refresh.

## After 0.1.0 (2026-10-02)
- User confirmed basic functions work in Chrome. Resume-after-reload was not called out separately; re-check it with the next real-browser pass.
- User answers: at the cap, stop reloading and let the ad play; cap raised (default 20, popup max 100). Trigger on every ad that interrupts playback (pre-roll and mid-roll); current selectors already cover that, overlay banners are excluded on purpose.
- Observer: while `#movie_player` is missing the guard observes `body`, then moves to the player on the first mutation that finds it (no longer waits for the next navigation).
- Icon: source `assets/icon.svg` (not shipped), PNGs in `icons/` (shipped). Popup redesigned (header switch, count card, settings card, dark mode); element ids unchanged so `src/popup.js` and its tests are untouched.
- Needs a real-browser check: icon in the toolbar and on `chrome://extensions`, popup look in light and dark mode, cap 20 reached on a stubborn ad.

## Pending after 0.1.0
- Non-blocking risks: the resume seek landing on an ad's video, and settings applying only from the next page load (see notes above).
- Open questions in `feature_list.json` still unanswered: tooling, popup scope, target browsers; defaults stay the first option.
- `v0.1.0` stays on the version-bump commit (no LICENSE in that tag); it is not moved.
- Chrome Web Store listing: not discussed, needs the user's decision.
