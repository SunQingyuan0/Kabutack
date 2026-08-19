/**
 * @galactus/kabutack — 统一管理 DSH 插件/Skill/MCP，支持角色化动态装载与切换。
 *
 * Host 侧：
 * - 读取/写入 ~/.dsh/kabutack/roles.json
 * - 提供 Catalog、角色 CRUD、能力启停、MCP 管理、角色激活
 * - 通过 ctx.webServer 暴露 /kabutack/api
 *
 * Client 侧见 src/client/index.ts（settings.section）。
 */
import type { Context } from 'cordis';
import z from 'schemastery';
export type { RoleManagerService, KabutackServices } from './service.js';
export declare const name = "@galactus/kabutack";
export declare const inject: string[];
export interface Config {
    dataDir: string;
    autoRestore: boolean;
    restoreDelayMs: number;
}
export declare const Config: z<Schemastery.ObjectS<{
    dataDir: z<string, string>;
    autoRestore: z<boolean, boolean>;
    restoreDelayMs: z<number, number>;
}>, Schemastery.ObjectT<{
    dataDir: z<string, string>;
    autoRestore: z<boolean, boolean>;
    restoreDelayMs: z<number, number>;
}>>;
type AppContext = Context & {
    loader: any;
    skills: any;
    webServer: any;
    logger: any;
};
export declare function apply(ctx: AppContext, config: Config): void;
