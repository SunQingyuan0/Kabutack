#!/usr/bin/env bash
set -euo pipefail

# TODO: 发布到 GitHub 后，把这里替换为真实仓库地址
REPO_URL="${REPO_URL:-https://github.com/<owner>/<repo>.git}"
INSTALL_DIR="${TMPDIR:-/tmp}/kabutack-install"

rm -rf "$INSTALL_DIR"
git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
"$INSTALL_DIR/install.sh" "$@"
