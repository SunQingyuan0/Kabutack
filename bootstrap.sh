#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/SunQingyuan0/Kabutack.git}"
INSTALL_DIR="${TMPDIR:-/tmp}/kabutack-install"

rm -rf "$INSTALL_DIR"
git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
"$INSTALL_DIR/install.sh" "$@"
