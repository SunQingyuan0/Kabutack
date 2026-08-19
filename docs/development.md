# 开发指南

> 本文是 Kabutack 的本地开发指南，按 [DSH 官方开发文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/development.md) 的组织方式整理。
> 更细的 DSH 扩展点实测说明见 [06-dsh-extension-reference.md](06-dsh-extension-reference.md)。

## Setup tutorial

### Prerequisites

- Node.js 22.19+（推荐 24；DSH 官方 CI 覆盖 22.19 / 24 / 26）。
- Git 2.26 或更新。
- 可选：本地 DSH 源码 checkout（`~/dsh-harness` 或通过 `DSH_CHECKOUT` 指定）。构建与类型检查脚本会优先使用本地 `node_modules/.bin/tsc`，缺失时回退到 DSH checkout 的 `tsc`，保证离线可用。
- 如果使用 pnpm，建议启用 Corepack 并固定 `pnpm@11.7.0`（见 `package.json` 的 `packageManager`）。

### First-time setup

从仓库根目录安装依赖：

```bash
pnpm install
# 或使用 npm
npm install
```

首次 clone 后运行一次类型检查：

```bash
pnpm run typecheck
# 或 npm run typecheck
```

当 `pnpm run typecheck` 成功退出时，本地开发环境即就绪。

> 本插件仓库不是 DSH 主仓库，因此不强制安装 Lefthook、翻译配对 merge driver、Typert 等 DSH 主仓库设施；下面只保留对本项目适用的约定。

## Contributor reference

### TypeScript project layout

本项目采用与 DSH 主仓库一致的 **Host / Client 两个 aggregate** 组织方式：

| 文件 | 作用 |
|---|---|
| `tsconfig.json` | Solution root：`files: []`，只引用 Host / Client 两个 aggregate，是编辑器与 IDE 的入口 |
| `tsconfig.host.json` | Host aggregate：编译 `src/`（排除 `src/client`），输出到 `lib/` |
| `tsconfig.client.json` | Client aggregate：编译 `src/client/`，输出到 `lib/.client-build/`，再由构建脚本包成 `lib/client.js` |
| `tsconfig.base.json` | Host 侧共享 `compilerOptions` |
| `tsconfig.base.client.json` | Client 侧浏览器编译设置（DOM libs、`types: []`） |

构建顺序：

```text
tsc -p tsconfig.host.json      # Host 编译 → lib/
tsc -p tsconfig.client.json    # Client 编译 → lib/.client-build/
node scripts/build-client.mjs  # 包 ModuleLoader 外壳 → lib/client.js
```

脚本说明：

- `scripts/build-host.mjs`：Node 跨平台 Host 构建；优先本地 `node_modules/.bin/tsc`，缺失时从 DSH checkout 链接依赖并回退到其 `tsc`。
- `scripts/build.sh`：Bash 版 Host 构建，保留给 Bash 环境。
- `scripts/build-client.mjs`：Client 构建，输出 `lib/client.js`。
- `scripts/typecheck.mjs`：Host + Client 两侧类型检查；优先本地 tsc，回退 DSH checkout。
- `scripts/typecheck.sh`：Bash 版类型检查。

日常命令：

```bash
pnpm run typecheck   # Host + Client 两侧都检查
pnpm run build:host  # 仅 Host
pnpm run build:client
pnpm run build:all   # Host + Client
pnpm test
pnpm run check       # typecheck + test
pnpm run check:all   # check + build:all
```

### Environment variables

构建脚本通过以下环境变量定位 DSH checkout：

```bash
DSH_CHECKOUT=/path/to/deepseek-harness   # 可选；缺省探测 ~/dsh-harness、~/dsh、~/.dsh/dsh-harness
DSH_HOME=/path/to/.dsh                   # 可选；插件运行时数据目录，默认 ~/.dsh
```

不要提交真实凭据。本插件当前不读取 `DEEPSEEK_API_KEY`，但如果你在本机同时开发 DSH 主仓库，请遵循其 `.env` 规则。

### Git integrations

本项目保持轻量 Git 工作流，不引入 DSH 主仓库的翻译配对 merge driver 与 Lefthook 钩子。提交前请至少运行：

```bash
pnpm run check
```

如果改动涉及构建脚本或 TypeScript 配置，再运行：

```bash
pnpm run build:all
```

### CI gates

本插件仓库不复制 DSH 主仓库的完整 CI 矩阵；本地“门禁”以 `pnpm run check:all` 为准。若将来接入 CI，建议至少包含：

- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build:all`

### TODO markers

代码中统一使用三种注释标记，按紧急程度排序：

- `FIXME` — 会阻塞新 release 的问题；除非评审明确同意，否则不应带着它发布。
- `TODO` — 应尽快修复，但当前资源不足。
- `XXX` — 将来可能修复，最低优先级。

选择与问题紧急程度匹配的标记，方便扫描代码的人区分“发布阻断”和“以后再说”。

### Documenting types verbatim

本项目文档暂不使用 DSH 主仓库的 `ts type-equiv` 机制。若未来在 `docs/` 中粘贴源码级类型，请手动标注来源文件并保持与源码同步。

## 开发循环

```bash
# 1. 类型检查
pnpm run typecheck

# 2. 构建（host + client）
pnpm run build:all

# 3. 单元测试
pnpm test

# 4. 在 DSH 注入器环境中加载/重载
dev_build_plugin E:/coding/Kabutack
dev_inject_plugin E:/coding/Kabutack
dev_reload_package kabutack
```

常用注入器命令：

| 命令 | 作用 |
|---|---|
| `dev_build_plugin <dir>` | 构建插件并打包 tgz |
| `dev_inject_plugin <dir>` | 运行时注入本地插件包 |
| `dev_reload_package <name>` | 热重载已加载插件包 |
| `dev_install_package <dir>` | 热装配并写入 profile，重启后保留 |
| `dev_uninject_plugin <name>` | 卸载注入的插件 |
| `dev_self_test` | 注入器全链路回归 |

## 安装与发布

- npm/bun 安装（发布到 npm 后）：
  ```bash
  cd ~/.dsh/profiles/web
  bun add @galactus/kabutack
  # 或 npm install @galactus/kabutack
  # 不想 cd 时，npm 可以直接：
  # npm install --prefix ~/.dsh/profiles/web @galactus/kabutack
  ```
  包内 `postinstall` 会自动写入 `dsh.profile.bundles`。
- 本地一键安装：`./install.sh [profile]` 或 `powershell -File install.ps1 -Profile <profile>`。
- 远程安装：`bootstrap.sh` / `bootstrap.ps1` 会下载仓库源码压缩包再执行安装脚本（无需 Git）。
- 发布 npm：先 `npm run build:all`（或确认 `lib/` 已是最新），再 `npm publish`（已配置 `publishConfig.access = public`）；GitHub Release 使用 `dev_build_plugin` 产出 tgz，再通过 `dev_release_plugin` 发布。

## 常见问题

1. **`tsc` 找不到**：确认 `DSH_CHECKOUT` 指向包含 `packages/` 与 `node_modules/.bin/tsc` 的 DSH 源码目录；或先 `pnpm install` 安装本地 TypeScript。
2. **路由残留**：`ctx.webServer.register` 必须放在 `ctx.effect` 中返回 disposer，或热重载后使用 `dev_clear_routes`。
3. **client 模块重复实例**：所有 `@deepseek-ai/dsh-client-*` 导入走 `/client` 子路径。
4. **patch 重复 id**：修改 `cordis.patch.yml` 前检查 `id` 唯一。
5. **技能 frontmatter 严格**：写入 `SKILL.md` 前用 YAML 解析校验，字段拼错会导致技能被跳过。
