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
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
cp -R "$SOURCE_DIR/lib/." "$TARGET_DIR/lib/"
cp "$SOURCE_DIR/package.json" "$TARGET_DIR/package.json"
cp "$SOURCE_DIR/cordis.patch.yml" "$TARGET_DIR/cordis.patch.yml"

# Drop the stale pre-rename link so re-running the installer repairs old profiles.
OLD_LINK="$PROFILE_DIR/node_modules/@dsh-external/kabutack"
if [ -e "$OLD_LINK" ]; then
  rm -rf "$OLD_LINK"
fi

# Remove the stale pre-rename dependency/bundle entry. The new dependency and
# bundle registration are handled by the official `dsh plugin` command below.
node -e "
const fs = require('fs');
const file = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
let changed = false;
if (pkg.dependencies && pkg.dependencies['@dsh-external/kabutack']) {
  delete pkg.dependencies['@dsh-external/kabutack'];
  changed = true;
}
if (pkg.dsh && pkg.dsh.profile && Array.isArray(pkg.dsh.profile.bundles)) {
  const before = pkg.dsh.profile.bundles.length;
  pkg.dsh.profile.bundles = pkg.dsh.profile.bundles.filter((x) => x !== '@dsh-external/kabutack');
  if (pkg.dsh.profile.bundles.length !== before) changed = true;
}
if (changed) fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
" "$PACKAGE_FILE"

if ! command -v dsh >/dev/null 2>&1; then
  echo "dsh CLI not found on PATH. Install DSH first, then re-run this script." >&2
  exit 1
fi

echo "Running: dsh plugin --profile $PROFILE add $TARGET_DIR"
dsh plugin --profile "$PROFILE" add "$TARGET_DIR"

echo ""
echo "Kabutack installed successfully (official dsh plugin)."
echo "  Profile : $PROFILE"
echo "  Package : $TARGET_DIR"
echo ""
echo "Next: restart DSH (or reload the profile) to load the plugin."
