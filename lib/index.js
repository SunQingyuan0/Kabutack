import z from 'schemastery';
import { createAudit } from './audit.js';
import { defaultDataDir, loadStore, saveStore, getRole } from './roles.js';
import { listCatalog } from './catalog.js';
import { buildPlan, executePlan } from './apply.js';
import { registerKabutackApi } from './api.js';
import { createMcpEntry, findEntryByModuleName, findEntryByServerName, isEnabled, removeEntry, setPluginEnabled } from './loader-ops.js';
export const name = '@dsh-external/kabutack';
export const inject = ['loader', 'skills', 'webServer'];
export const Config = z.object({
    dataDir: z.string().default(''),
    autoRestore: z.boolean().default(true),
    restoreDelayMs: z.number().min(0).default(1500),
});
export function apply(ctx, config) {
    const dataDir = config.dataDir || defaultDataDir();
    const audit = createAudit(dataDir);
    let store = loadStore(dataDir);
    const save = (next) => {
        store = next;
        saveStore(store, dataDir);
    };
    const services = {
        ctx,
        getStore: () => store,
        save,
        audit,
    };
    // HTTP API
    ctx.effect(() => registerKabutackApi(services));
    // 重启恢复：先应用持久化的启停/卸载覆盖，再自动激活上次角色
    const applyPersistedState = async () => {
        try {
            for (const moduleName of store.removedPlugins || []) {
                const entry = findEntryByModuleName(ctx, moduleName);
                if (entry) {
                    await removeEntry(ctx, entry.id);
                    audit.log('restore.removePlugin', { moduleName });
                }
            }
            for (const [moduleName, enabled] of Object.entries(store.pluginOverrides || {})) {
                const entry = findEntryByModuleName(ctx, moduleName);
                if (entry && isEnabled(entry) !== enabled) {
                    await setPluginEnabled(ctx, entry.id, enabled);
                    audit.log('restore.pluginOverride', { moduleName, enabled });
                }
            }
            // 恢复 Kabutack 管理的 MCP 定义（即使没有角色引用也会重建）
            for (const def of store.mcps || []) {
                const entry = findEntryByServerName(ctx, def.serverName);
                if (!entry) {
                    await createMcpEntry(ctx, def);
                    audit.log('restore.createMcp', { serverName: def.serverName });
                }
            }
            for (const [serverName, enabled] of Object.entries(store.mcpOverrides || {})) {
                const entry = findEntryByServerName(ctx, serverName);
                if (entry && isEnabled(entry) !== enabled) {
                    await setPluginEnabled(ctx, entry.id, enabled);
                    audit.log('restore.mcpOverride', { serverName, enabled });
                }
            }
        }
        catch (err) {
            audit.log('restore.overrideError', { error: String(err) });
        }
    };
    void applyPersistedState();
    // 启动恢复：自动激活上次角色（失败只记录，不阻塞）
    if (config.autoRestore && store.activeRoleId) {
        const roleId = store.activeRoleId;
        setTimeout(() => {
            void (async () => {
                try {
                    const role = getRole(store, roleId);
                    if (!role)
                        return;
                    const catalog = await listCatalog(ctx);
                    const plan = buildPlan(role, catalog, store);
                    const result = await executePlan(ctx, plan, catalog, store, save);
                    if (result.ok) {
                        store.pluginOverrides = {};
                        store.mcpOverrides = {};
                        store.lastActivation = { roleId, at: Date.now(), result: 'ok' };
                        save(store);
                        audit.log('restore.ok', { roleId });
                    }
                    else {
                        store.lastActivation = { roleId, at: Date.now(), result: 'failed', message: result.error };
                        save(store);
                        audit.log('restore.failed', { roleId, error: result.error });
                    }
                }
                catch (err) {
                    audit.log('restore.error', { roleId, error: String(err) });
                }
            })().catch(() => undefined);
        }, config.restoreDelayMs);
    }
    ctx.logger?.info?.('[kabutack] 已启动，dataDir=%s', dataDir);
}
//# sourceMappingURL=index.js.map