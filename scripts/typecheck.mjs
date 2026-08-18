#!/usr/bin/env node
/**
 * DSH plugin typecheck: use the dsh checkout's tsc so the repo stays offline-friendly.
 * Cross-platform alternative to scripts/typecheck.sh.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function findCheckout() {
  if (process.env.DSH_CHECKOUT && existsSync(join(process.env.DSH_CHECKOUT, 'packages'))) {
    return process.env.DSH_CHECKOUT
  }
  for (const candidate of [join(homedir(), 'dsh-harness'), join(homedir(), 'dsh'), join(homedir(), '.dsh', 'dsh-harness')]) {
    if (existsSync(join(candidate, 'packages'))) return candidate
  }
  return null
}

const localTsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
const checkout = findCheckout()
const tsc = existsSync(localTsc) ? localTsc : checkout ? join(checkout, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc') : null
if (!tsc || !existsSync(tsc)) {
  console.error('typecheck: cannot locate tsc (run pnpm install, or set DSH_CHECKOUT to a dsh checkout)')
  process.exit(1)
}

console.log('=== Type checking (tsc: %s) ===', tsc)
for (const config of ['tsconfig.host.json', 'tsconfig.client.json']) {
  console.log('--- %s ---', config)
  const result = spawnSync(tsc, ['-p', join(root, config), '--noEmit'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
console.log('=== Type check complete ===')
