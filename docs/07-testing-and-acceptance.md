# 07 测试与验收

## 1. 测试策略

| 层级 | 范围 | 工具建议 |
|---|---|---|
| 单元测试 | 角色 CRUD、ApplyPlan 计算、MCP 配置转换、frontmatter 读写 | `node:test` 或 `vitest` |
| 集成测试 | 对 mock/fake `ctx.loader`/`ctx.skills` 执行激活引擎 | `vitest` + 手写 fake service |
| 注入回归 | 构建、注入、热重载、卸载不污染 DSH | `dev_self_test` + 手工脚本 |
| 手工 UI | 设置页浏览/编辑/切换 | DSH Web UI |

## 2. 自动化测试用例

### 2.1 角色存储

- `roles.json` 不存在时返回空存储。
- 创建角色生成合法 id，重复 id 抛错。
- 更新角色后 `updatedAt` 变化。
- 删除激活角色被拒绝或要求先切换。
- 原子写：模拟写入失败时原文件不被破坏。
- 文件损坏时备份为 `.bad-<timestamp>` 并返回空状态。

### 2.2 ApplyPlan 计算

- 空角色 vs 空 Catalog → 空计划。
- 角色需要插件 A，当前 A 已启用 → `enablePlugins` 不包含 A。
- 角色不需要插件 B，B 受管且启用 → `disablePlugins` 包含 B。
- 角色需要 MCP github，Catalog 无 github → `createMcps` 包含定义。
- 角色不需要 MCP web，Catalog 有 web 且受管 → `removeMcps` 包含 web。
- 角色需要技能 code-review，当前 modelInvocable=false → `skillOverrides` 恢复 true。
- 角色引用不存在的插件/MCP → 产生 warning 而非崩溃。

### 2.3 激活执行与回滚

- 成功路径：执行顺序为 enable → create → update → remove → skillOverrides。
- 失败路径：第 3 步抛错时，逆序回滚第 2、1 步；返回 `ok:false` 与 `rolledBack`。
- 幂等：连续两次激活同一角色，第二次无操作或全部 no-op。
- 自我保护：尝试停用/卸载 `kabutack` 自身被拒绝。
- 官方 bundle 插件：尝试卸载被拒绝，只允许停用。

### 2.4 MCP 管理

- 添加 stdio MCP → `ctx.loader.create` 收到正确 config。
- 更新 serverName 冲突 → 409。
- 删除 MCP → `ctx.loader.remove` 被调用且定义库移除。
- 无效 transport/缺少必填字段 → 400。

### 2.5 技能管理

- 文件系统技能停用后 frontmatter 写入正确布尔值。
- frontmatter 写入损坏时回滚原内容。
- 运行时技能通过 overlay provider 过滤。
- 卸载技能文件移动到回收站，原路径不存在。

## 3. 手工验收场景

### S1 浏览 Catalog

1. 打开 DSH 设置 → 角色管理。
2. 看到“插件 / 技能 / MCP”三类列表。
3. 插件显示 `enabled/fiberPhase`；技能显示 invocation；MCP 显示 serverName/transport/status。

### S2 插件启停

1. 在能力目录停用一个非核心插件。
2. 该插件 fiber 停止，UI 状态变为停用。
3. 重启 DSH，状态保持（对持久 patch 管理的插件）。
4. 重新启用，恢复。

### S3 创建并切换角色

1. 创建角色“开发”，勾选 code-review、tdd、一个 MCP。
2. 保存。
3. 创建角色“写作”，勾选 research、find-skills。
4. 激活“开发”：开发相关能力启用，写作相关能力停用。
5. 激活“写作”：反向切换。
6. 重复激活“写作”无异常。

### S4 失败回滚

1. 准备一个会启动失败的 MCP 配置。
2. 激活包含该 MCP 的角色。
3. 系统返回失败，且已启用的插件回滚到切换前状态。
4. 审计日志记录失败原因。

### S5 重启恢复

1. 激活“写作”。
2. 重启 DSH。
3. 插件自动激活“写作”；`roles.json.activeRoleId` 为 `writer`。
4. 若自动激活失败，日志有明确错误，DSH 正常启动。

### S6 卸载与回收

1. 卸载一个由本插件管理的 MCP。
2. Catalog 中消失，`roles.json.mcps` 移除。
3. 卸载一个文件系统技能。
4. 技能进入 `~/.dsh/kabutack/trash/`，可从文件管理器恢复。

## 4. 验收清单（对应 FR）

| 需求 | 验收 |
|---|---|
| FR-1 Catalog | UI 三类列表可浏览、搜索、过滤 |
| FR-2 插件管理 | 启停生效；官方插件不可卸载；自身受保护 |
| FR-3 技能管理 | 启停技能影响 `ctx.skills`；卸载进回收站 |
| FR-4 MCP 管理 | 增删改查、启停、热更新生效 |
| FR-5 角色 CRUD | 创建/编辑/删除/复制持久化 |
| FR-6 角色切换 | 一键切换、diff 正确、失败回滚、幂等 |
| FR-7 持久化恢复 | 重启恢复 activeRoleId |
| FR-8 UI | 设置页可用、操作有反馈、危险操作确认 |
| FR-9 安全审计 | 审计日志、输入校验、自我保护 |

## 5. 回归清单

- [ ] `dev_build_plugin` 构建成功。
- [ ] `dev_inject_plugin` 注入成功。
- [ ] `dev_reload_package` 热重载后功能正常。
- [ ] `dev_uninject_plugin` 卸载后无路由/服务残留。
- [ ] `dev_self_test` 通过（如适用）。
- [ ] 修改 `roles.json` 后重启不崩溃。
