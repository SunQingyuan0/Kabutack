/**
 * Kabutack 共享领域类型。
 * 不依赖 DSH 内部类型，使用最小本地接口以保持构建自包含。
 */

export type CapabilityKind = 'plugin' | 'skill' | 'mcp'

export type PluginFiberPhase =
  | 'pending'
  | 'loading'
  | 'active'
  | 'failed'
  | 'unloading'
  | null

export interface PluginItem {
  kind: 'plugin'
  entryId: string
  moduleName: string
  enabled: boolean
  fiberPhase: PluginFiberPhase
  managed: boolean
  source?: 'bundle' | 'patch' | 'injected' | 'runtime'
}

export interface SkillItem {
  kind: 'skill'
  name: string
  description: string
  provider: string
  source: string
  modelInvocable: boolean
  userInvocable: boolean
  path?: string
  managed: boolean
}

export interface McpItem {
  kind: 'mcp'
  entryId: string
  serverName: string
  transport: 'stdio' | 'streamable-http'
  enabled: boolean
  fiberPhase: PluginFiberPhase
  config: McpDefinition
  managed: boolean
}

export interface CatalogSnapshot {
  plugins: PluginItem[]
  skills: SkillItem[]
  mcps: McpItem[]
  capturedAt: number
}

export interface McpDefinition {
  serverName: string
  transport: 'stdio' | 'streamable-http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  toolCallTimeoutMs?: number
  failOnStartupError?: boolean
  reconnect?: {
    enabled?: boolean
    initialDelayMs?: number
    maxDelayMs?: number
    maxAttempts?: number
  }
}

export interface Role {
  id: string
  name: string
  description?: string
  plugins: string[]
  skills: string[]
  mcps: string[]
  createdAt: number
  updatedAt: number
}

export interface RoleSummary {
  id: string
  name: string
  description?: string
  pluginCount: number
  skillCount: number
  mcpCount: number
  active: boolean
}

export interface RoleManagerStore {
  version: 1
  activeRoleId: string | null
  roles: Role[]
  mcps: McpDefinition[]
  skillOverrides: Record<string, {
    modelInvocable?: boolean
    userInvocable?: boolean
  }>
  /** 插件 moduleName -> 期望启用状态（用于重启恢复） */
  pluginOverrides?: Record<string, boolean>
  /** 已卸载插件 moduleName 列表（用于重启后继续移除） */
  removedPlugins?: string[]
  /** MCP serverName -> 期望启用状态（用于重启恢复） */
  mcpOverrides?: Record<string, boolean>
  lastActivation?: {
    roleId: string | null
    at: number
    result: 'ok' | 'failed'
    message?: string
  }
}

export interface CreateRoleInput {
  name: string
  description?: string
  plugins?: string[]
  skills?: string[]
  mcps?: string[]
}

export interface UpdateRoleInput {
  name?: string
  description?: string
  plugins?: string[]
  skills?: string[]
  mcps?: string[]
}

export interface ApplyPlan {
  roleId: string
  enablePlugins: Array<{ entryId: string; moduleName: string }>
  disablePlugins: Array<{ entryId: string; moduleName: string }>
  enableMcps: Array<{ entryId: string; serverName: string }>
  createMcps: McpDefinition[]
  updateMcps: Array<{ entryId: string; definition: McpDefinition }>
  removeMcps: Array<{ entryId: string; serverName: string }>
  enableSkills: Array<{ name: string; path?: string }>
  disableSkills: Array<{ name: string; path?: string }>
  warnings: string[]
}

export interface ApplyResult {
  ok: boolean
  plan: ApplyPlan
  executed: string[]
  rolledBack?: string[]
  error?: string
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  details?: unknown
}
