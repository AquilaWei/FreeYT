# Changelog

## 0.2.0

The 0.1.1 changes, now verified in Chrome:

- Tries up to 20 reloads by default before letting the ad play; the popup now allows up to 100.
- New icon in the toolbar and on the extensions page.
- Redesigned popup with an on/off switch in the header, a reload counter and dark mode.
- Uses less CPU when a page opens before the video player has loaded.

## 0.1.1

- Tries up to 20 reloads by default before letting the ad play; the popup now allows up to 100.
- New icon in the toolbar and on the extensions page.
- Redesigned popup with an on/off switch in the header, a reload counter and dark mode.
- Uses less CPU when a page opens before the video player has loaded.

## 0.1.0

- Reloads a YouTube watch page when a video ad appears, up to a limit, with a minimum delay between reloads.
- Returns to the position you were at before a mid-roll ad.
- Keeps working when you move between videos without a full page load.
- Popup with an on/off switch, max reloads, reload delay and this tab's reload count.
- `npm run build` packs the extension into `dist/freeyt-<version>.zip`.
