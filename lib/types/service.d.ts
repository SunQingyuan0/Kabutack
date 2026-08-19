import type { ApplyResult, CatalogSnapshot, CreateRoleInput, McpDefinition, McpItem, Role, RoleManagerStore, RoleSummary, UpdateRoleInput } from './types.js';
import type { Audit } from './audit.js';
export interface KabutackServices {
    ctx: any;
    getStore(): RoleManagerStore;
    save(store: RoleManagerStore): void;
    audit: Audit;
}
export interface RoleManagerService {
    listCatalog(): Promise<CatalogSnapshot>;
    getState(): {
        activeRoleId: string | null;
        lastActivation?: RoleManagerStore['lastActivation'];
    };
    listRoles(): RoleSummary[];
    listRoleDetails(): Role[];
    getRole(id: string): Role | undefined;
    createRole(input: CreateRoleInput): Role;
    updateRole(id: string, patch: UpdateRoleInput): Role;
    deleteRole(id: string): void;
    duplicateRole(id: string, newId?: string): Role;
    activateRole(id: string): Promise<ApplyResult>;
    deactivate(): {
        previous: string | null;
    };
    setPluginEnabled(entryId: string, enabled: boolean): Promise<{
        entryId: string;
        moduleName: string;
        enabled: boolean;
    }>;
    removePluginByModuleName(moduleName: string): Promise<void>;
    removeManagedCapability(kind: 'plugin' | 'mcp', id: string): Promise<void>;
    setMcpEnabled(serverName: string, enabled: boolean): Promise<void>;
    addMcp(def: McpDefinition): Promise<McpItem>;
    updateMcp(serverName: string, patch: Partial<McpDefinition>): Promise<McpItem>;
    removeMcp(serverName: string): Promise<void>;
    setSkillInvocation(name: string, opts: {
        modelInvocable?: boolean;
        userInvocable?: boolean;
    }): Promise<{
        path?: string;
        modelInvocable?: boolean;
        userInvocable?: boolean;
    }>;
    removeSkill(name: string): Promise<string>;
}
export declare function createRoleManagerService(services: KabutackServices): RoleManagerService;
