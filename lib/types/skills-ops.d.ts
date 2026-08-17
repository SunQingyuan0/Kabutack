import type { SkillItem } from './types.js';
export declare function listSkills(ctx: any): Promise<SkillItem[]>;
export declare function skillRoots(): string[];
export declare function scanFileSkills(): SkillItem[];
export declare function getSkillPath(ctx: any, name: string): Promise<string | undefined>;
export declare function setSkillInvocation(ctx: any, name: string, opts: {
    modelInvocable?: boolean;
    userInvocable?: boolean;
}): Promise<{
    path?: string;
    modelInvocable?: boolean;
    userInvocable?: boolean;
}>;
export declare function removeSkill(ctx: any, name: string, trashDir?: string): Promise<string>;
/**
 * 极简 frontmatter 编辑器：只处理顶层 `key: value`，保留其余内容。
 * 用于修改 SKILL.md 的 disable-model-invocation / user-invocable。
 */
export declare function editFrontmatter(text: string, changes: Record<string, boolean | undefined>): string;
