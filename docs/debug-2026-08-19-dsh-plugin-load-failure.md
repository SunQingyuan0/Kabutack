# 调试日志：dsh 启动失败 / kabutack 插件加载失败（2026-08-19）

> 状态：**已修复并验证**。本文件记录本次问题的完整调查过程与修复内容，供日后回溯。

## 1. 背景

Kabutack（`@galactus/kabutack`，原名 `@dsh-external/kabutack`）是一个 Cordis 插件，
统一管理 DSH 的插件/Skill/MCP，支持角色化动态装载与切换。它通过
`~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 注册进 web profile 的插件树。

## 2. 现象（两个阶段的报错）

### 阶段一（2026-08-18）：host 侧启动失败

```
Error: dsh: plugin tree failed to load: dsh: 2 entries did not activate
@dsh-external/kabutack: pending (waiting for service: logger)
@dsh-external/kabutack: pending (waiting for service: logger)
```

### 阶段二（2026-08-19，改名后）：client 侧注册失败

```
Failed to load plugins
failed to import loader entry f01c92d0 (@dsh-external/kabutack): client-modules:
bundle /plugins/@dsh-external/kabutack/client.js?rev=404df2111bc2 loaded without
registering "@dsh-external/kabutack" via __ModuleLoader__.load
```

## 3. 环境

| 项 | 值 |
|---|---|
| dsh | `@deepseek-ai/dsh@0.1.0-rc.7`（npm 全局安装，`AppData/Roaming/npm`） |
| profile | `~/.dsh/profiles/web`（bundle: dsh-base + dsh-web-app + kabutack） |
| 插件源码 | `E:\coding\Kabutack`，`main: ./lib/index.js`（已构建产物） |
| profile 链接 | `node_modules/@galactus/kabutack` → junction → `E:\coding\Kabutack` |
| 框架 | cordis（dsh 内嵌 fork），插件通过 `export const inject` 声明服务依赖 |

## 4. 调查过程（证据链）

### 4.1 `logger` 服务不存在

- `~/.dsh/kabutack/audit.log` 显示 08-17 插件还能正常激活（`restore.ok`），08-18 起失败。
- dsh 启动器 `dsh-app-boot/lib/index.js`（`assertEntriesActivated`，约 1133 行）对 pending
  条目的判定逻辑：

  ```js
  const missing = Object.keys(fiber.inject).filter((service) => fiber.ctx.get(service) === void 0);
  ```

  → 报 `waiting for service: logger` 即 `ctx.get('logger') === undefined`。
- 全量检索 `@deepseek-ai/dsh/node_modules/@deepseek-ai/*`：**没有任何包 `provide('logger')`**。
- 结论：dsh 的 cordis fork 中 `logger` 是 Context 构造器直接赋值的内置属性，
  **不是**通过 `provide()` 注册的服务。把它写进 `inject` 会让插件永远 pending。

### 4.2 client bundle 注册名与插件树条目名不一致

- client 构建脚本 `scripts/build-client.mjs` 用 `window.__ModuleLoader__.load({ id: <pluginId> })`
  包装编译产物，输出 `lib/client.js`。
- `dsh-client-modules/lib/client.js`（约 84 行）加载 bundle 后校验：

  ```js
  if (!this.factories.has(id)) throw new Error(`client-modules: bundle ${url} loaded without registering "${id}" ...`);
  ```

  其中 `id` 取自插件树条目名。改名后树里条目是 `@dsh-external/kabutack`（profile 配置未更新），
  而 bundle 注册的是 `@galactus/kabutack`（build-client.mjs 已更新）→ 名字对不上 → 报错。
- `~/.dsh/profiles/web/package.json` 修改时间 08-17 15:30，晚于改名提交（08-19 11:25）之前，
  从未被更新过。

## 5. 根因

**根因 A（阶段一）**：`src/index.ts` 的 `inject` 声明了 `'logger'`。
`logger` 是 cordis fork 的内置属性而非 provide 服务，导致插件永远 pending。

**根因 B（阶段二）**：改名提交 `3856d5b`（包名 `@dsh-external/kabutack` → `@galactus/kabutack`）
改全了插件自身（`name` 导出、client 注册 id、lib 构建产物），但**没有同步**：
- `~/.dsh/profiles/web/package.json` 的依赖键与 bundles 条目仍为旧名；
- `install.ps1` 的 junction 路径仍建在 `node_modules\@dsh-external\` 下；
- `scripts/postinstall.cjs` 的 profile 探测路径仍为 `@dsh-external/kabutack`；
- `test/run.mjs` 对 bundle patch 的断言仍匹配旧名（改名后测试必挂）。

## 6. 修复内容

### 6.1 已执行的修复（本次会话）

| 文件 | 修改 |
|---|---|
| `~/.dsh/profiles/web/package.json` | 依赖键与 bundles 条目改为 `@galactus/kabutack` |
| `~/.dsh/profiles/web/node_modules/` | 新建 `@galactus/kabutack` junction → `E:\coding\Kabutack`；删除无引用的旧 `@dsh-external/kabutack` junction |
| `install.ps1` | junction 路径改为 `@galactus`；注册段移除旧依赖键、过滤旧 bundle 条目（重跑安装脚本可修复改名前的旧 profile）；删除旧名 junction |
| `scripts/postinstall.cjs` | profile 探测路径改为 `@galactus/kabutack`；并清理旧依赖键/旧 bundle/旧 link |
| `test/run.mjs` | bundle patch 断言更新为 `@galactus/kabutack` |
| `install.sh` | 同步修复：junction 路径改为 `@galactus`；删除旧 `@dsh-external` link；清理旧依赖键/旧 bundle 条目 |
| `README.md` | 手动安装路径由 `@dsh-external/` 改为 `@galactus/` |
| `docs/promotion.md` | scope 注意由 `@dsh-external` 改为 `@galactus` |

### 6.2 验证结果

- `node test/run.mjs`：13 个测试全部通过（含更新后的 bundle patch 断言）。
- `install.ps1` PowerShell 语法解析通过。
- `install.sh` Git Bash（`D:\Program Files\Git\bin\bash.exe -n`）语法检查通过。
- `scripts/postinstall.cjs` 临时 profile 验证：旧依赖键/旧 bundle/旧 link 被清理，新 bundle 正确写入。
- `dsh --profile web --dump-config`：树中 kabutack 条目为单一 `@galactus/kabutack`。
- `dsh web --port 0`：干净启动，无 `plugin tree failed to load`。
- client bundle 以 `id: "@galactus/kabutack"` 注册，与树条目名一致；旧名字 URL 返回 404。

## 7. 遗留事项 / 建议

- [x] **重启正在运行的 `dsh web`**：检查端口 3080 当前无监听，暂无需要重启的旧实例；后续启动时会使用已修复的新配置。
- [x] 检查 `bootstrap.ps1` / `bootstrap.sh`：bootstrap 脚本本身无旧名引用；`bootstrap.sh` 调用的 `install.sh` 曾残留旧路径，本次已一并修复。
- [ ] 后续发布/传播时确认 `@galactus` scope 的发布权限（参见 `docs/promotion.md` 中关于 scope 的说明）。

## 8. 经验教训

1. **改名是全仓库操作**：包名/注册名一旦改变，profile 配置、安装脚本、测试断言必须同步，
   否则会出现"自身一致、外部引用不一致"的半改名状态。
2. **cordis fork 的内置属性不是服务**：`inject` 只能写 `provide()` 注册过的服务；
   内置属性（如 `logger`）直接使用，写进 `inject` 会导致永久 pending。
3. **报错链有主次**：`loaded without registering` 是 client 端表象，先排查 host 侧
   （`plugin tree failed to load` / pending 服务）再查 client 注册名是否与树条目名一致。
