import type { ApplyPlan, ApplyResult, CatalogSnapshot, McpDefinition, Role, RoleManagerStore } from './types.js'
import { createMcpEntry, removeEntry, setPluginEnabled } from './loader-ops.js'
import { setSkillInvocation } from './skills-ops.js'

export function buildPlan(role: Role, catalog: CatalogSnapshot, store: RoleManagerStore): ApplyPlan {
  const warnings: string[] = []
  const plan: ApplyPlan = {
    roleId: role.id,
    enablePlugins: [],
    disablePlugins: [],
    enableMcps: [],
    createMcps: [],
    updateMcps: [],
    removeMcps: [],
    enableSkills: [],
    disableSkills: [],
    warnings,
  }

  // 插件
  for (const moduleName of role.plugins) {
    const item = catalog.plugins.find((p) => p.moduleName === moduleName)
    if (!item) {
      warnings.push('插件未安装: ' + moduleName)
    } else if (!item.enabled) {
      plan.enablePlugins.push({ entryId: item.entryId, moduleName })
    }
  }
  for (const item of catalog.plugins) {
    if (item.managed && item.enabled && !role.plugins.includes(item.moduleName)) {
      plan.disablePlugins.push({ entryId: item.entryId, moduleName: item.moduleName })
    }
  }

  // MCP
  for (const serverName of role.mcps) {
    const item = catalog.mcps.find((m) => m.serverName === serverName)
    if (!item) {
      const def = store.mcps.find((m) => m.serverName === serverName)
      if (!def) {
        warnings.push('MCP 定义缺失: ' + serverName)
      } else {
        plan.createMcps.push(def)
      }
    } else if (!item.enabled) {
      plan.enableMcps.push({ entryId: item.entryId, serverName: item.serverName })
    }
  }
  for (const item of catalog.mcps) {
    const managedByStore = store.mcps.some((m) => m.serverName === item.serverName)
    if (item.managed && managedByStore && !role.mcps.includes(item.serverName)) {
      plan.removeMcps.push({ entryId: item.entryId, serverName: item.serverName })
    }
  }

  // 技能
  for (const name of role.skills) {
    const item = catalog.skills.find((s) => s.name === name)
    if (!item) {
      warnings.push('技能未找到: ' + name)
    } else if (item.path && (!item.modelInvocable || !item.userInvocable)) {
      plan.enableSkills.push({ name, path: item.path })
    } else if (!item.path) {
      warnings.push('技能不是文件系统技能，角色切换无法持久化启用: ' + name)
    }
  }
  if (role.skills.length > 0) {
    for (const item of catalog.skills) {
      if (item.managed && item.path && !role.skills.includes(item.name) && (item.modelInvocable || item.userInvocable)) {
        plan.disableSkills.push({ name: item.name, path: item.path })
      }
    }
  } else {
    warnings.push('角色未配置技能，跳过技能停用，避免误禁用全部技能')
  }

  return plan
}

export async function executePlan(
  ctx: any,
  plan: ApplyPlan,
  catalog: CatalogSnapshot,
  store: RoleManagerStore,
  save: (s: RoleManagerStore) => void,
): Promise<ApplyResult> {
  const executed: string[] = []
  const rolledBack: string[] = []
  const undoStack: Array<() => Promise<void>> = []

  const run = async (label: string, action: () => Promise<void>, undo: () => Promise<void>) => {
    try {
      await action()
      executed.push(label)
      undoStack.push(undo)
    } catch (err) {
      // 回滚
      for (let i = undoStack.length - 1; i >= 0; i--) {
        try {
          await undoStack[i]()
          rolledBack.push('rollback:' + executed[i])
        } catch (rollbackErr) {
          // 回滚失败也继续
        }
      }
      throw err
    }
  }

  try {
    // 1. 启用插件
    for (const item of plan.enablePlugins) {
      if (item.moduleName === '@deepseek-ai/dsh-mcp-client') continue
      await run(
        'enable-plugin:' + item.moduleName,
        () => setPluginEnabled(ctx, item.entryId, true),
        () => setPluginEnabled(ctx, item.entryId, false),
      )
    }

    // 2. 停用插件
    for (const item of plan.disablePlugins) {
      await run(
        'disable-plugin:' + item.moduleName,
        () => setPluginEnabled(ctx, item.entryId, false),
        () => setPluginEnabled(ctx, item.entryId, true),
      )
    }

    // 2.5 启用已有 MCP
    for (const item of plan.enableMcps) {
      await run(
        'enable-mcp:' + item.serverName,
        () => setPluginEnabled(ctx, item.entryId, true),
        () => setPluginEnabled(ctx, item.entryId, false),
      )
    }

    // 3. 创建 MCP
    for (const def of plan.createMcps) {
      await run(
        'create-mcp:' + def.serverName,
        async () => {
          const id = await createMcpEntry(ctx, def)
          store.mcps.push(def)
          save(store)
        },
        async () => {
          // 回滚：按 serverName 查找并移除（若已创建）
          const entries = [...(ctx.loader?.entries?.() ?? [])] as any[]
          const target = entries.find((e: any) => !e.options.group && e.options.name === '@deepseek-ai/dsh-mcp-client' && e.options.config?.serverName === def.serverName)
          if (target) await removeEntry(ctx, target.id)
          const idx = store.mcps.findIndex((m) => m.serverName === def.serverName)
          if (idx >= 0) store.mcps.splice(idx, 1)
          save(store)
        },
      )
    }

    // 4. 移除 MCP
    for (const item of plan.removeMcps) {
      const def = store.mcps.find((m) => m.serverName === item.serverName)
      await run(
        'remove-mcp:' + item.serverName,
        async () => {
          await removeEntry(ctx, item.entryId)
          const idx = store.mcps.findIndex((m) => m.serverName === item.serverName)
          if (idx >= 0) store.mcps.splice(idx, 1)
          save(store)
        },
        async () => {
          if (def) {
            const id = await createMcpEntry(ctx, def)
            store.mcps.push(def)
            save(store)
            void id
          }
        },
      )
    }

    // 5. 启用技能（文件系统）
    for (const item of plan.enableSkills) {
      const prev = catalog.skills.find((s) => s.name === item.name)
      await run(
        'enable-skill:' + item.name,
        async () => { await setSkillInvocation(ctx, item.name, { modelInvocable: true, userInvocable: true }) },
        async () => { await setSkillInvocation(ctx, item.name, {
          modelInvocable: prev?.modelInvocable ?? true,
          userInvocable: prev?.userInvocable ?? true,
        }) },
      )
    }

    // 6. 停用技能（文件系统）
    for (const item of plan.disableSkills) {
      const prev = catalog.skills.find((s) => s.name === item.name)
      await run(
        'disable-skill:' + item.name,
        async () => { await setSkillInvocation(ctx, item.name, { modelInvocable: false, userInvocable: false }) },
        async () => { await setSkillInvocation(ctx, item.name, {
          modelInvocable: prev?.modelInvocable ?? true,
          userInvocable: prev?.userInvocable ?? true,
        }) },
      )
    }

    return { ok: true, plan, executed, rolledBack: rolledBack.length ? rolledBack : undefined }
  } catch (err: any) {
    return {
      ok: false,
      plan,
      executed,
      rolledBack: rolledBack.length ? rolledBack : undefined,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
