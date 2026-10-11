#!/bin/zsh
# Rebuilds the web images in assets/img from the game projects in ~/Documents.
# Only writes inside this website's assets/img folder.
set -euo pipefail
cd "$(dirname "$0")/.."
SITE="$PWD"
[[ -f "$SITE/.favalia-website" ]] || { echo "Run me from the favalia.ca website folder."; exit 1; }

DOCS="$HOME/Documents"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP:?}"' EXIT

# webp <source> <dest.webp> <max-width> [quality]
webp() {
  sips -s format png --resampleWidth "$3" "$1" --out "$TMP/x.png" >/dev/null
  cwebp -quiet -q "${4:-82}" -m 6 "$TMP/x.png" -o "$SITE/$2"
}
# icon <source> <dest-base>: 512 px PNG + WebP
icon() {
  sips -s format png -Z 512 "$1" --out "$SITE/$2.png" >/dev/null
  cwebp -quiet -q 90 -m 6 "$SITE/$2.png" -o "$SITE/$2.webp"
}

WD="$DOCS/word-duel/ios"
icon "$WD/WordDuel/Assets.xcassets/AppIcon.appiconset/icon.png" assets/img/word-duel/icon
for s in 1-name 2-game 3-perfect 4-duels 5-stats 6-home; do
  webp "$WD/store-shots/$s.png" "assets/img/word-duel/$s.webp" 720
done
webp "$WD/store-assets/creative/header-3840x1646.png" assets/img/word-duel/header.webp 1920 80

IR="$DOCS/ink-runner"
icon "$IR/InkRunner/Assets.xcassets/AppIcon.appiconset/icon-1024.png" assets/img/inki-run/icon
icon "$IR/InkRunner/Assets.xcassets/AppIcon.appiconset/icon-1024-dark.png" assets/img/inki-run/icon-dark
for f in "$IR"/AppStore/screenshots/6.9-inch/*.png; do
  webp "$f" "assets/img/inki-run/$(basename "${f%.png}").webp" 1434 80
done

IA="$DOCS/inki-ace"
icon "$IA/InkiAce/Assets.xcassets/AppIcon.appiconset/icon-1024.png" assets/img/inki-ace/icon
icon "$IA/InkiAce/Assets.xcassets/AppIcon.appiconset/icon-1024-dark.png" assets/img/inki-ace/icon-dark
for f in "$IA"/AppStore/screenshots/captures/iphone/*.png; do
  webp "$f" "assets/img/inki-ace/$(basename "${f%.png}").webp" 720 82
done
webp "$IA/AppStore/creatives/header.png" assets/img/inki-ace/header.webp 1920 80

# Video posters (first frames, written by tools/encode-video.swift) as WebP.
for g in inki-run inki-ace; do
  if [[ -f "assets/video/$g-poster.jpg" ]]; then
    cwebp -quiet -q 82 "assets/video/$g-poster.jpg" -o "assets/video/$g-poster.webp"
  fi
done
cp "assets/img/word-duel/2-game.webp" assets/video/word-duel-poster.webp

du -sh assets/img/* assets/video
