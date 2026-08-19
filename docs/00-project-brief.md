# 00 AI Coding 项目简报（Project Brief）

> 给 AI Coding 助手的“一页纸”开工说明。详细内容见各文档。

## 任务

在 `E:\coding\Kabutack` 下实现 DSH 插件 `@galactus/kabutack`：

- 统一管理 DSH 插件、Skill、MCP（浏览/启用/停用/卸载）。
- 支持自定义角色，为角色装配不同能力，保存后一键切换，DSH 运行时动态装载/卸载。
- 角色与激活状态持久化，重启后恢复。
- 提供 DSH 设置页 Web UI。

## 技术形态

- **hybrid 插件**：Host 侧服务 + Client 侧 `settings.section` UI。
- 语言：TypeScript。
- 构建：`scripts/build-host.mjs`（Host，Node 跨平台）+ `scripts/build-client.mjs`（Client，基于 DSH checkout tsc）。
- 接入：`dev_build_plugin` → `dev_inject_plugin`（开发期）；后续可用 `dev_install_package` 持久装配。

## 必须遵守的 DSH 约定

1. 入口命名导出 `name` / `inject` / `apply`，不要默认导出。
2. Host 使用 `ctx.loader`、`ctx.skills`、`ctx.webServer`。
3. Client 使用 `ctx.slots.inject('settings.section')`，从 `@deepseek-ai/dsh-client-*` 导入必须走 `/client` 子路径。
4. 所有持久化写入原子化；不破坏 `cordis.patch.yml`（防重复 id）。
5. 禁止卸载官方 bundle 插件与自身插件。

## 推荐实施顺序

1. Phase 0：脚手架 + 可注入空插件 + 空 UI。
2. Phase 1：Catalog 只读快照。
3. Phase 2：角色 CRUD + `roles.json`。
4. Phase 3：插件启停 + 角色激活引擎。
5. Phase 4：MCP 管理。
6. Phase 5：技能管理。
7. Phase 6：完整切换 + 重启恢复 + 审计。
8. Phase 7：安全/健壮性/打磨。

详见 [05-implementation-tasks.md](05-implementation-tasks.md)。

## 完成定义（Definition of Done）

- [ ] 插件可构建、可注入、可热重载。
- [ ] 设置页出现“角色管理” UI。
- [ ] Catalog 能显示插件/Skill/MCP。
- [ ] 角色 CRUD 持久化到 `~/.dsh/kabutack/roles.json`。
- [ ] 激活角色能动态启停插件、创建/移除 MCP、应用技能覆盖。
- [ ] 失败可回滚；重复激活幂等。
- [ ] DSH 重启后恢复上次激活角色。
- [ ] 核心操作有审计日志。
- [ ] 文档中的测试场景通过。

## 关键文档链接

- [开发指南](development.md)
- [01 产品需求](01-product-requirements.md)
- [02 架构](02-architecture.md)
- [03 数据模型](03-data-model.md)
- [04 API 规格](04-api-spec.md)
- [05 实施任务](05-implementation-tasks.md)
- [06 DSH 扩展点参考](06-dsh-extension-reference.md)
- [07 测试与验收](07-testing-and-acceptance.md)
- [08 开放问题](08-open-questions.md)
