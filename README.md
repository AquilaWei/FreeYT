# FreeYT

A Chrome extension (Manifest V3) that **reloads a YouTube watch page (F5)** when a video ad shows up, and keeps doing so until the ad is gone.

> Status: in progress. Ad detection, the retry policy and the content script wiring (reload on ad, only on `/watch`, resume the playback position after a mid-roll ad) and SPA navigation between videos are implemented and unit-tested, but not yet verified in a real browser.

## Load the unpacked extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Run tests

```sh
npm test
```

Needs Node 20+; no dependencies, no browser, no network.
