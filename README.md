# FreeYT

A Chrome extension (Manifest V3) that **reloads a YouTube watch page (F5)** when a video ad shows up, and keeps doing so until the ad is gone.

> Status: scaffold only. Ad detection and reload logic are not implemented yet.

## Load the unpacked extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Run tests

```sh
npm test
```

Needs Node 20+; no dependencies, no browser, no network.
