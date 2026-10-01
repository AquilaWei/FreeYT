# FreeYT

A Chrome extension (Manifest V3) that **reloads a YouTube watch page (F5)** when a video ad shows up, and keeps doing so until the ad is gone.

> Status: in progress. The ad detector and the retry policy (reload cap, minimum delay, per-video counter) are done and tested. The content script that wires them to the YouTube page is not implemented yet, so the extension does not reload anything yet.

## Load the unpacked extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Run tests

```sh
npm test
```

Needs Node 20+; no dependencies, no browser, no network.
