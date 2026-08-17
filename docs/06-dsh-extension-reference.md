# 06 DSH 扩展点参考

本文汇总实现 `kabutack` 所需的 DSH 插件开发知识，基于当前环境（`@deepseek-ai/*` rc.6 系列）实测可用的 API 与惯例。

## 1. 插件包结构

一个 DSH bundle 插件通常包含：

```text
package.json
tsconfig.json
scripts/build.sh
src/index.ts
src/client/index.ts   # 可选：浏览器侧
tsdown.config.ts      # 可选：client 构建
cordis.patch.yml      # 可选：patch 装配
lib/                  # 构建产物
```

`package.json` 关键字段：

```json
{
  "name": "@dsh-external/kabutack",
  "version": "0.1.0",
  "type": "module",
  "main": "./lib/index.js",
  "types": "./lib/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    },
    "./client": {
      "types": "./lib/types/client/index.d.ts",
      "default": "./lib/client.js"
    },
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-slots"
      ],
      "platform": "web"
    }
  },
  "peerDependencies": {
    "@deepseek-ai/dsh-tools": ">=0.0.1-rc <2",
    "cordis": ">=4.0.0-rc <5",
    "schemastery": "^3.18.0"
  },
  "scripts": {
    "build": "bash scripts/build.sh",
    "build:client": "tsdown",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

## 2. Host 插件入口

`src/index.ts` 命名导出 `name`、`inject`、`apply`（不要默认导出；实测默认导出会丢 inject）。

```ts
import type { Context } from 'cordis'
import { Schema } from 'schemastery'

export const name = 'kabutack'

export const inject = ['loader', 'skills', 'webServer', 'logger']

export interface Config {
  dataDir?: string
  pollIntervalMs?: number
}

export const Config = Schema.object({
  dataDir: Schema.string().default(''),
  pollIntervalMs: Schema.number().default(30000),
})

export function apply(ctx: Context, config: Config): void {
  // 注册服务、路由、effect
  ctx.effect(() => {
    // 注册 ctx.webServer route，返回 disposer
    return ctx.webServer.register({ ... })
  })
}
```

## 3. Cordis Loader API

`ctx.loader` 是 `@deepseek-ai/cordis-plugin-loader` 的 `Loader` 实例。

### 常用方法

```ts
// 枚举所有 entry（含嵌套）
for (const entry of ctx.loader.entries()) {
  entry.id
  entry.options.name       // 模块名
  entry.options.config     // 插件配置
  entry.options.disabled   // 原始 disabled 字段
  entry.disabled           // 有效 disabled（含父 group）
  entry.fiber?.state       // 0=pending 1=loading 2=active 3=failed 5=unloading
}

// 创建 entry（返回 entry id）
const id = await ctx.loader.create({
  name: '@deepseek-ai/dsh-mcp-client',
  config: { serverName: 'github', transport: 'stdio', command: 'npx' },
})

// 更新 entry（改配置/启停）
await ctx.loader.update(id, { disabled: true })
await ctx.loader.update(id, { config: { ... } })

// 删除 entry
await ctx.loader.remove(id)

// 导入模块（动态加载本地包）
await ctx.loader.import('file:///path/to/lib/index.js', () => [])
```

### 注意事项

- `ctx.loader.update(id, { disabled: bool })` 会重启/停止对应 fiber，是启停插件的主要手段。
- `ctx.loader.create()` 创建的是运行时 entry；重启后默认不会保留，除非同时写入 profile 配置（`cordis.patch.yml` 或 `package.json` bundles）。
- 官方 bundle 插件由 `package.json` 的 `dsh.profile.bundles` 装配；本插件不应删除这些 entry，只能启停。
- 动态 `loader.create` 可能产生“幽灵 entry”（不在持久配置中）；若需要清理，用 `ctx.loader.remove(id)`。

## 4. 持久化装配（profile patch）

当前 DSH profile 的持久化入口：

- `~/.dsh/profiles/web/package.json`
  ```json
  {
    "name": "dsh-profile-web",
    "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"] } }
  }
  ```
- `~/.dsh/profiles/web/cordis.patch.yml`
  ```yaml
  - insert:
      - id: dsh-super-injector
        name: '@dsh-external/dsh-super-injector'
        config: {}
  ```

如果本插件需要“持久安装某个插件/MCP”，应写入 `cordis.patch.yml` 的 `insert` 列表；如果只是运行时角色切换，则直接操作 `ctx.loader` 即可，不必写 patch。

> 写 patch 时注意：
> - 保持 YAML 顶层为数组。
> - 避免重复 id（否则 DSH 启动可能因 duplicate loader entry 崩溃）。
> - 可参考 `dsh-super-injector` 的 `scripts/fix-patch.mjs` 与 `dev_fix_patch` 工具。

## 5. Skill Registry API

`ctx.skills` 来自 `@deepseek-ai/dsh-skill`。

### 常用方法

```ts
// 列出当前可见技能
const skills = await ctx.skills.list({ cwd: process.cwd() })

// 快照（含 complete 标记）
const snapshot = await ctx.skills.snapshot({ cwd: process.cwd() })
// snapshot.skills: SkillSummary[]
// snapshot.complete: boolean

// 获取技能详情
const skill = await ctx.skills.get(name, { cwd: process.cwd() })

// 注册运行时技能
const dispose = ctx.skills.register({
  name: 'my-skill',
  description: '...',
  content: '# ...',
  modelInvocable: true,
  userInvocable: true,
})

// 注册 Provider（可用于实现技能覆盖层）
const disposeProvider = ctx.skills.registerProvider((control) => ({
  name: 'kabutack-overlay',
  list: async (options) => {
    // 返回 SkillCandidate[] 或 { candidates, complete }
    return []
  },
  load: async (candidate, options) => { /* 返回 SkillDefinition */ },
}))
```

### SkillSummary 关键字段

```ts
interface SkillSummary {
  name: string
  description: string
  provider: string
  invocation: {
    modelInvocable: boolean
    userInvocable: boolean
  }
  // 提供方可能还有 path/locator 等
}
```

### 文件系统技能格式

技能根目录（如 `~/.dsh/skills/<name>/SKILL.md` 或 `<name>.md`）：

```markdown
---
name: my-skill
description: 描述
whenToUse: 使用时机
disable-model-invocation: false
user-invocable: true
---

# 正文
```

- `disable-model-invocation: true` 禁止模型调用。
- `user-invocable: false` 禁止用户调用。
- 字段拼写错误会导致整个技能被跳过（默认拒绝）。

## 6. MCP Client 配置

MCP 通过 `@deepseek-ai/dsh-mcp-client` 插件实例接入。一个 entry 就是一个 server。

stdio 示例：

```json
{
  "serverName": "github",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": { "GITHUB_TOKEN": "${env.GITHUB_TOKEN}" }
}
```

streamable-http 示例：

```json
{
  "serverName": "web",
  "transport": "streamable-http",
  "url": "http://localhost:3000/mcp",
  "headers": { "Authorization": "Bearer xxx" }
}
```

工具名称为 `mcp__<serverName>__<rawName>`。`serverName` 需唯一，格式 `[A-Za-z0-9_-]{1,32}`。

## 7. WebServer API

`ctx.webServer` 来自 `@deepseek-ai/dsh-host-webserver`。

```ts
ctx.effect(() => ctx.webServer.register({
  kind: 'prefix',
  path: '/kabutack/api',
  handler: async (req, res) => {
    const send = (code: number, obj: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(obj))
    }
    // 解析 req.url、req.method、req body
  },
}))
```

- `kind: 'exact' | 'prefix'`。
- 同一路径重复注册会抛错；热重载时记得清理旧路由（可在 effect disposer 中 dispose，或参考 `dev_clear_routes`）。
- 读 body 需要自己实现 `readBody(req)`。

## 8. Client UI 插槽

浏览器侧插件通过 `ctx.slots` 注册 UI。

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
        component: () => ({
          render() {
            const root = document.createElement('div')
            root.textContent = '角色管理'
            return { dispose: () => { /* cleanup */ } }
          },
        }),
      }),
    ),
    'kabutack: settings page',
  )
}
```

要点：

- `ctx.slots.inject` 等待 slot 声明存在后再注册；effect disposer 负责注销。
- `settings.section` 是设置页分区 slot（`dsh-super-injector` 已用）。
- 如果插件从 client 包导入类型，必须使用 `/client` 子路径，避免模块实例重复。

## 9. 构建与注入

| 工具 | 作用 |
|---|---|
| `dev_scaffold_plugin` | 生成插件骨架 |
| `dev_build_plugin` | 运行 `scripts/build.sh` 与 `build:client`，产出 tgz |
| `dev_inject_plugin` | 运行时注入本地插件包，免重启 |
| `dev_install_package` | 热装配 + 写入 profile package.json，重启后保留 |
| `dev_uninject_plugin` | 卸载注入的插件 |
| `dev_reload_package` | 热重载插件包 |
| `dev_self_test` | 注入器全链路回归 |

`scripts/build.sh` 通常：

```bash
#!/usr/bin/env bash
set -euo pipefail
# 探测 DSH_CHECKOUT 或默认路径
# tsc 编译 host 到 lib/
# 如有 client，运行 npm run build:client
```

## 10. 常见坑

1. **默认导出丢失 inject**：插件入口必须命名导出 `name/inject/apply`。
2. **client 模块重复实例**：从 `@deepseek-ai/dsh-client-*` 导入必须走 `/client` 子路径。
3. **Loader disabled 幽灵 entry**：动态 `loader.create` 后可能被 Loader 对账标记 disabled；必要时清 `entry.options.disabled` 或走官方 patch 装配。
4. **路由残留**：热重载后旧 fiber 可能残留 webServer route；注册路由时用 `ctx.effect` 返回 disposer，或使用 `dev_clear_routes`。
5. **patch 重复 id**：写 `cordis.patch.yml` 前检查重复 entry id，避免启动崩溃。
6. **skill frontmatter 校验严格**：字段名错误会让技能消失；写入前用 YAML 解析验证。
7. **MCP serverName 冲突**：重复 serverName 会使后加载实例失败；角色切换前先检查 Catalog。
