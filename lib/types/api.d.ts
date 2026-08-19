import type { RoleManagerService } from './service.js';
import type { Audit } from './audit.js';
export declare function registerKabutackApi(ctx: any, service: RoleManagerService, audit?: Audit): () => void;
