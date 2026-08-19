#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_URL="${ARCHIVE_URL:-https://codeload.github.com/SunQingyuan0/Kabutack/tar.gz/refs/heads/main}"
INSTALL_DIR="${TMPDIR:-/tmp}/kabutack-install"
ARCHIVE="${TMPDIR:-/tmp}/kabutack-install.tar.gz"

rm -rf "$INSTALL_DIR" "$ARCHIVE"
mkdir -p "$INSTALL_DIR"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$ARCHIVE_URL" -o "$ARCHIVE"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$ARCHIVE" "$ARCHIVE_URL"
else
  echo "bootstrap: need curl or wget to download Kabutack" >&2
  exit 1
fi
tar -xzf "$ARCHIVE" -C "$INSTALL_DIR" --strip-components 1
bash "$INSTALL_DIR/install.sh" "$@"
