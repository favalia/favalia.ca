#!/usr/bin/env python3
"""Builds the Favalia website from src/ into this folder. Python 3 standard library only.

    python3 tools/build.py

src/site.json            studio details and one entry per game. When a game goes live, put its
                         App Store number in "appStoreId" and rebuild: every "Coming soon" for it
                         turns into the App Store badge.
src/partials/            head, header and footer shared by every page, and icons/*.svg
src/pages/*.html         one file per page. The first line is an HTML comment holding the page's
                         settings as JSON ("out", "title", "description", ...).

Placeholders: {{root}} relative path to the site root, {{svg:name}}, {{cta:game}}, {{appurl:game}},
{{status:game}}, {{game:game:key}}, {{site:key}}, {{page:key}}, {{cur:nav}}, {{v:path}} (cache key).
Blocks: <!--live:game--> ...shown once the game has an App Store ID... <!--else--> ...until then... <!--/live-->
"""
import hashlib
import html
import json
import pathlib
import re
import sys

SITE_DIR = pathlib.Path(__file__).resolve().parent.parent
SRC = SITE_DIR / "src"
if not (SITE_DIR / ".favalia-website").exists():
    sys.exit("This script only writes into the favalia.ca website folder.")

site = json.loads((SRC / "site.json").read_text())
games = site["games"]
partials = {p.stem: p.read_text() for p in (SRC / "partials").glob("*.html")}
icons = {p.stem: p.read_text().strip() for p in (SRC / "partials" / "icons").glob("*.svg")}
BADGE = "https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/en-us"
TOKEN = re.compile(r"\{\{([a-zA-Z]+)(?::([^}]*))?\}\}")
# <!--live:game--> shown once the game is on the App Store <!--else--> shown until then <!--/live-->
LIVE = re.compile(r"<!--live:([a-z-]+)-->(.*?)<!--else-->(.*?)<!--/live-->", re.S)


def app_url(slug):
    g = games[slug]
    return f"https://apps.apple.com/app/{g['appStoreSlug']}/id{g['appStoreId']}" if g.get("appStoreId") else ""


def cta(slug):
    g = games[slug]
    if app_url(slug):
        return (f'<a class="appstore" href="{app_url(slug)}" aria-label="Download {g["name"]} on the App Store">'
                f'<img src="{BADGE}" alt="Download on the App Store" width="162" height="54" loading="lazy"></a>')
    return '<span class="soon">Coming soon to the App Store</span>'


def version(rel):
    return hashlib.md5((SITE_DIR / rel).read_bytes()).hexdigest()[:8]


def link(target, root):
    """Site-relative paths in site.json (no scheme) get the page's root prefix."""
    return target if re.match(r"^[a-z]+:", target) else root + target


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
            "alternateName": f'{g["name"]}: {g["subtitle"]}',
            "description": page["description"],
            "url": page["url"],
            "image": f'{site["domain"]}/assets/img/{slug}/icon.png',
            "operatingSystem": "iOS, iPadOS",
            "applicationCategory": "GameApplication",
            "applicationSubCategory": g["genre"],
            "contentRating": g["age"],
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "author": org,
            "publisher": org,
        }
        if app_url(slug):
            data["installUrl"] = app_url(slug)
            data["downloadUrl"] = app_url(slug)
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def render(text, page, root):
    def sub(m):
        key, arg = m.group(1), m.group(2)
        if key == "root":
            return root
        if key == "svg":
            return icons[arg]
        if key == "cta":
            return cta(arg)
        if key == "appurl":
            return app_url(arg) or (root + arg + "/")
        if key == "status":
            return "On the App Store" if app_url(arg) else "Coming soon"
        if key == "game":
            slug, field = arg.split(":")
            value = games[slug][field]
            return link(value, root) if field in ("support", "privacy", "terms") else value
        if key == "site":
            return str(site[arg])
        if key == "page":
            value = page.get(arg, "")
            return value if arg in ("extraHead", "bodyClass") else html.escape(value, quote=True)
        if key == "cur":
            return ' aria-current="page"' if page.get("nav") == arg else ""
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
        raise KeyError(f"Unknown placeholder {m.group(0)} in {page['out']}")

    text = LIVE.sub(lambda m: m.group(2) if app_url(m.group(1)) else m.group(3), text)
    for _ in range(6):
        new = TOKEN.sub(sub, text)
        if new == text:
            break
        text = new
    return text


def build():
    pages = []
    for src in sorted((SRC / "pages").glob("*.html")):
        raw = src.read_text()
        head, _, body = raw.partition("-->")
        page = json.loads(head.strip().removeprefix("<!--"))
        out = page["out"]
        depth = out.count("/")
        root = page.get("root", "../" * depth)
        path = out.removesuffix("index.html")
        page.setdefault("url", f'{site["domain"]}/{path}')
        page.setdefault("ogTitle", page["title"])
        page.setdefault("og", "favalia")
        page.setdefault("bodyClass", "")
        doc = "{{partial:head}}{{partial:header}}" + body.strip("\n") + "\n{{partial:footer}}"
        target = SITE_DIR / out
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render(doc, page, root))
        pages.append(page)
        print(f"  {out}")

    urls = [p["url"] for p in pages if not p.get("noindex")]
    (SITE_DIR / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    print(f"  sitemap.xml ({len(urls)} pages)")


if __name__ == "__main__":
    build()
