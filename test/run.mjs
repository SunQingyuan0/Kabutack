import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore, saveStore, createRole, updateRole, deleteRole, setActiveRole, duplicateRole } from '../lib/roles.js'
import { editFrontmatter } from '../lib/skills-ops.js'
import { buildPlan, executePlan } from '../lib/apply.js'
import { createRoleManagerService } from '../lib/service.js'

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'kabutack-test-'))
}

let passed = 0
const pending = []

function run(name, fn) {
  const p = Promise.resolve().then(fn)
  pending.push(p.then(
    () => { passed += 1; console.log('PASS', name) },
    (err) => { console.error('FAIL', name, err); process.exitCode = 1 },
  ))
}

run('package ships a valid DSH bundle patch', () => {
  const packageFile = new URL('../package.json', import.meta.url)
  const pkg = JSON.parse(readFileSync(packageFile, 'utf8'))
  const declaredPatch = pkg.dsh?.bundle?.patch

  assert.equal(declaredPatch, './cordis.patch.yml')
  assert.ok(pkg.files.includes('cordis.patch.yml'))

  const patchFile = new URL(`../${declaredPatch.replace(/^\.\//, '')}`, import.meta.url)
  assert.equal(existsSync(patchFile), true)

  const patch = readFileSync(patchFile, 'utf8')
  assert.match(patch, /id:\s*kabutack/)
  assert.match(patch, /name:\s*['"]@galactus\/kabutack['"]/)
})

run('roles store roundtrip', () => {
  const dir = tempDir()
  try {
    const store = loadStore(dir)
    assert.equal(store.roles.length, 0)
    const role = createRole(store, { name: 'Developer', plugins: ['a'], skills: ['b'], mcps: ['c'] })
    saveStore(store, dir)
    const loaded = loadStore(dir)
    assert.equal(loaded.roles.length, 1)
    assert.equal(loaded.roles[0].id, role.id)
    assert.deepEqual(loaded.roles[0].plugins, ['a'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

run('createRole rejects duplicate id', () => {
  const dir = tempDir()
  try {
    const store = loadStore(dir)
    createRole(store, { name: 'Developer' })
    assert.throws(() => createRole(store, { name: 'Developer' }), /conflict/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

run('delete active role is rejected', () => {
  const dir = tempDir()
  try {
    const store = loadStore(dir)
    const role = createRole(store, { name: 'Active' })
    setActiveRole(store, role.id)
    assert.throws(() => deleteRole(store, role.id), /conflict/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

run('duplicateRole creates copy', () => {
  const dir = tempDir()
  try {
    const store = loadStore(dir)
    const role = createRole(store, { name: 'Dev', plugins: ['x'] })
    const copy = duplicateRole(store, role.id)
    assert.notEqual(copy.id, role.id)
    assert.deepEqual(copy.plugins, ['x'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

run('updateRole replaces arrays', () => {
  const dir = tempDir()
  try {
    const store = loadStore(dir)
    const role = createRole(store, { name: 'Dev', plugins: ['a'] })
    updateRole(store, role.id, { plugins: ['b', 'b', 'a'] })
    assert.deepEqual(store.roles[0].plugins, ['b', 'a'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

run('roleManager service exposes role CRUD', () => {
  const dir = tempDir()
  try {
    let store = loadStore(dir)
    const audit = { log() {} }
    const service = createRoleManagerService({
      ctx: {},
      getStore: () => store,
      save: (s) => { store = s; saveStore(s, dir) },
      audit,
    })
    const role = service.createRole({ name: 'Svc' })
    assert.equal(service.listRoleDetails().length, 1)
    assert.equal(service.getRole(role.id)?.name, 'Svc')
    service.updateRole(role.id, { plugins: ['a'] })
    assert.deepEqual(service.getRole(role.id)?.plugins, ['a'])
    service.deleteRole(role.id)
    assert.equal(service.listRoleDetails().length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

run('editFrontmatter adds fields when missing', () => {
  const input = '---\nname: demo\ndescription: x\n---\nBody'
  const out = editFrontmatter(input, { 'disable-model-invocation': true, 'user-invocable': false })
  assert.match(out, /disable-model-invocation: true/)
  assert.match(out, /user-invocable: false/)
  assert.match(out, /Body/)
})

run('editFrontmatter removes fields when undefined', () => {
  const input = '---\nname: demo\ndisable-model-invocation: true\nuser-invocable: false\n---\nBody'
  const out = editFrontmatter(input, { 'disable-model-invocation': undefined, 'user-invocable': undefined })
  assert.doesNotMatch(out, /disable-model-invocation/)
  assert.doesNotMatch(out, /user-invocable/)
  assert.match(out, /Body/)
})

run('buildPlan computes role diff', () => {
  const catalog = {
    plugins: [
      { kind: 'plugin', entryId: 'p-a', moduleName: 'a', enabled: false, managed: true, fiberPhase: null },
      { kind: 'plugin', entryId: 'p-b', moduleName: 'b', enabled: true, managed: true, fiberPhase: 'active' },
    ],
    skills: [
      { kind: 'skill', name: 's1', path: '/x/SKILL.md', modelInvocable: false, userInvocable: false, managed: true },
      { kind: 'skill', name: 's2', path: '/y/SKILL.md', modelInvocable: true, userInvocable: true, managed: true },
    ],
    mcps: [
      { kind: 'mcp', entryId: 'm-y', serverName: 'y', enabled: true, managed: true, config: { serverName: 'y' } },
    ],
    capturedAt: 0,
  }
  const store = {
    roles: [], mcps: [{ serverName: 'x' }, { serverName: 'y' }], skillOverrides: {},
    pluginOverrides: {}, removedPlugins: [], mcpOverrides: {},
  }
  const role = { id: 'r', name: 'R', plugins: ['a'], skills: ['s1'], mcps: ['x'], createdAt: 0, updatedAt: 0 }
  const plan = buildPlan(role, catalog, store)
  assert.deepEqual(plan.enablePlugins, [{ entryId: 'p-a', moduleName: 'a' }])
  assert.deepEqual(plan.disablePlugins, [{ entryId: 'p-b', moduleName: 'b' }])
  assert.deepEqual(plan.createMcps, [{ serverName: 'x' }])
  assert.deepEqual(plan.removeMcps, [{ entryId: 'm-y', serverName: 'y' }])
  assert.deepEqual(plan.enableSkills, [{ name: 's1', path: '/x/SKILL.md' }])
  assert.deepEqual(plan.disableSkills, [{ name: 's2', path: '/y/SKILL.md' }])
})

run('buildPlan skips skill disable when role has no skills', () => {
  const catalog = {
    plugins: [],
    skills: [
      { kind: 'skill', name: 's1', path: '/x/SKILL.md', modelInvocable: true, userInvocable: true, managed: true },
    ],
    mcps: [],
    capturedAt: 0,
  }
  const store = { roles: [], mcps: [], skillOverrides: {}, pluginOverrides: {}, removedPlugins: [], mcpOverrides: {} }
  const role = { id: 'r', name: 'R', plugins: [], skills: [], mcps: [], createdAt: 0, updatedAt: 0 }
  const plan = buildPlan(role, catalog, store)
  assert.deepEqual(plan.disableSkills, [])
  assert.ok(plan.warnings.some((w) => w.includes('跳过技能停用')))
})

run('executePlan disables plugin', async () => {
  const calls = []
  const ctx = {
    loader: {
      update: async (id, opts) => { calls.push(['update', id, opts]) },
      entries: () => [],
    },
  }
  const plan = {
    roleId: 'r', enablePlugins: [], disablePlugins: [{ entryId: 'p-b', moduleName: 'b' }],
    enableMcps: [], createMcps: [], updateMcps: [], removeMcps: [],
    enableSkills: [], disableSkills: [], warnings: [],
  }
  const catalog = { plugins: [], skills: [], mcps: [] }
  const store = { roles: [], mcps: [], skillOverrides: {}, pluginOverrides: {}, removedPlugins: [], mcpOverrides: {} }
  const result = await executePlan(ctx, plan, catalog, store, () => {})
  assert.equal(result.ok, true)
  assert.deepEqual(calls, [['update', 'p-b', { disabled: true }]])
})

run('executePlan rolls back on failure', async () => {
  const calls = []
  const ctx = {
    loader: {
      update: async (id, opts) => {
        calls.push(['update', id, opts])
        if (id === 'p-fail') throw new Error('boom')
      },
      entries: () => [],
    },
  }
  const plan = {
    roleId: 'r',
    enablePlugins: [{ entryId: 'p-ok', moduleName: 'ok' }],
    disablePlugins: [{ entryId: 'p-fail', moduleName: 'fail' }],
    enableMcps: [], createMcps: [], updateMcps: [], removeMcps: [],
    enableSkills: [], disableSkills: [], warnings: [],
  }
  const catalog = { plugins: [], skills: [], mcps: [] }
  const store = { roles: [], mcps: [], skillOverrides: {}, pluginOverrides: {}, removedPlugins: [], mcpOverrides: {} }
  const result = await executePlan(ctx, plan, catalog, store, () => {})
  assert.equal(result.ok, false)
  assert.ok(result.rolledBack && result.rolledBack.length > 0)
})

await Promise.all(pending)
console.log(`\n${passed} tests passed`)
