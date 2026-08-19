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
EXT_DIR="$PROFILE_DIR/node_modules/@galactus"
mkdir -p "$EXT_DIR"
LINK="$EXT_DIR/kabutack"

# Git Bash / MSYS need Windows-style paths for native Node.exe.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=1 ;;
  *) IS_WINDOWS=0 ;;
esac

winpath() {
  if [ "$IS_WINDOWS" = "1" ] && command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s' "$1"
  fi
}

OLD_LINK_WIN="$(winpath "$OLD_LINK")"
LINK_WIN="$(winpath "$LINK")"
TARGET_DIR_WIN="$(winpath "$TARGET_DIR")"
PACKAGE_FILE_WIN="$(winpath "$PACKAGE_FILE")"

# Use Node for link creation: on Windows this creates a junction (no admin
# required) and safely removes existing links without touching their targets.
node -e "
const fs = require('fs');
const oldLink = process.argv[1];
const link = process.argv[2];
const target = process.argv[3];
if (oldLink) fs.rmSync(oldLink, { recursive: true, force: true });
fs.rmSync(link, { recursive: true, force: true });
fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
" "$OLD_LINK_WIN" "$LINK_WIN" "$TARGET_DIR_WIN"

node -e "
const fs = require('fs');
const file = process.argv[1];
const target = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
delete pkg.dependencies['@dsh-external/kabutack'];
pkg.dependencies['@galactus/kabutack'] = 'link:' + target;
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
pkg.dsh.profile.bundles = (pkg.dsh.profile.bundles || []).filter((x) => x !== '@dsh-external/kabutack');
if (!pkg.dsh.profile.bundles.includes('@galactus/kabutack')) pkg.dsh.profile.bundles.push('@galactus/kabutack');
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
" "$PACKAGE_FILE_WIN" "$TARGET_DIR_WIN"

echo ""
echo "Kabutack installed successfully."
echo "  Profile : $PROFILE"
echo "  Package : $TARGET_DIR"
echo "  Link    : $LINK"
echo ""
echo "Next: restart DSH (or reload the profile) to load the plugin."
