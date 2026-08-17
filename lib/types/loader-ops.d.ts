import type { McpDefinition, PluginFiberPhase } from './types.js';
export declare const MCP_MODULE = "@deepseek-ai/dsh-mcp-client";
export interface LoaderEntryLike {
    id: string;
    options: {
        name: string;
        config?: any;
        disabled?: boolean | null;
        group?: boolean | null;
    };
    disabled?: boolean;
    fiber?: {
        state?: number;
    } | undefined;
}
export declare function listEntries(ctx: any): LoaderEntryLike[];
export declare function fiberPhaseOf(entry: LoaderEntryLike): PluginFiberPhase;
export declare function isEnabled(entry: LoaderEntryLike): boolean;
export declare function findEntryByModuleName(ctx: any, moduleName: string): LoaderEntryLike | undefined;
export declare function findEntryByServerName(ctx: any, serverName: string): LoaderEntryLike | undefined;
export declare function setPluginEnabled(ctx: any, entryId: string, enabled: boolean): Promise<void>;
export declare function createMcpEntry(ctx: any, def: McpDefinition): Promise<string>;
export declare function removeEntry(ctx: any, entryId: string): Promise<void>;
/** 是否为“可安全卸载/由角色自动启停”的插件。v1：仅 @dsh-external/* 中非关键插件。 */
export declare function isManagedPlugin(moduleName: string): boolean;
export declare function isProtectedPlugin(moduleName: string): boolean;
