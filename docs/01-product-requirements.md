# 01 产品需求说明书（PRD）

## 1. 背景与问题

DSH 当前把能力分散在多个入口中：

- 插件由 Cordis Loader / profile 配置管理；
- 技能由 `ctx.skills` 注册表与文件系统（`SKILL.md`）管理；
- MCP Server 通过 `@deepseek-ai/dsh-mcp-client` 插件实例接入。

用户缺少一个统一视图，也难以按“工作角色/场景”批量切换能力组合。例如：开发角色需要 `code-review`、`tdd`、GitHub MCP；写作角色需要 `research`、`find-skills`；而当前只能手动逐个启停，无法保存和快速切换。

## 2. 目标

- 提供一个 DSH 插件，统一浏览、启用、停用、卸载插件/技能/MCP。
- 支持用户自定义“角色”，为角色装配能力组合。
- 支持一键切换角色，DSH 在运行中动态装载/卸载对应能力，无需重启。
- 角色与当前激活状态持久化，DSH 重启后自动恢复。

## 3. 非目标（Out of Scope）

- 不实现完整的插件市场/远程安装器（v1 只管理“已安装/已注册”能力）。
- 不实现 MCP 的 Resource/Prompt 能力管理（DSH 当前只桥接 MCP Tools）。
- 不做多用户安全 RBAC；角色是本地使用场景配置，不是权限边界。
- 不修改 DSH 官方 preset 文件；只通过 profile patch / loader 运行时操作完成管理。
- 不实现技能内容的富文本编辑器；只做启用/停用/卸载/浏览。

## 4. 用户画像

| 画像 | 需求 |
|---|---|
| DSH 高级用户 | 在一个界面里看到全部能力，快速启停 |
| 多角色工作者 | 开发/写作/研究等场景需要不同能力组合，一键切换 |
| AI Coding 助手 | 需要清晰的 API/数据模型/任务拆解，能按文档实现插件 |

## 5. 用户故事

1. 作为用户，我可以在一个页面看到所有已安装 DSH 插件、技能和 MCP Server，并看到它们的启用状态。
2. 作为用户，我可以启用/停用某个插件，DSH 立即生效，且重启后保持。
3. 作为用户，我可以卸载某个由本插件管理的 MCP 或非官方插件，并收到确认提示。
4. 作为用户，我可以创建角色，给角色勾选插件、技能和 MCP。
5. 作为用户，我可以保存角色，之后随时重新加载。
6. 作为用户，我可以点击“切换到该角色”，系统自动启用角色需要的、停用不需要的、启动缺失的 MCP。
7. 作为用户，切换失败时我希望系统回滚到切换前状态，并给出可理解的错误。
8. 作为用户，我希望 DSH 重启后自动恢复到上次激活的角色。

## 6. 功能需求

### FR-1 统一能力目录（Catalog）

- `FR-1.1` 聚合三类能力：插件、技能、MCP。
- `FR-1.2` 支持按类型过滤、按名称/描述搜索、按启用状态过滤。
- `FR-1.3` 每条能力展示：名称、类型、启用状态、运行状态（插件/MCP fiber phase）、来源/路径（如可得）、简要描述。
- `FR-1.4` Catalog 必须实时反映 Loader 与 Skills 注册表当前状态，不维护过期缓存。

### FR-2 插件管理

- `FR-2.1` 浏览：列出当前 profile 中所有非 group Loader entry（复用 `PluginInventoryEntry` 语义）。
- `FR-2.2` 启用/停用：调用 `ctx.loader.update(id, { disabled: bool })` 或等价 Loader 操作；停用不卸载包，只停止 fiber。
- `FR-2.3` 卸载：对“本插件安装/注入”的插件，从持久配置（`cordis.patch.yml` / 注入 registry）中移除并停止；对官方/bundle 插件只允许停用，不允许卸载，避免破坏 DSH。
- `FR-2.4` 自我保护：禁止停用/卸载 `kabutack` 自身及其所依赖的宿主插件（如 `dsh-super-injector` 若被本插件依赖）。

### FR-3 技能管理

- `FR-3.1` 浏览：通过 `ctx.skills.list()` / `ctx.skills.snapshot()` 获取当前可见技能。
- `FR-3.2` 启用/停用：优先通过修改技能文件 frontmatter 的 `disable-model-invocation` / `user-invocable` 实现；对运行时注册技能，通过维护一个“本插件管理覆盖层”的 `SkillProvider` 过滤。
- `FR-3.3` 卸载：对文件系统技能，把技能目录/文件移动到 `~/.dsh/kabutack/trash/`（可恢复）；对运行时技能仅取消注册/从角色中移除。
- `FR-3.4` 浏览时展示技能的 invocation 策略（model/user 可调用）。

### FR-4 MCP 管理

- `FR-4.1` 浏览：列出 `moduleName === '@deepseek-ai/dsh-mcp-client'` 的 Loader entry，并解析其 `serverName`、transport、command/url 等配置。
- `FR-4.2` 添加：用户提供 serverName、transport、stdio/http 参数，本插件通过 `ctx.loader.create()` 创建 MCP 插件实例，并持久化定义。
- `FR-4.3` 编辑：更新 MCP 配置，通过 `ctx.loader.update()` 热更新（DSH MCP client 支持 HMR）。
- `FR-4.4` 启用/停用：与插件启停一致。
- `FR-4.5` 卸载：移除 Loader entry 并删除持久化 MCP 定义。

### FR-5 角色管理

- `FR-5.1` 创建角色：输入名称、描述，选择插件/技能/MCP。
- `FR-5.2` 编辑角色：增删能力、改名称/描述。
- `FR-5.3` 删除角色：若该角色是当前激活角色，需先切换/停用或二次确认。
- `FR-5.4` 复制角色：基于现有角色快速创建。
- `FR-5.5` 角色列表：展示名称、描述、能力数量、是否为当前激活角色。

### FR-6 角色激活/切换

- `FR-6.1` 计算 diff：对比角色期望能力集合与当前 Catalog 实际状态。
- `FR-6.2` 执行计划：
  - 启用角色需要的已安装插件；
  - 停用角色不需要的、且属于“本插件受管范围”的插件；
  - 为角色内定义的缺失 MCP 创建实例；
  - 停用/移除角色外且受管的 MCP；
  - 对技能应用启用/停用覆盖。
- `FR-6.3` 事务性：任一步失败时，回滚已执行步骤，恢复切换前状态；返回详细错误。
- `FR-6.4` 幂等性：重复激活同一角色不产生重复 entry / 不报错。
- `FR-6.5` 激活后记录 `activeRoleId` 与时间。
- `FR-6.6` 安全保护：角色未配置任何技能时，跳过“停用未分配技能”，避免误禁用全部技能，并给出 warning。

### FR-7 持久化与恢复

- `FR-7.1` 角色、MCP 定义、当前激活角色保存到 `~/.dsh/kabutack/roles.json`。
- `FR-7.2` 写入使用临时文件 + 原子 rename。
- `FR-7.3` DSH 启动时，插件读取 `activeRoleId` 并尝试自动激活；失败时记录日志，不阻止 DSH 启动。

### FR-8 Web UI

- `FR-8.1` 在 DSH 设置页新增“角色管理”入口（`settings.section`）。
- `FR-8.2` 页面包含三个页签或分区：能力目录、角色列表、角色编辑器。
- `FR-8.3` 所有写操作有 loading/错误/成功反馈。
- `FR-8.4` 危险操作（卸载、删除角色）有确认提示。
- `FR-8.5` 页面通过 `fetch` 调用 Host API，遵循现有 `dsh-super-injector` 的 API 风格。

### FR-9 审计与安全

- `FR-9.1` 记录关键操作日志：角色激活、插件停用/卸载、MCP 增删改。
- `FR-9.2` 校验所有输入：角色 id、能力 id、MCP serverName 格式、路径不越界。
- `FR-9.3` 禁止对 DSH 核心/自身插件执行卸载。

## 7. 非功能需求

| 编号 | 需求 | 指标/约束 |
|---|---|---|
| NFR-1 | 热切换 | 角色切换不要求重启 DSH 进程 |
| NFR-2 | 回滚 | 激活失败时恢复到切换前状态 |
| NFR-3 | 原子持久化 | roles.json 不出现半写状态 |
| NFR-4 | 性能 | 典型目录（<200 能力）快照 <500ms；切换 <5s |
| NFR-5 | 兼容 | 遵循 DSH 插件规范，可 `dev_build_plugin` / `dev_inject_plugin` |
| NFR-6 | 可观测 | 有日志文件 `~/.dsh/kabutack/audit.log` |
| NFR-7 | 安全 | API 只监听回环地址，输入校验严格 |

## 8. 验收标准摘要

详见 [07-testing-and-acceptance.md](07-testing-and-acceptance.md)。核心验收：

1. 能在 UI 看到插件/技能/MCP 三类列表。
2. 能单个启停插件与 MCP，立即生效且重启保持。
3. 能创建/保存角色并切换，能力组合随之变化。
4. 切换失败可回滚。
5. DSH 重启后恢复上次激活角色。
