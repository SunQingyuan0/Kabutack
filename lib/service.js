import { listCatalog } from './catalog.js';
import { createRole, deleteRole, duplicateRole, getRole, listRoles, setActiveRole, updateRole } from './roles.js';
import { buildPlan, executePlan } from './apply.js';
import { findEntryByModuleName, isManagedPlugin, isProtectedPlugin, listEntries, removeEntry, setPluginEnabled as setPluginEnabledOp } from './loader-ops.js';
import { addMcp as addMcpOp, removeMcp as removeMcpOp, setMcpEnabled as setMcpEnabledOp, updateMcp as updateMcpOp } from './mcp-ops.js';
import { removeSkill as removeSkillOp, setSkillInvocation as setSkillInvocationOp } from './skills-ops.js';
export function createRoleManagerService(services) {
    const { ctx } = services;
    const getStore = services.getStore;
    const save = services.save;
    const audit = services.audit;
    const removePluginByModuleName = async (moduleName) => {
        if (!isManagedPlugin(moduleName) || isProtectedPlugin(moduleName)) {
            throw new Error('forbidden: 该插件不可卸载');
        }
        const entry = findEntryByModuleName(ctx, moduleName);
        if (!entry)
            throw new Error('not-found: 插件不存在: ' + moduleName);
        await removeEntry(ctx, entry.id);
        const store = getStore();
        store.removedPlugins = store.removedPlugins || [];
        if (!store.removedPlugins.includes(moduleName))
            store.removedPlugins.push(moduleName);
        if (store.pluginOverrides)
            delete store.pluginOverrides[moduleName];
        save(store);
        audit.log('plugin.remove', { moduleName, entryId: entry.id });
    };
    const removeMcp = async (serverName) => {
        const store = getStore();
        await removeMcpOp(ctx, store, serverName, save);
        if (store.mcpOverrides)
            delete store.mcpOverrides[serverName];
        save(store);
        audit.log('mcp.remove', { serverName });
    };
    const removeManagedCapability = async (kind, id) => {
        if (kind === 'plugin') {
            await removePluginByModuleName(id);
        }
        else if (kind === 'mcp') {
            await removeMcp(id);
        }
        else {
            throw new Error('unsupported: 不支持的能力类型: ' + kind);
        }
    };
    return {
        async listCatalog() {
            return listCatalog(ctx);
        },
        getState() {
            const store = getStore();
            return { activeRoleId: store.activeRoleId, lastActivation: store.lastActivation };
        },
        listRoles() {
            return listRoles(getStore());
        },
        listRoleDetails() {
            return getStore().roles;
        },
        getRole(id) {
            return getRole(getStore(), id);
        },
        createRole(input) {
            const store = getStore();
            const role = createRole(store, input);
            save(store);
            audit.log('role.create', { id: role.id });
            return role;
        },
        updateRole(id, patch) {
            const store = getStore();
            const role = updateRole(store, id, patch);
            save(store);
            audit.log('role.update', { id });
            return role;
        },
        deleteRole(id) {
            const store = getStore();
            deleteRole(store, id);
            save(store);
            audit.log('role.delete', { id });
        },
        duplicateRole(id, newId) {
            const store = getStore();
            const role = duplicateRole(store, id, newId);
            save(store);
            audit.log('role.duplicate', { id, newId: role.id });
            return role;
        },
        async activateRole(id) {
            const store = getStore();
            const role = getRole(store, id);
            if (!role)
                throw new Error('not-found: 角色不存在: ' + id);
            const catalog = await listCatalog(ctx);
            const plan = buildPlan(role, catalog, store);
            const result = await executePlan(ctx, plan, catalog, store, save);
            if (result.ok) {
                setActiveRole(store, id);
                store.pluginOverrides = {};
                store.mcpOverrides = {};
                store.lastActivation = { roleId: id, at: Date.now(), result: 'ok' };
                save(store);
                audit.log('role.activate', { id, executed: result.executed });
            }
            else {
                store.lastActivation = { roleId: store.activeRoleId, at: Date.now(), result: 'failed', message: result.error };
                save(store);
                audit.log('role.activate.failed', { id, error: result.error, rolledBack: result.rolledBack });
            }
            return result;
        },
        deactivate() {
            const store = getStore();
            const previous = store.activeRoleId;
            setActiveRole(store, null);
            store.lastActivation = { roleId: null, at: Date.now(), result: 'ok' };
            save(store);
            audit.log('role.deactivate', { previous });
            return { previous };
        },
        async setPluginEnabled(entryId, enabled) {
            const entry = listEntries(ctx).find((e) => e.id === entryId);
            if (!entry)
                throw new Error('not-found: 插件 entry 不存在: ' + entryId);
            await setPluginEnabledOp(ctx, entryId, enabled);
            const store = getStore();
            store.pluginOverrides = store.pluginOverrides || {};
            store.pluginOverrides[entry.options.name] = enabled;
            save(store);
            audit.log('plugin.setEnabled', { entryId, moduleName: entry.options.name, enabled });
            return { entryId, moduleName: entry.options.name, enabled };
        },
        removePluginByModuleName,
        removeManagedCapability,
        async setMcpEnabled(serverName, enabled) {
            await setMcpEnabledOp(ctx, serverName, enabled);
            const store = getStore();
            store.mcpOverrides = store.mcpOverrides || {};
            store.mcpOverrides[serverName] = enabled;
            save(store);
            audit.log('mcp.setEnabled', { serverName, enabled });
        },
        async addMcp(def) {
            const store = getStore();
            const item = await addMcpOp(ctx, store, def, save);
            store.mcpOverrides = store.mcpOverrides || {};
            store.mcpOverrides[item.serverName] = true;
            save(store);
            audit.log('mcp.create', { serverName: item.serverName });
            return item;
        },
        async updateMcp(serverName, patch) {
            const store = getStore();
            const item = await updateMcpOp(ctx, store, serverName, patch, save);
            audit.log('mcp.update', { serverName });
            return item;
        },
        removeMcp,
        async setSkillInvocation(name, opts) {
            const result = await setSkillInvocationOp(ctx, name, opts);
            audit.log('skill.setInvocation', { name, opts });
            return result;
        },
        async removeSkill(name) {
            const trash = await removeSkillOp(ctx, name);
            audit.log('skill.remove', { name, trash });
            return trash;
        },
    };
}
//# sourceMappingURL=service.js.map