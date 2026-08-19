export const MCP_MODULE = '@deepseek-ai/dsh-mcp-client';
export function listEntries(ctx) {
    if (!ctx?.loader?.entries)
        return [];
    return [...ctx.loader.entries()];
}
export function fiberPhaseOf(entry) {
    const state = entry.fiber?.state;
    if (state === undefined)
        return null;
    switch (state) {
        case 0: return 'pending';
        case 1: return 'loading';
        case 2: return 'active';
        case 3: return 'failed';
        case 5: return 'unloading';
        default: return null;
    }
}
export function isEnabled(entry) {
    return !(entry.disabled === true || entry.options.disabled === true);
}
export function findEntryByModuleName(ctx, moduleName) {
    return listEntries(ctx).find((e) => !e.options.group && e.options.name === moduleName);
}
export function findEntryByServerName(ctx, serverName) {
    return listEntries(ctx).find((e) => {
        if (e.options.group)
            return false;
        if (e.options.name !== MCP_MODULE)
            return false;
        return e.options.config?.serverName === serverName;
    });
}
export async function setPluginEnabled(ctx, entryId, enabled) {
    if (!ctx?.loader?.update)
        throw new Error('loader.update 不可用');
    await ctx.loader.update(entryId, { disabled: !enabled });
}
export async function createMcpEntry(ctx, def) {
    if (!ctx?.loader?.create)
        throw new Error('loader.create 不可用');
    return await ctx.loader.create({ name: MCP_MODULE, config: def });
}
export async function removeEntry(ctx, entryId) {
    if (!ctx?.loader?.remove)
        throw new Error('loader.remove 不可用');
    await ctx.loader.remove(entryId);
}
/** 是否为“可安全卸载/由角色自动启停”的插件。v1：仅 @dsh-external/* 中非关键插件。 */
export function isManagedPlugin(moduleName) {
    if (!moduleName)
        return false;
    if (!moduleName.startsWith('@dsh-external/'))
        return false;
    return !isProtectedPlugin(moduleName);
}
export function isProtectedPlugin(moduleName) {
    return (moduleName === '@galactus/kabutack' ||
        moduleName === '@dsh-external/dsh-super-injector' ||
        moduleName === '@dsh-external/dsh-mode-boost' ||
        moduleName.startsWith('@deepseek-ai/dsh-base') ||
        moduleName.startsWith('@deepseek-ai/dsh-web'));
}
//# sourceMappingURL=loader-ops.js.map