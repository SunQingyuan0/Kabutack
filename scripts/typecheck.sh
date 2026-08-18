#!/usr/bin/env bash
# DSH plugin typecheck: use the dsh checkout's tsc so the repo stays offline-friendly.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# DSH_CHECKOUT 探测：环境变量 → 常见路径（home 下 dsh-harness）
CHECKOUT="${DSH_CHECKOUT:-}"
if [ -z "$CHECKOUT" ]; then
  for candidate in "$HOME/dsh-harness" "$HOME/dsh" "$HOME/.dsh/dsh-harness"; do
    if [ -d "$candidate/packages" ]; then CHECKOUT="$candidate"; break; fi
  done
fi
if [ -z "$CHECKOUT" ] || [ ! -d "$CHECKOUT/packages" ]; then
  echo "typecheck: cannot locate the dsh checkout (set DSH_CHECKOUT)" >&2
  exit 1
fi

if [ -x "$ROOT/node_modules/.bin/tsc" ] || [ -f "$ROOT/node_modules/.bin/tsc.cmd" ]; then
  TSC="$ROOT/node_modules/.bin/tsc"
else
  TSC="$CHECKOUT/node_modules/.bin/tsc"
fi
if [ ! -x "$TSC" ] && [ ! -f "$TSC.cmd" ]; then
  echo "typecheck: tsc not found at $TSC" >&2
  exit 1
fi

echo "=== Type checking (checkout: $CHECKOUT) ==="
"$TSC" -p tsconfig.host.json --noEmit
"$TSC" -p tsconfig.client.json --noEmit
echo "=== Type check complete ==="
