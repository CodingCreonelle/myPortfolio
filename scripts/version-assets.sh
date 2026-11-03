#!/bin/sh
# Appends a content hash (?v=<sha256 prefix>) to every CSS/JS reference in the
# site's HTML so browsers can cache those files forever and still pick up
# changes the moment their content does. Runs at image build time only; the
# source tree keeps plain, unversioned paths for local development.
set -eu

ROOT="${1:-/site}"
cd "$ROOT"

find assets/css assets/js -maxdepth 1 -type f \( -name '*.css' -o -name '*.js' \) |
while IFS= read -r asset; do
    hash=$(sha256sum "$asset" | cut -c1-10)
    pattern=$(printf '%s' "$asset" | sed 's/[.]/\\./g')
    find . -type f -name '*.html' -exec \
        sed -i "s|${pattern}\"|${asset}?v=${hash}\"|g" {} +
    echo "versioned ${asset} -> ?v=${hash}"
done

if find . -type f -name '*.html' -exec grep -nE 'assets/(css|js)/[^"?]+\.(css|js)"' {} +; then
    echo "error: unversioned asset references remain (listed above)" >&2
    exit 1
fi
