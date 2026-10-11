#!/usr/bin/env python3
"""Builds the Favalia website from src/ into this folder. Python 3 standard library only.

    python3 tools/build.py

The site is in three languages. English lives at the root (/, /word-duel/ ...), French under /fr/ and
Spanish under /es/, with the same folder layout in each.

src/site.json            studio details and one entry per game. When a game goes live, put its
                         App Store number in "appStoreId" and rebuild: every "Coming soon" for it
                         turns into the App Store badge (in each language).
src/i18n.json            the words used by the shared header, footer, menu and buttons, per language.
src/partials/            head, header and footer shared by every page, and icons/*.svg
src/pages/<lang>/*.html  one file per page and language (en, fr, es). The first line is an HTML
                         comment holding the page's settings as JSON ("out", "title", "description",
                         ...). A page should exist in all three languages under the same "out".

Placeholders: {{root}} relative path to the site root (assets), {{l}} relative path to the current
language's home (page links), {{t:key}} a word from i18n.json, {{lang}}, {{svg:name}}, {{cta:game}},
{{appurl:game}}, {{status:game}}, {{game:game:key}}, {{site:key}}, {{page:key}}, {{cur:nav}},
{{alt:lang}} this page in another language, {{v:path}} (cache key).
Blocks: <!--live:game--> ...shown once the game has an App Store ID... <!--else--> ...until then... <!--/live-->
"""
import hashlib
import html
import json
import pathlib
import posixpath
import re
import sys

SITE_DIR = pathlib.Path(__file__).resolve().parent.parent
SRC = SITE_DIR / "src"
if not (SITE_DIR / ".favalia-website").exists():
    sys.exit("This script only writes into the favalia.ca website folder.")

LANGS = ["en", "fr", "es"]
OG_LOCALE = {"en": "en_CA", "fr": "fr_CA", "es": "es_ES"}
BADGE_LANG = {"en": "en-us", "fr": "fr-ca", "es": "es-mx"}

site = json.loads((SRC / "site.json").read_text())
i18n = json.loads((SRC / "i18n.json").read_text())
games = site["games"]
partials = {p.stem: p.read_text() for p in (SRC / "partials").glob("*.html")}
icons = {p.stem: p.read_text().strip() for p in (SRC / "partials" / "icons").glob("*.svg")}
BADGE = "https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/"
TOKEN = re.compile(r"\{\{([a-zA-Z]+)(?::([^}]*))?\}\}")
LIVE = re.compile(r"<!--live:([a-z-]+)-->(.*?)<!--else-->(.*?)<!--/live-->", re.S)
warnings = []


def t(lang, key):
    if key in i18n[lang]:
        return i18n[lang][key]
    warnings.append(f"missing translation {lang}:{key}")
    return i18n["en"].get(key, key)


def app_url(slug):
    g = games[slug]
    return f"https://apps.apple.com/app/{g['appStoreSlug']}/id{g['appStoreId']}" if g.get("appStoreId") else ""


def localized(value, lang):
    return value.get(lang, value["en"]) if isinstance(value, dict) else value


def cta(slug, lang):
    g = games[slug]
    if app_url(slug):
        label = t(lang, "badge.aria").replace("{name}", g["name"])
        return (f'<a class="appstore" href="{app_url(slug)}" aria-label="{label}">'
                f'<img src="{BADGE}{BADGE_LANG[lang]}" alt="{t(lang, "badge.alt")}" height="54" loading="lazy"></a>')
    return f'<span class="soon">{t(lang, "cta.soon")}</span>'


def version(rel):
    return hashlib.md5((SITE_DIR / rel).read_bytes()).hexdigest()[:8]


def folder(out):
    """The URL folder of an output file: 'fr/word-duel/index.html' -> 'fr/word-duel'."""
    return posixpath.dirname(out) or "."


def rel_url(from_out, to_out):
    r = posixpath.relpath(folder(to_out), folder(from_out))
    return "./" if r == "." else r + "/"


def abs_url(out):
    return f'{site["domain"]}/{out.removesuffix("index.html")}'


def json_ld(page):
    kind = page.get("jsonld")
    if not kind:
        return ""
    org = {"@type": "Organization", "name": site["studio"], "url": site["domain"] + "/",
           "logo": site["domain"] + "/apple-touch-icon.png", "email": site["email"],
           "address": {"@type": "PostalAddress", "addressLocality": site["city"],
                       "addressRegion": site["region"], "addressCountry": "CA"}}
    if kind == "org":
        data = {"@context": "https://schema.org", **org}
    else:
        slug = kind.split(":", 1)[1]
        g = games[slug]
        data = {
            "@context": "https://schema.org",
            "@type": "MobileApplication",
            "name": g["name"],
            "alternateName": f'{g["name"]}: {localized(g["subtitle"], page["lang"])}',
            "description": page["description"],
            "url": page["url"],
            "inLanguage": page["lang"],
            "image": f'{site["domain"]}/assets/img/{slug}/icon.png',
            "operatingSystem": "iOS, iPadOS",
            "applicationCategory": "GameApplication",
            "applicationSubCategory": localized(g["genre"], page["lang"]),
            "contentRating": g["age"],
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "author": org,
            "publisher": org,
        }
        if app_url(slug):
            data["installUrl"] = app_url(slug)
            data["downloadUrl"] = app_url(slug)
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def render(text, page, siblings):
    lang, root, out = page["lang"], page["root"], page["out"]
    home = root if lang == "en" else root + lang + "/"
    single = page.get("single") or len(siblings) < 2

    def alt(other):
        if single or other not in siblings:
            return root if other == "en" else root + other + "/"
        target = siblings[other]["out"]
        return "/" + target.removesuffix("index.html") if root.startswith("/") else rel_url(out, target)

    def sub(m):
        key, arg = m.group(1), m.group(2)
        if key == "root":
            return root
        if key == "l":
            return home
        if key == "lang":
            return lang
        if key == "t":
            return t(lang, arg)
        if key == "svg":
            return icons[arg]
        if key == "cta":
            return cta(arg, lang)
        if key == "appurl":
            return app_url(arg) or (home + arg + "/")
        if key == "status":
            return t(lang, "status.live" if app_url(arg) else "status.soon")
        if key == "game":
            slug, field = arg.split(":")
            value = localized(games[slug][field], lang)
            if field in ("support", "privacy", "terms") and not re.match(r"^[a-z]+:", value):
                return home + value
            return value
        if key == "site":
            return str(site[arg])
        if key == "page":
            value = page.get(arg, "")
            return value if arg in ("extraHead", "bodyClass") else html.escape(value, quote=True)
        if key == "cur":
            return ' aria-current="page"' if page.get("nav") == arg else ""
        if key == "curlang":
            return ' aria-current="true"' if arg == lang else ""
        if key == "alt":
            return alt(arg)
        if key == "locale":
            return OG_LOCALE[lang]
        if key == "hreflang":
            if single:
                return ""
            links = [f'<link rel="alternate" hreflang="{l}" href="{abs_url(siblings[l]["out"])}">' for l in LANGS if l in siblings]
            links.append(f'<link rel="alternate" hreflang="x-default" href="{abs_url(siblings["en"]["out"])}">')
            locales = "".join(f'\n<meta property="og:locale:alternate" content="{OG_LOCALE[l]}">' for l in LANGS if l != lang and l in siblings)
            return "\n".join(links) + locales
        if key == "langredirect":
            # First visit to an English page with a French or Spanish browser: show that language once.
            # A choice made in the language switch is remembered and always wins.
            if single or lang != "en":
                return ""
            targets = ",".join(f"{l}:'{alt(l)}'" for l in LANGS if l != "en" and l in siblings)
            return ("<script>(function(){var A={" + targets + "},p=null;try{p=localStorage.getItem('favalia-lang')}catch(e){}"
                    "if(p||document.referrer.indexOf(location.host)>-1)return;var n=navigator.languages||[navigator.language||''];"
                    "for(var i=0;i<n.length;i++){var c=String(n[i]).slice(0,2).toLowerCase();if(c==='en')return;"
                    "if(A[c]){location.replace(A[c]+location.hash);return}}})();</script>")
        if key == "v":
            return version(arg)
        if key == "partial":
            return partials[arg]
        if key == "jsonld":
            return json_ld(page)
        if key == "scripts":
            return "\n".join(
                f'<script src="{root}assets/js/{s}?v={version("assets/js/" + s)}" defer></script>'
                for s in page.get("scripts", []))
        raise KeyError(f"Unknown placeholder {m.group(0)} in {out}")

    text = LIVE.sub(lambda m: m.group(2) if app_url(m.group(1)) else m.group(3), text)
    for _ in range(6):
        new = TOKEN.sub(sub, text)
        if new == text:
            break
        text = new
    return text


def build():
    pages = []
    for lang in LANGS:
        for src in sorted((SRC / "pages" / lang).glob("*.html")):
            raw = src.read_text()
            head, _, body = raw.partition("-->")
            page = json.loads(head.strip().removeprefix("<!--"))
            page["lang"] = lang
            page["rel"] = page["out"]
            page["out"] = page["out"] if lang == "en" else f'{lang}/{page["out"]}'
            page["body"] = body
            page.setdefault("root", "../" * page["out"].count("/"))
            page.setdefault("url", abs_url(page["out"]))
            page.setdefault("ogTitle", page["title"])
            og = page.get("og", "favalia")
            page["og"] = og if lang == "en" else f"{og}-{lang}"
            if not (SITE_DIR / f'assets/img/og/{page["og"]}.jpg').exists():
                warnings.append(f'missing share image assets/img/og/{page["og"]}.jpg ({page["out"]})')
            page.setdefault("bodyClass", "")
            pages.append(page)

    by_rel = {}
    for p in pages:
        by_rel.setdefault(p["rel"], {})[p["lang"]] = p
    for rel, group in by_rel.items():
        if not any(p.get("single") for p in group.values()):
            for lang in LANGS:
                if lang not in group:
                    warnings.append(f"{rel} has no {lang} version")

    for p in pages:
        doc = "{{partial:head}}{{partial:header}}" + p["body"].strip("\n") + "\n{{partial:footer}}"
        target = SITE_DIR / p["out"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render(doc, p, by_rel[p["rel"]]))
        print(f"  {p['out']}")

    rows = []
    for rel, group in by_rel.items():
        for lang, p in group.items():
            if p.get("noindex"):
                continue
            alts = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{abs_url(group[l]["out"])}"/>'
                           for l in LANGS if l in group and len(group) > 1)
            rows.append(f'  <url><loc>{abs_url(p["out"])}</loc>{alts}\n  </url>\n')
    (SITE_DIR / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "".join(rows) + "</urlset>\n")
    print(f"  sitemap.xml ({len(rows)} pages)")
    for w in sorted(set(warnings)):
        print("  ! " + w)


if __name__ == "__main__":
    build()
