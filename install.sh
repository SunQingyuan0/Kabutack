#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-web}"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PACKAGE_FILE="$PROFILE_DIR/package.json"

if [ ! -f "$PACKAGE_FILE" ]; then
  echo "DSH profile not found: $PACKAGE_FILE" >&2
  exit 1
fi

TARGET_DIR="${TARGET_DIR:-$DSH_HOME/kabutack}"
mkdir -p "$TARGET_DIR/lib"
cp -R "$SOURCE_DIR/lib/." "$TARGET_DIR/lib/"
cp "$SOURCE_DIR/package.json" "$TARGET_DIR/package.json"

EXT_DIR="$PROFILE_DIR/node_modules/@dsh-external"
mkdir -p "$EXT_DIR"
LINK="$EXT_DIR/kabutack"
if [ -e "$LINK" ] || [ -L "$LINK" ]; then
  rm -rf "$LINK"
fi
ln -s "$TARGET_DIR" "$LINK"

node -e "
const fs = require('fs');
const file = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@dsh-external/kabutack'] = 'link:${TARGET_DIR}';
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
pkg.dsh.profile.bundles = pkg.dsh.profile.bundles || [];
if (!pkg.dsh.profile.bundles.includes('@dsh-external/kabutack')) pkg.dsh.profile.bundles.push('@dsh-external/kabutack');
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
" "$PACKAGE_FILE"

echo ""
echo "Kabutack installed successfully."
echo "  Profile : $PROFILE"
echo "  Package : $TARGET_DIR"
echo "  Link    : $LINK"
echo ""
echo "Next: restart DSH (or reload the profile) to load the plugin."
