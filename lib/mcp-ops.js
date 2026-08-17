import { findEntryByServerName, createMcpEntry, removeEntry, setPluginEnabled, fiberPhaseOf, isEnabled } from './loader-ops.js';
const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
export function validateMcpDefinition(def) {
    if (!def?.serverName || !SERVER_NAME_RE.test(def.serverName)) {
        throw new Error('invalid-input: serverName 必须为 [A-Za-z0-9_-]{1,32}');
    }
    if (def.transport === 'stdio') {
        if (!def.command)
            throw new Error('invalid-input: stdio 传输需要 command');
    }
    else if (def.transport === 'streamable-http') {
        if (!def.url)
            throw new Error('invalid-input: streamable-http 传输需要 url');
    }
    else {
        throw new Error('invalid-input: transport 必须是 stdio 或 streamable-http');
    }
}
export function toMcpItem(ctx, entry) {
    const config = entry?.options?.config;
    if (!config?.serverName)
        return undefined;
    return {
        kind: 'mcp',
        entryId: entry.id,
        serverName: config.serverName,
        transport: config.transport,
        enabled: isEnabled(entry),
        fiberPhase: fiberPhaseOf(entry),
        config,
        managed: true,
    };
}
export function listMcps(ctx) {
    return findMcpEntries(ctx).map((e) => toMcpItem(ctx, e)).filter((x) => Boolean(x));
}
export function findMcpEntries(ctx) {
    if (!ctx?.loader?.entries)
        return [];
    return [...ctx.loader.entries()].filter((e) => !e.options.group && e.options.name === '@deepseek-ai/dsh-mcp-client');
}
export async function addMcp(ctx, store, def, save) {
    validateMcpDefinition(def);
    if (store.mcps.some((m) => m.serverName === def.serverName)) {
        throw new Error('conflict: MCP serverName 已存在: ' + def.serverName);
    }
    if (findEntryByServerName(ctx, def.serverName)) {
        throw new Error('conflict: Loader 中已存在 MCP: ' + def.serverName);
    }
    const entryId = await createMcpEntry(ctx, def);
    store.mcps.push(def);
    save(store);
    const entry = findEntryByServerName(ctx, def.serverName);
    return toMcpItem(ctx, entry ?? { id: entryId, options: { name: '@deepseek-ai/dsh-mcp-client', config: def } });
}
export async function updateMcp(ctx, store, serverName, patch, save) {
    const existing = store.mcps.find((m) => m.serverName === serverName);
    if (!existing)
        throw new Error('not-found: MCP 定义不存在: ' + serverName);
    const merged = { ...existing, ...patch, serverName };
    validateMcpDefinition(merged);
    const entry = findEntryByServerName(ctx, serverName);
    if (entry && ctx?.loader?.update) {
        await ctx.loader.update(entry.id, { config: merged });
    }
    Object.assign(existing, merged);
    save(store);
    const after = findEntryByServerName(ctx, serverName);
    return toMcpItem(ctx, after ?? { id: entry?.id ?? serverName, options: { name: '@deepseek-ai/dsh-mcp-client', config: merged } });
}
export async function removeMcp(ctx, store, serverName, save) {
    const entry = findEntryByServerName(ctx, serverName);
    if (entry)
        await removeEntry(ctx, entry.id);
    const idx = store.mcps.findIndex((m) => m.serverName === serverName);
    if (idx >= 0)
        store.mcps.splice(idx, 1);
    save(store);
}
export async function setMcpEnabled(ctx, serverName, enabled) {
    const entry = findEntryByServerName(ctx, serverName);
    if (!entry)
        throw new Error('not-found: MCP 不存在: ' + serverName);
    await setPluginEnabled(ctx, entry.id, enabled);
}
//# sourceMappingURL=mcp-ops.js.map