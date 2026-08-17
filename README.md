# Kabutack（DSH 角色化能力管理插件）

> 统一管理 DSH 插件 / Skill / MCP，支持角色 CRUD、一键切换与动态装载/卸载、持久化与重启恢复。

## 功能

- **统一 Catalog**：聚合 `ctx.loader`、`ctx.skills` 与 MCP 插件实例。
- **角色管理**：创建、编辑、删除、复制角色，为角色装配插件/Skill/MCP。
- **角色切换**：计算差异并动态启用/停用/装载/卸载，失败回滚。
- **持久化**：角色与激活状态保存到 `~/.dsh/kabutack/roles.json`，重启自动恢复。
- **Web UI**：DSH 设置页 `settings.section` 中的 Kabutack 面板。

## 文档

- [docs/00-project-brief.md](docs/00-project-brief.md) — AI Coding 开工简报
- [docs/01-product-requirements.md](docs/01-product-requirements.md) — 产品需求
- [docs/02-architecture.md](docs/02-architecture.md) — 架构设计
- [docs/03-data-model.md](docs/03-data-model.md) — 数据模型
- [docs/04-api-spec.md](docs/04-api-spec.md) — API 规格
- [docs/05-implementation-tasks.md](docs/05-implementation-tasks.md) — 实施任务
- [docs/06-dsh-extension-reference.md](docs/06-dsh-extension-reference.md) — DSH 扩展点参考
- [docs/07-testing-and-acceptance.md](docs/07-testing-and-acceptance.md) — 测试与验收
- [docs/08-open-questions.md](docs/08-open-questions.md) — 开放问题

## 一键安装（其他机器 / 原生 DSH）

### 方式一：本地仓库

```powershell
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File install.ps1
```

```bash
# macOS / Linux / Git Bash
./install.sh
```

默认安装到 DSH 的 `web` profile；如需指定 profile：

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Profile my-profile
```

```bash
./install.sh my-profile
```

安装后重启 DSH 即可加载 Kabutack。

### 方式二：远程一行命令（仓库发布到 GitHub 后）

```powershell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/<owner>/<repo>/main/install.ps1 | iex"
```

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/install.sh)"
```

## 开发构建与注入

```bash
# 构建 host + client
npm run build
npm run build:client

# 在 DSH 注入器环境中
dev_build_plugin E:/coding/Kabutack
dev_inject_plugin E:/coding/Kabutack
```

## 当前状态

- [x] Phase 0：脚手架、构建、注入、热重载
- [x] Phase 1：Catalog 快照（插件/Skill/MCP）
- [x] Phase 2：角色 CRUD 与 `roles.json` 持久化
- [x] Phase 3：插件启停与角色激活引擎
- [x] Phase 4：MCP 管理（增删改查、启停、角色内自动创建/移除）
- [x] Phase 5：技能管理（文件系统技能 frontmatter 启停/卸载）
- [x] Phase 6：完整角色切换、重启恢复、审计日志
- [x] Phase 7：安全保护（官方/自身插件不可卸载）
- [x] 基础单元测试（`npm test`，11 个用例）

## 说明

- 插件包名：`@dsh-external/kabutack`
- 数据目录：`~/.dsh/kabutack/`
- HTTP API：`/kabutack/api`
- UI 入口：DSH 设置 → Kabutack
