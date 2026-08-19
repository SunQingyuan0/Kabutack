# Kabutack

> 统一管理 DSH 插件 / Skill / MCP，并按“角色”一键动态装载与切换。

Kabutack 是一个面向 [DSH](https://github.com/deepseek-ai/deepseek-harness) 的插件，解决 DSH 能力分散、难以按场景批量切换的问题。它把插件、Skill、MCP 放在同一个界面里管理，并允许你定义多个“角色”，每个角色装配不同的能力组合；切换角色时，DSH 会自动启用/停用/装载/卸载对应能力。

---

## ✨ 功能

- **统一能力目录**
  - 在一个页面中浏览 DSH 插件、Skill、MCP
  - 插件 / Skill / MCP 分页展示，支持搜索
  - 查看运行状态、启用状态、调用策略

- **能力管理**
  - 插件：启用、停用、卸载（受管外部插件）
  - Skill：启用、停用、卸载到回收站
  - MCP：添加、编辑、删除、启停

- **角色化动态装载**
  - 自定义角色，为角色装配插件 / Skill / MCP
  - 创建角色时默认勾选 DSH 原始自带插件和全部 Skill
  - 一键切换角色，自动执行差异装载/卸载
  - 失败自动回滚，重复激活幂等

- **持久化与恢复**
  - 角色与激活状态保存到 `~/.dsh/kabutack/roles.json`
  - DSH 重启后自动恢复上次激活的角色
  - 原子写入，损坏自动备份

- **安全与可观测**
  - 禁止卸载 DSH 官方插件和 Kabutack 自身
  - 关键操作写入审计日志 `~/.dsh/kabutack/audit.log`
  - 所有 API 仅本机回环访问

---

## 🚀 快速开始

### 安装

需要已安装 DSH，默认 profile 为 `web`。在 DSH profile 目录执行：

```bash
cd ~/.dsh/profiles/web
bun add @dsh-external/kabutack
# 或 npm install @dsh-external/kabutack
```

不想 `cd` 也可以用 npm 直接指定目录：

```bash
npm install --prefix ~/.dsh/profiles/web @dsh-external/kabutack
```

> 包内 `postinstall` 会自动写入 `dsh.profile.bundles`，完成后**重启 DSH** 即可看到 **Kabutack**。

### 备用安装

本地仓库：

```bash
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File install.ps1
# macOS / Linux / Git Bash
./install.sh
```

远程一行（无需 Git）：

```bash
# Windows PowerShell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/SunQingyuan0/Kabutack/main/bootstrap.ps1 | iex"
# macOS / Linux / Git Bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/SunQingyuan0/Kabutack/main/bootstrap.sh)"
```

> 默认 profile 为 `web`，其他 profile 把 `web` 换成你的 profile 名。

### 手动安装（可选）

如果你熟悉 DSH profile 结构，也可以手动完成：

1. 将 `lib/`、`package.json` 与 `cordis.patch.yml` 复制到 `~/.dsh/kabutack`
2. 在 `~/.dsh/profiles/<profile>/node_modules/@dsh-external/` 下创建指向该目录的 junction/symlink
3. 在 profile 的 `package.json` 中：
   - `dependencies` 添加 `"@dsh-external/kabutack": "link:<path>"`
   - `dsh.profile.bundles` 添加 `"@dsh-external/kabutack"`
4. 重启 DSH

---

## 🎮 使用指南

1. 打开 DSH 设置 → **Kabutack**
2. 在 **能力目录** 中浏览插件 / Skill / MCP
3. 在 **角色** 中点击 **创建角色**
4. 在弹窗中命名角色、选择能力组合并保存
5. 点击 **激活** 即可一键切换到该角色

---

## 🧩 为什么选择 Kabutack？

- **一个界面管三类能力**：不再需要在插件设置、Skill 文件、MCP 配置之间来回切换。
- **角色即场景**：开发、写作、研究等场景可以保存为角色，随时一键切换。
- **无需重启**：角色切换通过 DSH 运行时动态装载/卸载，不打断当前工作流。
- **安全优先**：官方插件和自身受保护，危险操作有确认和审计日志。
- **本地优先**：所有数据保存在本地 `~/.dsh/kabutack/`，不依赖外部服务。
- **开箱即用**：仓库自带预构建 `lib/`，clone 后无需编译即可安装。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

---

## 📄 License

BSD-3-Clause
