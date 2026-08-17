import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { homedir } from 'node:os'
import type { SkillItem } from './types.js'

export async function listSkills(ctx: any): Promise<SkillItem[]> {
  // 优先使用文件系统扫描：ctx.skills 是 scope 感知的，Host 全局上下文可能看不到 agent preset 层技能。
  const fileSkills = scanFileSkills()
  if (fileSkills.length > 0) return fileSkills

  // 回退：如果文件系统扫描为空，尝试 ctx.skills（运行时/第三方 provider 技能）
  if (!ctx?.skills?.list) return []
  const list = await ctx.skills.list({ cwd: process.cwd() })
  return (Array.isArray(list) ? list : []).map((s: any) => ({
    kind: 'skill' as const,
    name: s.name,
    description: s.description || '',
    provider: s.provider || '',
    source: s.source || '',
    modelInvocable: s.invocation?.modelInvocable !== false,
    userInvocable: s.invocation?.userInvocable !== false,
    path: s.path,
    managed: Boolean(s.path) || s.provider === 'filesystem',
  }))
}

export function skillRoots(): string[] {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  const agentsHome = process.env.DSH_AGENTS_HOME || join(homedir(), '.agents')
  const cwd = process.cwd()
  const roots = [
    join(dshHome, 'skills'),
    join(agentsHome, 'skills'),
    join(cwd, '.dsh', 'skills'),
    join(cwd, '.agents', 'skills'),
  ]
  return roots
}

export function scanFileSkills(): SkillItem[] {
  const map = new Map<string, SkillItem>()
  for (const root of skillRoots()) {
    if (!existsSync(root)) continue
    let names: string[] = []
    try {
      names = readdirSync(root)
    } catch {
      continue
    }
    for (const name of names) {
      const full = join(root, name)
      let skillPath: string | undefined
      try {
        const st = statSync(full)
        if (st.isDirectory()) {
          const md = join(full, 'SKILL.md')
          if (existsSync(md)) skillPath = md
        } else if (extname(name).toLowerCase() === '.md') {
          skillPath = full
        }
      } catch {
        continue
      }
      if (!skillPath) continue
      const item = parseSkillFile(skillPath)
      if (!item) continue
      if (!map.has(item.name)) map.set(item.name, item)
    }
  }
  return [...map.values()]
}

function parseSkillFile(path: string): SkillItem | undefined {
  try {
    const text = readFileSync(path, 'utf8')
    const fm = parseFrontmatter(text)
    const fallbackName = basename(path, extname(path)).toLowerCase().replace(/\s+/g, '-')
    const name = String(fm.name || fallbackName)
    if (!name) return undefined
    const modelInvocable = fm['disable-model-invocation'] !== true
    const userInvocable = fm['user-invocable'] !== false
    return {
      kind: 'skill',
      name,
      description: String(fm.description || ''),
      provider: 'filesystem',
      source: 'user-dsh',
      modelInvocable,
      userInvocable,
      path,
      managed: true,
    }
  } catch {
    return undefined
  }
}

function parseFrontmatter(text: string): Record<string, any> {
  const result: Record<string, any> = {}
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return result
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '---') break
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!match) continue
    const key = match[1]
    const raw = match[2].trim()
    if (raw === 'true') result[key] = true
    else if (raw === 'false') result[key] = false
    else result[key] = raw
  }
  return result
}

export async function getSkillPath(ctx: any, name: string): Promise<string | undefined> {
  const fileItem = scanFileSkills().find((s) => s.name === name)
  if (fileItem?.path) return fileItem.path
  if (!ctx?.skills?.get) return undefined
  const skill = await ctx.skills.get(name, { cwd: process.cwd() })
  return skill?.path
}

export async function setSkillInvocation(ctx: any, name: string, opts: { modelInvocable?: boolean; userInvocable?: boolean }): Promise<{ path?: string; modelInvocable?: boolean; userInvocable?: boolean }> {
  const path = await getSkillPath(ctx, name)
  if (!path) {
    throw new Error('unsupported: 技能不是文件系统技能，无法持久化修改 invocation: ' + name)
  }
  const text = readFileSync(path, 'utf8')
  const next = editFrontmatter(text, {
    'disable-model-invocation': opts.modelInvocable === false ? true : undefined,
    'user-invocable': opts.userInvocable === false ? false : undefined,
  })
  writeFileSync(path, next, 'utf8')
  return {
    path,
    modelInvocable: opts.modelInvocable,
    userInvocable: opts.userInvocable,
  }
}

export async function removeSkill(ctx: any, name: string, trashDir?: string): Promise<string> {
  const path = await getSkillPath(ctx, name)
  if (!path) {
    throw new Error('unsupported: 技能不是文件系统技能，无法卸载: ' + name)
  }
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  const trash = trashDir || join(dshHome, 'kabutack', 'trash')
  mkdirSync(trash, { recursive: true })
  const target = join(trash, basename(path) + '.' + Date.now())
  renameSync(path, target)
  return target
}

/**
 * 极简 frontmatter 编辑器：只处理顶层 `key: value`，保留其余内容。
 * 用于修改 SKILL.md 的 disable-model-invocation / user-invocable。
 */
export function editFrontmatter(text: string, changes: Record<string, boolean | undefined>): string {
  const lines = text.split(/\r?\n/)
  let inFront = false
  let frontEnd = -1
  if (lines[0]?.trim() === '---') {
    inFront = true
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        frontEnd = i
        break
      }
    }
  }

  if (!inFront || frontEnd < 0) {
    // 没有 frontmatter：为受管字段新建一个
    const head: string[] = ['---']
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) head.push(`${key}: ${value}`)
    }
    head.push('---', '')
    return head.join('\n') + text
  }

  const body = lines.slice(0, frontEnd + 1)
  const known = new Set(Object.keys(changes))
  let inserted = false

  for (let i = 1; i < frontEnd; i++) {
    const line = lines[i]
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!match) continue
    const key = match[1]
    if (!known.has(key)) continue
    const newValue = changes[key]
    if (newValue === undefined) {
      // 移除该行（启用时清除 disable-model-invocation）
      body[i] = ''
      inserted = true
    } else {
      body[i] = `${key}: ${newValue}`
      inserted = true
    }
  }

  if (!inserted) {
    const insertAt = frontEnd
    const add: string[] = []
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) add.push(`${key}: ${value}`)
    }
    body.splice(insertAt, 0, ...add)
  }

  return body.join('\n') + '\n' + lines.slice(frontEnd + 1).join('\n')
}
