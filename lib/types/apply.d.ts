import type { ApplyPlan, ApplyResult, CatalogSnapshot, Role, RoleManagerStore } from './types.js';
export declare function buildPlan(role: Role, catalog: CatalogSnapshot, store: RoleManagerStore): ApplyPlan;
export declare function executePlan(ctx: any, plan: ApplyPlan, catalog: CatalogSnapshot, store: RoleManagerStore, save: (s: RoleManagerStore) => void): Promise<ApplyResult>;
