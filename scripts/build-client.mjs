#!/usr/bin/env node
/**
 * Client 构建：用 checkout 的 tsc 把 src/client/index.ts 编译为 CJS，
 * 再包上 DSH ModuleLoader.load 外壳，输出 lib/client.js。
 * 不依赖 tsdown / npm install，适合离线环境。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pluginId = '@dsh-external/kabutack'

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
  console.error('build-client: cannot locate tsc (run pnpm install, or set DSH_CHECKOUT to a dsh checkout)')
  process.exit(1)
}

const result = spawnSync(tsc, ['-p', join(root, 'tsconfig.client.json')], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const compiled = join(root, 'lib', '.client-build', 'index.js')
if (!existsSync(compiled)) {
  console.error('build-client: compiled client not found at', compiled)
  process.exit(1)
}

const code = readFileSync(compiled, 'utf8')
const banner = `window.__ModuleLoader__.load({ id: ${JSON.stringify(pluginId)}, factory: (require) => {`
const footer = `return module.exports; } });`
const intro = `var module = { exports: {} }; var exports = module.exports;`
const wrapped = banner + '\n' + intro + '\n' + code + '\n' + footer + '\n'

const out = join(root, 'lib', 'client.js')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, wrapped, 'utf8')
rmSync(join(root, 'lib', '.client-build'), { recursive: true, force: true })
console.log('build-client: wrote', out)
