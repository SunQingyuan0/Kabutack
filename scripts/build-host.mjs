#!/usr/bin/env node
/**
 * DSH plugin Host build.
 * Cross-platform replacement for scripts/build.sh:
 * - links required build dependencies from a DSH checkout when local deps are absent
 * - compiles src/ → lib/ with tsc (local node_modules first, DSH checkout as fallback)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
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

function findTsc(checkout) {
  const local = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
  if (existsSync(local)) return local
  if (checkout) {
    const checkoutTsc = join(checkout, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
    if (existsSync(checkoutTsc)) return checkoutTsc
  }
  return null
}

function linkPkg(link, target) {
  rmSync(link, { recursive: true, force: true })
  mkdirSync(dirname(link), { recursive: true })
  symlinkSync(resolve(target), resolve(link), process.platform === 'win32' ? 'junction' : 'dir')
}

function linkCheckoutDeps(checkout) {
  console.log('=== Linking build dependencies (checkout: %s) ===', checkout)
  mkdirSync(join(root, 'node_modules', '@deepseek-ai'), { recursive: true })
  rmSync(join(root, 'node_modules', '@standard-schema'), { recursive: true, force: true })
  linkPkg(join(root, 'node_modules', 'cordis'), join(checkout, 'vendor', 'cordis'))
  linkPkg(join(root, 'node_modules', 'cosmokit'), join(checkout, 'vendor', 'cosmokit'))
  linkPkg(join(root, 'node_modules', 'schemastery'), join(checkout, 'vendor', 'schemastery'))
  linkPkg(join(root, 'node_modules', '@deepseek-ai', 'dsh-tools'), join(checkout, 'packages', 'core', 'tools'))
  linkPkg(join(root, 'node_modules', '@types', 'node'), join(checkout, 'node_modules', '@types', 'node'))

  const pnpmDir = join(checkout, 'node_modules', '.pnpm')
  if (existsSync(pnpmDir)) {
    const std = readdirSync(pnpmDir).find((name) => name.toLowerCase().startsWith('@standard-schema+spec@'))
    if (std) {
      const target = join(pnpmDir, std, 'node_modules', '@standard-schema', 'spec')
      if (existsSync(target)) {
        mkdirSync(join(root, 'node_modules', '@standard-schema'), { recursive: true })
        symlinkSync(resolve(target), resolve(join(root, 'node_modules', '@standard-schema', 'spec')), process.platform === 'win32' ? 'junction' : 'dir')
      }
    }
  }
}

const checkout = findCheckout()
const hasLocalDeps = existsSync(join(root, 'node_modules', 'cordis')) && existsSync(join(root, 'node_modules', '@deepseek-ai', 'dsh-tools'))
if (!hasLocalDeps) {
  if (!checkout) {
    console.error('build-host: cannot locate dsh checkout (set DSH_CHECKOUT, or run pnpm install first)')
    process.exit(1)
  }
  linkCheckoutDeps(checkout)
}

const tsc = findTsc(checkout)
if (!tsc) {
  console.error('build-host: cannot locate tsc (run pnpm install, or set DSH_CHECKOUT to a dsh checkout)')
  process.exit(1)
}

console.log('=== Compiling Host src → lib (tsc: %s) ===', tsc)
const result = spawnSync(tsc, ['-p', join(root, 'tsconfig.host.json')], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
console.log('=== Build complete ===')
