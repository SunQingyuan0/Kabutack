import type { McpDefinition, PluginFiberPhase } from './types.js'

export const MCP_MODULE = '@deepseek-ai/dsh-mcp-client'

export interface LoaderEntryLike {
  id: string
  options: {
    name: string
    config?: any
    disabled?: boolean | null
    group?: boolean | null
  }
  disabled?: boolean
  fiber?: { state?: number } | undefined
}

export function listEntries(ctx: any): LoaderEntryLike[] {
  if (!ctx?.loader?.entries) return []
  return [...ctx.loader.entries()] as LoaderEntryLike[]
}

export function fiberPhaseOf(entry: LoaderEntryLike): PluginFiberPhase {
  const state = entry.fiber?.state
  if (state === undefined) return null
  switch (state) {
    case 0: return 'pending'
    case 1: return 'loading'
    case 2: return 'active'
    case 3: return 'failed'
    case 5: return 'unloading'
    default: return null
  }
}

export function isEnabled(entry: LoaderEntryLike): boolean {
  return !(entry.disabled === true || entry.options.disabled === true)
}

export function findEntryByModuleName(ctx: any, moduleName: string): LoaderEntryLike | undefined {
  return listEntries(ctx).find((e) => !e.options.group && e.options.name === moduleName)
}

export function findEntryByServerName(ctx: any, serverName: string): LoaderEntryLike | undefined {
  return listEntries(ctx).find((e) => {
    if (e.options.group) return false
    if (e.options.name !== MCP_MODULE) return false
    return e.options.config?.serverName === serverName
  })
}

export async function setPluginEnabled(ctx: any, entryId: string, enabled: boolean): Promise<void> {
  if (!ctx?.loader?.update) throw new Error('loader.update 不可用')
  await ctx.loader.update(entryId, { disabled: !enabled })
}

export async function createMcpEntry(ctx: any, def: McpDefinition): Promise<string> {
  if (!ctx?.loader?.create) throw new Error('loader.create 不可用')
  return await ctx.loader.create({ name: MCP_MODULE, config: def })
}

export async function removeEntry(ctx: any, entryId: string): Promise<void> {
  if (!ctx?.loader?.remove) throw new Error('loader.remove 不可用')
  await ctx.loader.remove(entryId)
}

/** 是否为“可安全卸载/由角色自动启停”的插件。v1：仅 @dsh-external/* 中非关键插件。 */
export function isManagedPlugin(moduleName: string): boolean {
  if (!moduleName) return false
  if (!moduleName.startsWith('@dsh-external/')) return false
  return !isProtectedPlugin(moduleName)
}

export function isProtectedPlugin(moduleName: string): boolean {
  return (
    moduleName === '@dsh-external/kabutack' ||
    moduleName === '@dsh-external/dsh-super-injector' ||
    moduleName === '@dsh-external/dsh-mode-boost' ||
    moduleName.startsWith('@deepseek-ai/dsh-base') ||
    moduleName.startsWith('@deepseek-ai/dsh-web')
  )
}
