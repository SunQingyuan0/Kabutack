import type { McpDefinition, McpItem, RoleManagerStore } from './types.js';
export declare function validateMcpDefinition(def: McpDefinition): void;
export declare function toMcpItem(ctx: any, entry: any): McpItem | undefined;
export declare function listMcps(ctx: any): McpItem[];
export declare function findMcpEntries(ctx: any): any[];
export declare function addMcp(ctx: any, store: RoleManagerStore, def: McpDefinition, save: (s: RoleManagerStore) => void): Promise<McpItem>;
export declare function updateMcp(ctx: any, store: RoleManagerStore, serverName: string, patch: Partial<McpDefinition>, save: (s: RoleManagerStore) => void): Promise<McpItem>;
export declare function removeMcp(ctx: any, store: RoleManagerStore, serverName: string, save: (s: RoleManagerStore) => void): Promise<void>;
export declare function setMcpEnabled(ctx: any, serverName: string, enabled: boolean): Promise<void>;
