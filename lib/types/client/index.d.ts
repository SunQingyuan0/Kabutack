/**
 * @galactus/kabutack — client 设置页（settings.section slot）。
 * 构建：npm run build:client（scripts/build-client.mjs，产物 lib/client.js，ModuleLoader.load 注册）。
 * 通信：同源 fetch → host webServer API（/kabutack/api）
 */
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots';
type ClientContext = {
    slots: SlotsService;
};
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
