# 04 API 规格

## 1. Host 内部服务：`ctx.roleManager`

> v1 实现以 HTTP API 为主；`ctx.roleManager` 服务接口作为后续扩展目标，当前可先由 `api.ts` 内的 services 闭包承担。

插件通过 `inject: ['loader', 'skills', 'webServer', 'logger']` 提供 `ctx.roleManager` 服务（使用 Cordis `Service` 或普通对象均可；建议声明为 `Service` 便于其他插件注入）。

### 方法

```ts
interface RoleManagerService {
  // Catalog
  listCatalog(): Promise<CatalogSnapshot>

  // Roles
  listRoles(): RoleSummary[]
  getRole(id: string): Role | undefined
  createRole(input: CreateRoleInput): Role
  updateRole(id: string, patch: UpdateRoleInput): Role
  deleteRole(id: string): void
  duplicateRole(id: string, newId?: string): Role

  // Activation
  activateRole(id: string): Promise<ApplyResult>
  deactivate(): Promise<ApplyResult>
  getActiveRoleId(): string | null

  // Capability operations
  setPluginEnabled(entryId: string, enabled: boolean): Promise<void>
  removeManagedCapability(kind: 'plugin' | 'mcp', id: string): Promise<void>

  // MCP definitions
  addMcp(def: McpDefinition): Promise<McpItem>
  updateMcp(serverName: string, patch: Partial<McpDefinition>): Promise<McpItem>
  removeMcp(serverName: string): Promise<void>

  // Skills
  setSkillInvocation(name: string, opts: { modelInvocable?: boolean; userInvocable?: boolean }): Promise<void>
}
```

### 输入类型

```ts
interface CreateRoleInput {
  name: string
  description?: string
  plugins?: string[]
  skills?: string[]
  mcps?: string[]
}

interface UpdateRoleInput {
  name?: string
  description?: string
  plugins?: string[]
  skills?: string[]
  mcps?: string[]
}
```

## 2. HTTP API

Base path：`/kabutack/api`

统一响应：

```json
{ "ok": true, "data": { } }
{ "ok": false, "error": "message", "details": { } }
```

### 2.1 Catalog

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/catalog` | 返回 `CatalogSnapshot` |

示例响应：

```json
{
  "ok": true,
  "data": {
    "plugins": [
      { "kind": "plugin", "entryId": "dsh-tool-cordis", "moduleName": "@deepseek-ai/dsh-tool-cordis", "enabled": true, "fiberPhase": "active", "managed": false }
    ],
    "skills": [
      { "kind": "skill", "name": "code-review", "description": "...", "provider": "filesystem", "modelInvocable": true, "userInvocable": true, "managed": true }
    ],
    "mcps": [
      { "kind": "mcp", "entryId": "mcp:github", "serverName": "github", "transport": "stdio", "enabled": true, "fiberPhase": "active", "config": { } }
    ],
    "capturedAt": 1755402000000
  }
}
```

### 2.2 Roles

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/roles` | 角色完整列表（含能力数组） |
| GET | `/roles/:id` | 角色详情 |
| POST | `/roles` | 创建角色 |
| PUT | `/roles/:id` | 更新角色 |
| DELETE | `/roles/:id` | 删除角色 |
| POST | `/roles/:id/duplicate` | 复制角色 |
| POST | `/roles/:id/activate` | 激活角色 |
| POST | `/roles/deactivate` | 停用当前角色 |
| GET | `/state` | 返回 `{ activeRoleId, lastActivation }` |

请求体示例（POST/PUT `/roles`）：

```json
{
  "name": "开发者",
  "description": "日常开发",
  "plugins": ["@deepseek-ai/dsh-tool-cordis"],
  "skills": ["code-review", "tdd"],
  "mcps": ["github"]
}
```

激活响应示例：

```json
{
  "ok": true,
  "data": {
    "plan": {
      "roleId": "developer",
      "enablePlugins": [],
      "disablePlugins": [ { "entryId": "some-entry", "moduleName": "@dsh-external/other" } ],
      "enableMcps": [],
      "createMcps": [],
      "updateMcps": [],
      "removeMcps": [],
      "enableSkills": [],
      "disableSkills": [],
      "warnings": []
    },
    "executed": ["disable:some-entry"],
    "rolledBack": []
  }
}
```

### 2.3 能力操作

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/capabilities/plugin/:entryId/enable` | 启用插件 |
| POST | `/capabilities/plugin/:entryId/disable` | 停用插件 |
| POST | `/capabilities/mcp/:serverName/enable` | 启用 MCP |
| POST | `/capabilities/mcp/:serverName/disable` | 停用 MCP |
| DELETE | `/capabilities/plugin/:moduleName` | 卸载受管插件（按 moduleName） |
| DELETE | `/capabilities/mcp/:serverName` | 卸载 MCP |
| POST | `/capabilities/skill/:name/enable` | 启用技能（恢复 model/user 可调用） |
| POST | `/capabilities/skill/:name/disable` | 停用技能（默认 model+user 都禁用，可用 body 指定） |
| DELETE | `/capabilities/skill/:name` | 卸载技能（移入回收站） |

技能停用请求体：

```json
{
  "modelInvocable": false,
  "userInvocable": false
}
```

### 2.4 MCP 定义库

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/mcps` | 添加 MCP 定义并创建 Loader entry |
| PUT | `/mcps/:serverName` | 更新 MCP 定义并热更新 entry |
| DELETE | `/mcps/:serverName` | 删除 MCP 定义并移除 entry |

添加/更新请求体示例（stdio）：

```json
{
  "serverName": "github",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": { "GITHUB_TOKEN": "${env.GITHUB_TOKEN}" }
}
```

### 2.5 错误码

| HTTP | error | 含义 |
|---|---|---|
| 400 | `invalid-input` | 参数校验失败 |
| 404 | `not-found` | 角色/能力不存在 |
| 409 | `conflict` | 重复 serverName / 角色 id / 操作冲突 |
| 403 | `forbidden` | 禁止卸载官方插件或自身插件 |
| 500 | `apply-failed` | 激活失败（含已回滚信息） |

## 3. Client UI 契约

### 3.1 注册

```ts
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'

type ClientContext = { slots: SlotsService }

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.effect(() =>
    ctx.slots.inject('settings.section', () =>
      ctx.slots.register({
        name: 'settings.section',
        id: 'kabutack',
        order: 60,
        label: () => '角色管理',
        component: () => ({ render() { /* ... */ } }),
      }),
    ),
    'kabutack: settings page',
  )
}
```

### 3.2 页面结构

- 顶部：当前激活角色、切换状态。
- Tab 1「能力目录」：筛选/搜索/启停按钮/卸载按钮。
- Tab 2「角色」：角色卡片列表，激活/编辑/复制/删除。
- Tab 3「角色编辑器」：表单 + 三个能力多选列表。

### 3.3 数据获取

- 使用 `fetch('/kabutack/api/...')`，与 `dsh-super-injector` 一致。
- 建议 30s 轮询 Catalog；写操作后手动刷新。
- 所有请求带 `content-type: application/json`。

## 4. 事件/通知（可选）

v1 不强制实现 WebSocket。如需要多标签页同步，可后续增加：

- Host 在 Catalog/角色变更后广播 `kabutack/change`。
- UI 监听并刷新。

## 5. 兼容性

- API 前缀 `/kabutack/api` 不与现有 DSH 路由冲突。
- 所有响应使用 JSON；错误时 HTTP 状态码与 `ok:false` 同时给出。
