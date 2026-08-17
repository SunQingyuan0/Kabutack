import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { CreateRoleInput, Role, RoleManagerStore, RoleSummary, UpdateRoleInput } from './types.js'

function createEmptyStore(): RoleManagerStore {
  return {
    version: 1,
    activeRoleId: null,
    roles: [],
    mcps: [],
    skillOverrides: {},
    pluginOverrides: {},
    removedPlugins: [],
    mcpOverrides: {},
  }
}

export function defaultDataDir(): string {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(dshHome, 'kabutack')
}

export function rolesFile(dataDir: string): string {
  return join(dataDir, 'roles.json')
}

function normalizeStore(raw: any): RoleManagerStore {
  const store: RoleManagerStore = {
    version: 1,
    activeRoleId: typeof raw?.activeRoleId === 'string' ? raw.activeRoleId : null,
    roles: Array.isArray(raw?.roles) ? raw.roles.filter((r: any) => r && typeof r.id === 'string') : [],
    mcps: Array.isArray(raw?.mcps) ? raw.mcps.filter((m: any) => m && typeof m.serverName === 'string') : [],
    skillOverrides: raw?.skillOverrides && typeof raw.skillOverrides === 'object' ? raw.skillOverrides : {},
    pluginOverrides: raw?.pluginOverrides && typeof raw.pluginOverrides === 'object' ? raw.pluginOverrides : {},
    removedPlugins: Array.isArray(raw?.removedPlugins) ? raw.removedPlugins.filter((x: any) => typeof x === 'string') : [],
    mcpOverrides: raw?.mcpOverrides && typeof raw.mcpOverrides === 'object' ? raw.mcpOverrides : {},
  }
  if (raw?.lastActivation && typeof raw.lastActivation === 'object') {
    store.lastActivation = raw.lastActivation
  }
  // 不变式：activeRoleId 必须存在，否则清空
  if (store.activeRoleId && !store.roles.some((r) => r.id === store.activeRoleId)) {
    store.activeRoleId = null
  }
  return store
}

export function loadStore(dataDir?: string): RoleManagerStore {
  const dir = dataDir || defaultDataDir()
  const file = rolesFile(dir)
  try {
    const text = readFileSync(file, 'utf8')
    const parsed = JSON.parse(text)
    return normalizeStore(parsed)
  } catch (err: any) {
    // 文件不存在按空存储；文件损坏则备份后返回空存储
    if (err?.code !== 'ENOENT') {
      try {
        mkdirSync(dir, { recursive: true })
        renameSync(file, file + '.bad-' + Date.now())
      } catch {
        // 备份失败不阻断
      }
    }
    return createEmptyStore()
  }
}

export function saveStore(store: RoleManagerStore, dataDir?: string): void {
  const dir = dataDir || defaultDataDir()
  const file = rolesFile(dir)
  mkdirSync(dir, { recursive: true })
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
  renameSync(tmp, file)
}

export function listRoles(store: RoleManagerStore): RoleSummary[] {
  return store.roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    pluginCount: r.plugins.length,
    skillCount: r.skills.length,
    mcpCount: r.mcps.length,
    active: store.activeRoleId === r.id,
  }))
}

export function getRole(store: RoleManagerStore, id: string): Role | undefined {
  return store.roles.find((r) => r.id === id)
}

export function createRole(store: RoleManagerStore, input: CreateRoleInput): Role {
  if (!input?.name?.trim()) throw new Error('invalid-input: name 必填')
  const id = slugify(input.name)
  if (store.roles.some((r) => r.id === id)) {
    throw new Error('conflict: 角色 id 已存在: ' + id)
  }
  const now = Date.now()
  const role: Role = {
    id,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    plugins: unique(input.plugins || []),
    skills: unique(input.skills || []),
    mcps: unique(input.mcps || []),
    createdAt: now,
    updatedAt: now,
  }
  store.roles.push(role)
  return role
}

export function updateRole(store: RoleManagerStore, id: string, patch: UpdateRoleInput): Role {
  const role = getRole(store, id)
  if (!role) throw new Error('not-found: 角色不存在: ' + id)
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error('invalid-input: name 不能为空')
    role.name = patch.name.trim()
  }
  if (patch.description !== undefined) role.description = patch.description.trim() || undefined
  if (patch.plugins !== undefined) role.plugins = unique(patch.plugins)
  if (patch.skills !== undefined) role.skills = unique(patch.skills)
  if (patch.mcps !== undefined) role.mcps = unique(patch.mcps)
  role.updatedAt = Date.now()
  return role
}

export function deleteRole(store: RoleManagerStore, id: string): void {
  const idx = store.roles.findIndex((r) => r.id === id)
  if (idx < 0) throw new Error('not-found: 角色不存在: ' + id)
  if (store.activeRoleId === id) {
    throw new Error('conflict: 请先停用或切换到其他角色再删除')
  }
  store.roles.splice(idx, 1)
}

export function duplicateRole(store: RoleManagerStore, id: string, newId?: string): Role {
  const role = getRole(store, id)
  if (!role) throw new Error('not-found: 角色不存在: ' + id)
  const now = Date.now()
  const copy: Role = {
    ...role,
    id: newId && /^[a-z0-9-]+$/.test(newId) ? newId : role.id + '-copy',
    name: role.name + ' (副本)',
    createdAt: now,
    updatedAt: now,
  }
  if (store.roles.some((r) => r.id === copy.id)) {
    throw new Error('conflict: 角色 id 已存在: ' + copy.id)
  }
  store.roles.push(copy)
  return copy
}

export function setActiveRole(store: RoleManagerStore, id: string | null): void {
  if (id !== null && !store.roles.some((r) => r.id === id)) {
    throw new Error('not-found: 角色不存在: ' + id)
  }
  store.activeRoleId = id
}

function slugify(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (base) return base
  return 'role-' + Date.now().toString(36)
}

function unique(list: string[]): string[] {
  return [...new Set(list.filter((x) => typeof x === 'string' && x.length > 0))]
}
