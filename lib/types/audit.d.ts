export declare function createAudit(dataDir?: string): {
    log(action: string, detail?: unknown, error?: unknown): void;
};
export type Audit = ReturnType<typeof createAudit>;
