# Kabutack 推广物料

> 面向 DSH / DeepSeek Harness 社区的发布渠道与现成文案。
> 发布前请替换 `{你的链接}` 或按平台调整长度。

## 一句话定位

中文：Kabutack 是一个基于角色的 DSH 插件 / Skill / MCP 管理器，把能力打包成“角色”，一键切换你的 AI 工作台。

English：Kabutack is a role-based manager for DSH plugins / Skills / MCP. Bundle capabilities into roles and hot-switch your AI workbench.

## 已提交的收录 PR

- [Dominic789654/awesome-deepseek-harness #166](https://github.com/Dominic789654/awesome-deepseek-harness/pull/166)
- [0xsline/awesome-deepseek-harness #411](https://github.com/0xsline/awesome-deepseek-harness/pull/411)
- [beancookie/awesome-dsh-plugin #85](https://github.com/beancookie/awesome-dsh-plugin/pull/85)

## npm 发布

```bash
# 先确认已登录 npm
npm whoami

# 登录（如果未登录）
npm login

# 发布（package.json 已配置 public access）
npm publish
```

发布后检查：

```bash
npm view @galactus/kabutack
```

> 注意：`@dsh-external` scope 必须属于你的 npm 账号；如果无权发布，需要把包名改为你拥有的 scope（如 `@sunqingyuan0/kabutack`），并同步修改 README 安装命令。

## 英文帖子（X / Reddit / Dev.to）

> Title: I built a role-based manager for DSH plugins / Skills / MCP

Kabutack lets you group DSH plugins, Skills, and MCP servers into "roles" (dev, writing, research...), then hot-switch between them from the Web UI — no restarts, with rollback and audit logs.

- Unified catalog for plugins / Skills / MCP
- One-click role activation with diff-based load/unload
- Auto-restore last active role after DSH restart
- Local-first, audit logged, loopback-only API

Try it:
https://github.com/SunQingyuan0/Kabutack

If you use DeepSeek Harness and juggle many capabilities, a ⭐ would help a lot!

## V2EX / 中文社区帖子

> 标题：DSH 插件 / Skill / MCP 太多？我写了个“角色化”管理器 Kabutack

DeepSeek Harness 的生态越来越丰富，但插件、Skill、MCP 分散在不同入口，切换场景时要手动启停一堆能力。

Kabutack 做的事很简单：把能力组合定义成“角色”，比如“开发”“写作”“研究”，然后在 Web 设置页一键切换，自动做差异装载/卸载，失败自动回滚，重启后自动恢复上次角色。

特性：
- 统一浏览插件 / Skill / MCP，支持搜索和状态查看
- 创建角色时默认带上 DSH 自带插件和全部 Skill
- 角色切换幂等、失败回滚、审计日志
- 本地优先，数据在 `~/.dsh/kabutack/`

安装：
```bash
cd ~/.dsh/profiles/web
bun add @galactus/kabutack
# 或 npm install @galactus/kabutack
```

项目：https://github.com/SunQingyuan0/Kabutack
如果对你有用，欢迎点个 Star ⭐

## 掘金 / 知乎文章大纲

1. 问题：DSH 能力分散，场景切换成本高
2. Kabutack 是什么：插件 / Skill / MCP 统一管理 + 角色化装载
3. 核心设计：角色 = 能力组合；切换 = 差异装载/卸载
4. 安装与 30 秒上手
5. 安全与可观测：保护官方插件、审计日志、本机回环
6. 路线图 / 求反馈

## 发布检查清单

- [ ] npm 已发布，`npm view @galactus/kabutack` 可查
- [ ] GitHub Release v0.0.1 已创建
- [ ] Awesome PR 已提交（上面 3 个）
- [ ] X / Reddit / V2EX / 掘金各发一篇
- [ ] 在 DSH 相关 Discord / QQ / 微信群里分享并收集反馈
