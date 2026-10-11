# favalia.ca

The website of **Favalia**, an independent game studio: a home page for our games, a page for each game
(Word Duel, Inki Run, Inki Ace) with a small playable demo, and support and privacy pages.

Plain HTML, CSS and JavaScript with no framework. Hosted on GitHub Pages at **https://favalia.ca**.
## Privacy and consent

Google Analytics 4 (`ga4` in `src/site.json`) and Google Tag Manager (`gtm`) only load after a visitor
agrees in the cookie banner (`assets/js/consent.js`, English/French). The loader at the top of
`src/partials/head.html` sets Google Consent Mode v2 to "denied" first and applies the saved choice
(`favalia-consent` in local storage, asked again after 12 months or when `VERSION` changes).
Every page has a "Cookie settings" link; withdrawing consent deletes Google's cookies. The website privacy
policy is `src/pages/privacy.html` (English and French); update it whenever you add tools or cookies.

- Don't also add the GA4 ID as a Google tag inside Tag Manager (page views would count twice).
- Tag Manager loads once analytics or marketing is accepted. Google tags respect Consent Mode on their
  own; give any other tag (Meta pixel, etc.) a consent check (`ad_storage`) or the `favalia_consent`
  event with `consent_marketing` = true as its trigger.

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


© Favalia. Game names, artwork, screenshots and videos are not licensed for reuse.
