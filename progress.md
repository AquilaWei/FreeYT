# FreeYT – plan

Goal: a Chrome extension that, when a YouTube video ad appears, reloads the page (F5) repeatedly until the ad is gone.

## Status
Planning only. The repo was empty; nothing is implemented. See `feature_list.json` (F1–F7, in build order).

## Design
- Manifest V3, a single content script on `https://www.youtube.com/*`, permission `storage` only.
- Logic is split into small pure modules (ad detector, retry policy, settings) with injected DOM/storage so everything is unit-testable without a browser. The content script is thin wiring.
- Ad detection: `#movie_player.ad-showing`, `.ytp-ad-player-overlay`, `.video-ads .ad-interstitial` (YouTube markup changes; keep selectors in one place).
- Retry counter in `sessionStorage` keyed by video id, so it survives the reload; hard cap and minimum delay prevent an infinite tight loop.
- YouTube is an SPA: handle `yt-navigate-finish`.

## Verify command
`npm test` (proposed; uses `node --test`, no browser, no network). F1 must create `package.json` so it works.

## Notes for the next session
- Ads are frequently chosen server-side per request, so reloading may show another ad; that is why the cap/backoff matters. Real effectiveness can only be checked in a real browser.
- Need manual acceptance (not automatable): load unpacked, open a video with ads, confirm reloads stop when the ad is gone, confirm cap behaviour, confirm no reload on home/Shorts.
- Follow coding-standards: English one-line commits `<type>: <desc>`, feature + its tests in one commit, version only in package.json, no `CLAUDE.md`/`.claude`/`dist` in git.
- Open questions in `feature_list.json` (tooling, behaviour at cap, ad scope, UI, browsers) await the user's answers; defaults are the first option of each.
