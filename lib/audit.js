import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
export function createAudit(dataDir) {
    const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
    const dir = dataDir || join(dshHome, 'kabutack');
    const file = join(dir, 'audit.log');
    return {
        log(action, detail, error) {
            try {
                mkdirSync(dir, { recursive: true });
                const line = JSON.stringify({
                    time: new Date().toISOString(),
                    action,
                    detail: detail ?? null,
                    error: error ? String(error) : undefined,
                });
                appendFileSync(file, line + '\n', 'utf8');
            }
            catch {
                // 审计失败不能影响主流程
            }
        },
    };
}
//# sourceMappingURL=audit.js.map