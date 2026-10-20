# Wrapper WebXR demo

A static Three.js and native WebXR image-tracking demo. The uploaded wrapper photo is included and selected by default. Enter the printed width, open the site on a compatible WebXR device, and scan the same image to place the floating objects. You can choose a different image if desired. Tap the scene (or a visible object in the desktop preview) for an extra burst animation.

## Run locally

Serve this folder from `localhost` (WebXR requires a secure context):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The page loads Three.js from jsDelivr, so an internet connection is required.

## Publish with GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the app and included wrapper image on each push to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. GitHub Pages provides HTTPS, which is required by WebXR.

## Device support

Image tracking is an optional WebXR feature and is not available in every browser/device combination. Use an immersive AR browser that supports WebXR image tracking (currently most commonly Chrome on compatible Android devices). The page reports when immersive AR is unavailable. The image is selected in the browser and is not uploaded to a server.
