#!/usr/bin/env node
'use strict'

/**
 * Postinstall helper for DSH bundle packages.
 *
 * When this package is installed into a DSH profile (for example
 * ~/.dsh/profiles/web), npm/bun runs this script automatically.  It locates
 * the profile's package.json and appends the package name to
 * `dsh.profile.bundles`, so DSH will load Kabutack after restart.
 *
 * If the package is installed somewhere that is not a DSH profile, the script
 * does nothing and exits successfully so normal `npm install` / `bun add`
 * usage is not broken.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const PACKAGE_NAME = '@dsh-external/kabutack'

function readJson(file) {
  let text = fs.readFileSync(file, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  return JSON.parse(text)
}

function findProfileRoot(startDir) {
  let dir = startDir
  for (let i = 0; i < 12; i += 1) {
    const pkgFile = path.join(dir, 'package.json')
    if (fs.existsSync(pkgFile)) {
      try {
        const pkg = readJson(pkgFile)
        if (pkg.dsh && pkg.dsh.profile) {
          return dir
        }
      } catch {
        // Ignore malformed package.json and keep walking up.
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function findProfileFromDshHome() {
  const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const profilesDir = path.join(dshHome, 'profiles')
  if (!fs.existsSync(profilesDir)) return null

  const entries = fs.readdirSync(profilesDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const profileDir = path.join(profilesDir, entry.name)
    const pkgFile = path.join(profileDir, 'package.json')
    if (!fs.existsSync(pkgFile)) continue

    try {
      const pkg = readJson(pkgFile)
      const deps = pkg.dependencies || {}
      const hasDependency = Object.prototype.hasOwnProperty.call(deps, PACKAGE_NAME)
      const hasLink = fs.existsSync(
        path.join(profileDir, 'node_modules', '@dsh-external', 'kabutack'),
      )
      if (hasDependency || hasLink) return profileDir
    } catch {
      // Ignore malformed profile package.json and keep scanning.
    }
  }
  return null
}

function main() {
  // __dirname is usually <profile>/node_modules/@dsh-external/kabutack/scripts.
  // With pnpm/bun the package may be symlinked from a content-addressable store,
  // so also check INIT_CWD (the directory where the user ran npm/bun).
  const packageRoot = path.resolve(__dirname, '..')
  const candidates = [
    process.env.INIT_CWD,
    path.resolve(packageRoot, '../../..'),
    process.cwd(),
  ].filter(Boolean)

  let profileRoot = null
  for (const candidate of candidates) {
    profileRoot = findProfileRoot(candidate)
    if (profileRoot) break
  }

  // Fallback for pnpm/bun-style content-addressable stores where lifecycle
  // scripts run from a cache directory outside the profile.
  if (!profileRoot) {
    profileRoot = findProfileFromDshHome()
  }

  if (!profileRoot) {
    console.log(`[kabutack] not inside a DSH profile, skip profile registration`)
    return
  }

  const profilePkgFile = path.join(profileRoot, 'package.json')
  const pkg = readJson(profilePkgFile)

  pkg.dsh = pkg.dsh || {}
  pkg.dsh.profile = pkg.dsh.profile || {}
  if (!Array.isArray(pkg.dsh.profile.bundles)) {
    pkg.dsh.profile.bundles = []
  }

  if (!pkg.dsh.profile.bundles.includes(PACKAGE_NAME)) {
    pkg.dsh.profile.bundles.push(PACKAGE_NAME)
    fs.writeFileSync(profilePkgFile, JSON.stringify(pkg, null, 2) + '\n')
    console.log(`[kabutack] registered in ${profilePkgFile}`)
  } else {
    console.log(`[kabutack] already registered in ${profilePkgFile}`)
  }
}

main()
