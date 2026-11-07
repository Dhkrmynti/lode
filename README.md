# LODE

Landing page for **LODE**, a proof-of-work coin you mine from the terminal (`lode mine`).

Static site, no build step:

- `index.html` and `style.css` hold the page (dusk theme).
- `js/index.js` drives the simulated `lode mine` terminal, the live node feed, the stats, and the parallax.
- `js/water.js` is the WebGL water shader over the hero and CTA renders. It adds rippling reflections, glints, cursor rings, and the pulsing gold vein. The hero also overlays a looping video of the floating ore.
- `img/` holds the Blender renders (`hero.jpg`, `cta.jpg`, `hero-ore.mp4`).
- `api/stats.json` is a static stats snapshot; there is no live backend.

## Run locally

```sh
python3 -m http.server 3011 --bind 127.0.0.1
# open http://127.0.0.1:3011
```

Any static file server works. The page uses ES modules, so open it over HTTP, not `file://`.
