import { listEntries, fiberPhaseOf, isEnabled, isManagedPlugin, MCP_MODULE } from './loader-ops.js';
import { listMcps } from './mcp-ops.js';
import { listSkills } from './skills-ops.js';
export async function listCatalog(ctx) {
    const plugins = [];
    const entries = listEntries(ctx);
    for (const entry of entries) {
        if (entry.options.group)
            continue;
        if (entry.options.name === MCP_MODULE)
            continue;
        plugins.push({
            kind: 'plugin',
            entryId: entry.id,
            moduleName: entry.options.name,
            enabled: isEnabled(entry),
            fiberPhase: fiberPhaseOf(entry),
            managed: isManagedPlugin(entry.options.name),
        });
    }
    const mcps = listMcps(ctx);
    const skills = await listSkills(ctx);
    return {
        plugins,
        skills,
        mcps,
        capturedAt: Date.now(),
    };
}
//# sourceMappingURL=catalog.js.map