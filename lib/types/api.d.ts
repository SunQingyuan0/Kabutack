import type { RoleManagerStore } from './types.js';
import type { Audit } from './audit.js';
export interface KabutackServices {
    ctx: any;
    getStore(): RoleManagerStore;
    save(store: RoleManagerStore): void;
    audit: Audit;
}
export declare function registerKabutackApi(services: KabutackServices): () => void;
