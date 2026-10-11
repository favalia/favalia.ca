# favalia.ca

The website of **Favalia**, an independent game studio: a home page for our games, a page for each game
(Word Duel, Inki Run, Inki Ace) with a small playable demo, and support and privacy pages.

Plain HTML, CSS and JavaScript with no framework. Hosted on GitHub Pages at **https://favalia.ca**.
Every page loads Google Analytics 4 (`ga4` in `src/site.json`) and Google Tag Manager (`gtm`).
Don't also add the same GA4 ID as a Google tag inside Tag Manager, or page views are counted twice.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## How it's built

The pages are generated from `src/` by a small Python script (standard library only):

```bash
python3 tools/build.py
```

| What | Where |
| --- | --- |
| Page content | `src/pages/*.html` (first line: the page's settings as JSON) |
| Header, menu, footer | `src/partials/` |
| Studio details and per-game settings | `src/site.json` |
| Styles | `assets/css/site.css` |
| Browser demos | `assets/js/demo-*.js` |

The build writes `index.html`, `word-duel/`, `inki-run/`, `inki-ace/`, `support/`, `404.html` and
`sitemap.xml`; edit `src/` rather than those files.

When a game launches, set its `appStoreId` in `src/site.json` and rebuild: every "Coming soon" for that
game turns into the App Store badge.

`tools/` also holds the helpers that prepare images and videos, and `tools/og.html` draws the 1200×630
social share cards.

## Publishing

GitHub Pages serves this repository with the custom domain in `CNAME`. The domain's DNS uses GitHub's
Pages addresses (`A` records `185.199.108.153`–`185.199.111.153`, `www` → `favalia.github.io`).

© Favalia. Game names, artwork, screenshots and videos are not licensed for reuse.
