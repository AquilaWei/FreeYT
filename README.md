# FreeYT

A Chrome extension (Manifest V3) that **reloads a YouTube watch page (F5)** when a video ad shows up, and keeps doing so until the ad is gone.

> Status: 0.2.0 is verified in Chrome (checklist below).

## Load the unpacked extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Build a zip

```sh
npm run build
```

Writes `dist/freeyt-<version>.zip` with the manifest, popup and `src/` only.

## Run tests

```sh
npm test
```

Needs Node 22+; no dependencies, no browser, no network.

## Icons

The source is `assets/icon.svg`. After changing it, regenerate the PNGs (needs ImageMagick 7):

```sh
for s in 16 32 48 128; do magick -background none -density 384 assets/icon.svg -resize ${s}x${s} -strip icons/icon-$s.png; done
```

## Manual acceptance checklist (real browser)

Automated tests use fakes, so these need a real Chrome:

- [ ] Load unpacked (see above) and open a `youtube.com/watch` video that shows an ad
- [ ] The page reloads and stops reloading once the ad is gone
- [ ] If the ad persists, reloads stop at the max-reload cap and the console explains why
- [ ] No reload on the home page, search or Shorts
- [ ] Mid-roll ad: after the reload the video returns to the position before the ad
- [ ] Moving to another video from the sidebar re-arms the guard with a fresh count
- [ ] Popup shows the reload count on a watch page and `–` elsewhere
- [ ] Turning the toggle off and refreshing stops all reloads

## License

[BSD 3-Clause](LICENSE)
