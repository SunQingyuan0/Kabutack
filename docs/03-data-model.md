# 03 数据模型

## 1. 命名与标识规则

| 实体 | 标识 | 示例 |
|---|---|---|
| 插件 | `moduleName`（包名/模块说明符） | `@deepseek-ai/dsh-tool-cordis` |
| 技能 | skill `name`（kebab-case） | `code-review` |
| MCP | `serverName` | `github` |
| 角色 | 自生成 `id`（`[a-z0-9-]`） | `developer` |
| Loader entry | `entryId`（运行时真实 id） | `mcp:github` 或 hash id |

> Catalog 中的插件/MCP 条目同时携带 `entryId`（用于 Loader 操作）与稳定 `moduleName`/`serverName`（用于角色引用）。角色中保存的是稳定标识，避免 Loader hash id 变化导致引用失效。

## 2. TypeScript 类型定义

```ts
export type CapabilityKind = 'plugin' | 'skill' | 'mcp'

export type PluginFiberPhase =
  | 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | null

/** Catalog 中一条插件 */
export interface PluginItem {
  kind: 'plugin'
  entryId: string
  moduleName: string
  enabled: boolean
  fiberPhase: PluginFiberPhase
  managed: boolean          // 是否由本插件/可安全卸载
  source?: 'bundle' | 'patch' | 'injected' | 'runtime'
}

/** Catalog 中一条技能 */
export interface SkillItem {
  kind: 'skill'
  name: string
  description: string
  provider: string
  modelInvocable: boolean
  userInvocable: boolean
  path?: string              // 文件系统技能路径（如可得）
  managed: boolean           // 是否可被本插件修改 frontmatter/卸载
}

/** Catalog 中一条 MCP */
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

/** MCP 定义（对应 @deepseek-ai/dsh-mcp-client config） */
export interface McpDefinition {
  serverName: string
  transport: 'stdio' | 'streamable-http'
  // stdio
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  // streamable-http
  url?: string
  headers?: Record<string, string>
  // common
  toolCallTimeoutMs?: number
  failOnStartupError?: boolean
  reconnect?: {
    enabled?: boolean
    initialDelayMs?: number
    maxDelayMs?: number
    maxAttempts?: number
  }
}

/** 角色 */
export interface Role {
  id: string
  name: string
  description?: string
  /** 稳定标识列表 */
  plugins: string[]          // moduleName
  skills: string[]           // skill name
  mcps: string[]             // serverName，引用下方 mcps 定义
  createdAt: number
  updatedAt: number
}

/** 持久化根对象 */
export interface RoleManagerStore {
  version: 1
  activeRoleId: string | null
  roles: Role[]
  /** 本插件维护的 MCP 定义库；角色通过 serverName 引用 */
  mcps: McpDefinition[]
  /** 技能覆盖：name -> 是否禁用 model/user */
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
  /** 上次激活记录 */
  lastActivation?: {
    roleId: string | null
    at: number
    result: 'ok' | 'failed'
    message?: string
  }
}
```

## 3. 持久化文件示例

`~/.dsh/kabutack/roles.json`：

```json
{
  "version": 1,
  "activeRoleId": "developer",
  "roles": [
    {
      "id": "developer",
      "name": "开发者",
      "description": "日常开发：代码评审、TDD、GitHub MCP",
      "plugins": [
        "@deepseek-ai/dsh-tool-cordis",
        "@dsh-external/dsh-some-dev-tool"
      ],
      "skills": ["code-review", "tdd", "diagnosing-bugs"],
      "mcps": ["github"],
      "createdAt": 1755400000000,
      "updatedAt": 1755400000000
    },
    {
      "id": "writer",
      "name": "写作",
      "description": "研究与写作",
      "plugins": ["@deepseek-ai/dsh-tool-web"],
      "skills": ["research", "find-skills"],
      "mcps": [],
      "createdAt": 1755401000000,
      "updatedAt": 1755401000000
    }
  ],
  "mcps": [
    {
      "serverName": "github",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${env.GITHUB_TOKEN}" }
    }
  ],
  "skillOverrides": {
    "some-skill": {
      "modelInvocable": false
    }
  },
  "pluginOverrides": {
    "@dsh-external/dsh-some-dev-tool": true
  },
  "removedPlugins": [],
  "mcpOverrides": {
    "github": true
  },
  "lastActivation": {
    "roleId": "developer",
    "at": 1755402000000,
    "result": "ok"
  }
}
```

## 4. 运行时不持久化对象

```ts
/** 角色激活差异计划 */
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

/** 激活结果 */
export interface ApplyResult {
  ok: boolean
  plan: ApplyPlan
  executed: string[]          // 已执行步骤名
  rolledBack?: string[]       // 已回滚步骤名
  error?: string
}
```

## 5. 不变式

1. `roles[].mcps` 中引用的 `serverName` 必须存在于根级 `mcps` 定义库中；缺失视为脏数据，加载时告警。
2. `activeRoleId` 必须为 `null` 或存在于 `roles`；否则视为脏数据并清空。
3. 角色 `id` 一旦创建不可变更；编辑名称/描述/能力不影响 id。
4. MCP `serverName` 在定义库中唯一。
5. 持久化写入必须原子：`roles.json.tmp` → `rename`。
6. 文件损坏时不得覆盖原文件，先备份为 `roles.json.bad-<timestamp>`。

## 6. 迁移策略

- 文件顶部 `version` 用于未来迁移。
- v1 不支持自动迁移；遇到更高版本号时拒绝写入并提示人工处理。
- 新增字段必须提供默认值，保持向后兼容。
