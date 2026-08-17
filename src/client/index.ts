/**
 * @dsh-external/kabutack — client 设置页（settings.section slot）。
 * 构建：npm run build:client（tsdown，产物 lib/client.js，ModuleLoader.load 注册）。
 * 通信：同源 fetch → host webServer API（/kabutack/api）
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type SlotsService = any

type ClientContext = {
  slots: SlotsService
  effect: (fn: () => unknown, label?: string) => void
}

export const inject = ['slots']

declare const require: any
const React = require('react')

const API = '/kabutack/api'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function fetchJson(path: string, init?: RequestInit): Promise<any> {
  return fetch(API + path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  }).then((r) => r.json())
}

const styles = `
.kbt-page{font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;padding:14px 16px;max-width:860px}
.kbt-page h3{margin:0 0 8px;font-size:14px}
.kbt-page h4{margin:10px 0 6px;font-size:13px}
.kbt-tabs{display:flex;gap:6px;margin-bottom:10px}
.kbt-tab{background:transparent;border:1px solid var(--theme-border,#444);color:var(--theme-text,#ccc);border-radius:6px;padding:5px 12px;cursor:pointer}
.kbt-tab.active{background:var(--theme-accent,#4a9eff);color:#fff;border-color:transparent}
.kbt-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.kbt-input{background:var(--theme-input-bg,#111);color:var(--theme-text,#ddd);border:1px solid var(--theme-border,#333);border-radius:6px;padding:5px 8px;font-size:12px}
.kbt-btn{background:var(--theme-accent,#4a9eff);color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;white-space:nowrap}
.kbt-btn.ghost{background:transparent;border:1px solid var(--theme-border,#444);color:var(--theme-text,#ccc)}
.kbt-btn.danger{background:transparent;border:1px solid #d33;color:#d33}
.kbt-btn:disabled{opacity:.45;cursor:not-allowed}
.kbt-list{list-style:none;margin:0;padding:0}
.kbt-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--theme-border,#333);border-radius:8px;margin-bottom:6px;flex-wrap:wrap}
.kbt-item .name{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbt-item .desc{color:var(--theme-text-secondary,#888);font-size:11px;flex-basis:100%}
.kbt-item .st{font-size:10px;padding:2px 6px;border-radius:10px}
.kbt-item .st.on{background:rgba(46,204,113,.15);color:#2ecc71}
.kbt-item .st.off{background:rgba(255,193,7,.12);color:#f1c40f}
.kbt-item .st.warn{background:rgba(231,76,60,.15);color:#e74c3c}
.kbt-msg{margin-top:10px;padding:8px 10px;border-radius:6px;background:var(--theme-input-bg,#111);border:1px solid var(--theme-border,#333);white-space:pre-wrap;max-height:220px;overflow:auto;font-size:11px}
.kbt-role-card{border:1px solid var(--theme-border,#333);border-radius:8px;padding:10px;margin-bottom:8px}
.kbt-role-card.active{border-color:var(--theme-accent,#4a9eff)}
.kbt-editor{border:1px solid var(--theme-border,#333);border-radius:8px;padding:10px;margin-top:10px}
.kbt-check-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:4px 12px;max-height:220px;overflow:auto;padding:4px}
.kbt-check-grid label{display:flex;gap:6px;align-items:center;cursor:pointer}
`

function createKabutackPanel(): { element: HTMLElement; dispose: () => void } {
          const root = el('div', 'kbt-page')
          const style = el('style')
          style.textContent = styles
          root.append(style)

          const h = el('h3', undefined, 'Kabutack — 插件 / Skill / MCP 角色化管理')
          const stateLine = el('p', 'kbt-msg')
          stateLine.style.display = 'none'
          root.append(h, stateLine)

          const tabs = el('div', 'kbt-tabs')
          const tabCatalog = el('button', 'kbt-tab active', '能力目录')
          const tabRoles = el('button', 'kbt-tab', '角色')
          tabs.append(tabCatalog, tabRoles)
          root.append(tabs)

          const catalogPanel = el('div')
          const rolesPanel = el('div')
          rolesPanel.style.display = 'none'
          root.append(catalogPanel, rolesPanel)

          let catalog: any = { plugins: [], skills: [], mcps: [] }
          let roles: any[] = []
          let state: any = { activeRoleId: null }

          const say = (text: string, isErr = false): void => {
            stateLine.textContent = text
            stateLine.style.display = text ? 'block' : 'none'
            stateLine.style.borderColor = isErr ? '#d33' : 'var(--theme-border,#333)'
          }

          const api = async (path: string, init?: RequestInit): Promise<any> => {
            const r = await fetchJson(path, init)
            if (!r?.ok) throw new Error(r?.error || '请求失败')
            return r.data
          }

          // ── Catalog 渲染 ──
          const renderCatalog = (): void => {
            catalogPanel.textContent = ''
            const toolbar = el('div', 'kbt-toolbar')
            const search = el('input', 'kbt-input') as HTMLInputElement
            search.placeholder = '搜索名称…'
            const filter = el('select', 'kbt-input') as HTMLSelectElement
            for (const [value, label] of [['all', '全部'], ['plugin', '插件'], ['skill', 'Skill'], ['mcp', 'MCP']] as const) {
              const opt = el('option', undefined, label) as HTMLOptionElement
              opt.value = value
              filter.append(opt)
            }
            const refresh = el('button', 'kbt-btn ghost', '刷新')
            toolbar.append(search, filter, refresh)
            catalogPanel.append(toolbar)

            // MCP 添加表单
            const mcpForm = el('div', 'kbt-toolbar')
            const mcpServer = el('input', 'kbt-input') as HTMLInputElement
            mcpServer.placeholder = 'MCP serverName'
            const mcpTransport = el('select', 'kbt-input') as HTMLSelectElement
            for (const [value, label] of [['stdio', 'stdio'], ['streamable-http', 'streamable-http']] as const) {
              const opt = el('option', undefined, label) as HTMLOptionElement
              opt.value = value
              mcpTransport.append(opt)
            }
            const mcpCommand = el('input', 'kbt-input') as HTMLInputElement
            mcpCommand.placeholder = 'command (stdio)'
            const mcpUrl = el('input', 'kbt-input') as HTMLInputElement
            mcpUrl.placeholder = 'url (http)'
            const mcpArgs = el('input', 'kbt-input') as HTMLInputElement
            mcpArgs.placeholder = 'args，逗号分隔'
            const mcpAdd = el('button', 'kbt-btn', '添加 MCP')
            mcpAdd.addEventListener('click', () => {
              const serverName = mcpServer.value.trim()
              if (!serverName) return say('MCP serverName 必填', true)
              const transport = mcpTransport.value as 'stdio' | 'streamable-http'
              const body: any = { serverName, transport }
              if (transport === 'stdio') {
                if (!mcpCommand.value.trim()) return say('stdio 需要 command', true)
                body.command = mcpCommand.value.trim()
                body.args = mcpArgs.value.split(',').map((s) => s.trim()).filter(Boolean)
              } else {
                if (!mcpUrl.value.trim()) return say('streamable-http 需要 url', true)
                body.url = mcpUrl.value.trim()
              }
              mcpAdd.disabled = true
              api('/mcps', { method: 'POST', body: JSON.stringify(body) })
                .then(() => { mcpServer.value = mcpCommand.value = mcpUrl.value = mcpArgs.value = ''; return refreshData() })
                .catch((e) => say(String(e), true))
                .finally(() => { mcpAdd.disabled = false })
            })
            mcpForm.append(mcpServer, mcpTransport, mcpCommand, mcpUrl, mcpArgs, mcpAdd)
            catalogPanel.append(mcpForm)

            const list = el('ul', 'kbt-list')
            catalogPanel.append(list)

            const draw = (): void => {
              const q = search.value.trim().toLowerCase()
              const kind = filter.value
              list.textContent = ''
              const items: any[] = [
                ...catalog.plugins.map((p: any) => ({ ...p, type: 'plugin', title: p.moduleName, stateText: p.enabled ? '运行中' : '已停用', stateCls: p.enabled ? 'on' : 'off' })),
                ...catalog.skills.map((s: any) => ({ ...s, type: 'skill', title: s.name, stateText: (s.modelInvocable ? 'M' : '-') + '/' + (s.userInvocable ? 'U' : '-'), stateCls: s.modelInvocable || s.userInvocable ? 'on' : 'off' })),
                ...catalog.mcps.map((m: any) => ({ ...m, type: 'mcp', title: m.serverName, stateText: m.enabled ? '运行中' : '已停用', stateCls: m.enabled ? 'on' : 'off' })),
              ].filter((x) => (kind === 'all' || x.type === kind) && (!q || x.title.toLowerCase().includes(q)))

              if (!items.length) {
                list.append(el('li', 'kbt-item', '（无匹配项）'))
                return
              }

              for (const item of items) {
                const li = el('li', 'kbt-item')
                const name = el('span', 'name', item.title)
                const st = el('span', 'st ' + item.stateCls, item.stateText)
                li.append(name, st)

                if (item.type === 'plugin') {
                  const btnEnable = el('button', 'kbt-btn ghost', item.enabled ? '停用' : '启用')
                  btnEnable.addEventListener('click', () => {
                    btnEnable.disabled = true
                    api(`/capabilities/plugin/${encodeURIComponent(item.entryId)}/${item.enabled ? 'disable' : 'enable'}`, { method: 'POST' })
                      .then(() => refreshData())
                      .catch((e) => say(String(e), true))
                      .finally(() => { btnEnable.disabled = false })
                  })
                  li.append(btnEnable)
                  if (item.managed) {
                    const del = el('button', 'kbt-btn danger', '卸载')
                    del.addEventListener('click', () => {
                      if (!confirm('确认卸载插件 ' + item.moduleName + '？')) return
                      del.disabled = true
                      api(`/capabilities/plugin/${encodeURIComponent(item.moduleName)}`, { method: 'DELETE' })
                        .then(() => refreshData())
                        .catch((e) => say(String(e), true))
                        .finally(() => { del.disabled = false })
                    })
                    li.append(del)
                  }
                }

                if (item.type === 'mcp') {
                  const btnEnable = el('button', 'kbt-btn ghost', item.enabled ? '停用' : '启用')
                  btnEnable.addEventListener('click', () => {
                    btnEnable.disabled = true
                    api(`/capabilities/mcp/${encodeURIComponent(item.serverName)}/${item.enabled ? 'disable' : 'enable'}`, { method: 'POST' })
                      .then(() => refreshData())
                      .catch((e) => say(String(e), true))
                      .finally(() => { btnEnable.disabled = false })
                  })
                  li.append(btnEnable)
                  const del = el('button', 'kbt-btn danger', '卸载')
                  del.addEventListener('click', () => {
                    if (!confirm('确认卸载 MCP ' + item.serverName + '？')) return
                    del.disabled = true
                    api(`/capabilities/mcp/${encodeURIComponent(item.serverName)}`, { method: 'DELETE' })
                      .then(() => refreshData())
                      .catch((e) => say(String(e), true))
                      .finally(() => { del.disabled = false })
                  })
                  li.append(del)
                }

                if (item.type === 'skill') {
                  const btnEnable = el('button', 'kbt-btn ghost', (item.modelInvocable || item.userInvocable) ? '停用' : '启用')
                  btnEnable.addEventListener('click', () => {
                    btnEnable.disabled = true
                    const enabled = !(item.modelInvocable || item.userInvocable)
                    api(`/capabilities/skill/${encodeURIComponent(item.name)}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' })
                      .then(() => refreshData())
                      .catch((e) => say(String(e), true))
                      .finally(() => { btnEnable.disabled = false })
                  })
                  li.append(btnEnable)
                  if (item.managed) {
                    const del = el('button', 'kbt-btn danger', '卸载')
                    del.addEventListener('click', () => {
                      if (!confirm('确认卸载技能 ' + item.name + '？将移动到回收站。')) return
                      del.disabled = true
                      api(`/capabilities/skill/${encodeURIComponent(item.name)}`, { method: 'DELETE' })
                        .then(() => refreshData())
                        .catch((e) => say(String(e), true))
                        .finally(() => { del.disabled = false })
                    })
                    li.append(del)
                  }
                }

                if (item.desc) li.append(el('div', 'desc', item.desc))
                list.append(li)
              }
            }

            search.addEventListener('input', draw)
            filter.addEventListener('change', draw)
            refresh.addEventListener('click', refreshData)
            draw()
          }

          // ── Roles 渲染 ──
          const renderRoles = (): void => {
            rolesPanel.textContent = ''
            const toolbar = el('div', 'kbt-toolbar')
            const nameInput = el('input', 'kbt-input') as HTMLInputElement
            nameInput.placeholder = '新角色名称'
            const createBtn = el('button', 'kbt-btn', '创建角色')
            toolbar.append(nameInput, createBtn)
            rolesPanel.append(toolbar)

            const list = el('div')
            rolesPanel.append(list)

            const draw = (): void => {
              list.textContent = ''
              if (!roles.length) {
                list.append(el('p', 'kbt-msg', '（暂无角色）'))
                return
              }
              for (const role of roles) {
                const active = state.activeRoleId === role.id
                const card = el('div', 'kbt-role-card' + (active ? ' active' : ''))
                const head = el('div', 'kbt-toolbar')
                const name = el('span', 'name', role.name + (active ? '（当前）' : ''))
                head.append(name)
                const activate = el('button', 'kbt-btn' + (active ? ' ghost' : ''), active ? '已激活' : '激活')
                activate.disabled = active
                activate.addEventListener('click', () => {
                  activate.disabled = true
                  api(`/roles/${encodeURIComponent(role.id)}/activate`, { method: 'POST' })
                    .then(() => refreshData())
                    .catch((e) => say(String(e), true))
                    .finally(() => { activate.disabled = false })
                })
                const edit = el('button', 'kbt-btn ghost', '编辑')
                edit.addEventListener('click', () => openEditor(role.id))
                const del = el('button', 'kbt-btn danger', '删除')
                del.addEventListener('click', () => {
                  if (!confirm('确认删除角色 ' + role.name + '？')) return
                  del.disabled = true
                  api(`/roles/${encodeURIComponent(role.id)}`, { method: 'DELETE' })
                    .then(() => refreshData())
                    .catch((e) => say(String(e), true))
                    .finally(() => { del.disabled = false })
                })
                head.append(activate, edit, del)
                const desc = el('div', 'desc', `插件 ${role.plugins?.length ?? 0} · Skill ${role.skills?.length ?? 0} · MCP ${role.mcps?.length ?? 0}` + (role.description ? ' — ' + role.description : ''))
                card.append(head, desc)
                list.append(card)
              }
            }

            createBtn.addEventListener('click', () => {
              const name = nameInput.value.trim()
              if (!name) return say('请输入角色名称', true)
              createBtn.disabled = true
              api('/roles', { method: 'POST', body: JSON.stringify({ name }) })
                .then(() => { nameInput.value = ''; return refreshData() })
                .catch((e) => say(String(e), true))
                .finally(() => { createBtn.disabled = false })
            })

            draw()
          }

          // ── 角色编辑器 ──
          const openEditor = (roleId: string): void => {
            const role = roles.find((r) => r.id === roleId)
            if (!role) return
            const editor = el('div', 'kbt-editor')
            const h4 = el('h4', undefined, '编辑角色：' + role.name)
            const nameInput = el('input', 'kbt-input') as HTMLInputElement
            nameInput.value = role.name
            const descInput = el('input', 'kbt-input') as HTMLInputElement
            descInput.value = role.description || ''
            descInput.placeholder = '描述'

            const selectedPlugins = new Set(role.plugins || [])
            const selectedSkills = new Set(role.skills || [])
            const selectedMcps = new Set(role.mcps || [])

            const pluginGrid = el('div', 'kbt-check-grid')
            for (const p of catalog.plugins) {
              const label = el('label')
              const cb = el('input') as HTMLInputElement
              cb.type = 'checkbox'
              cb.checked = selectedPlugins.has(p.moduleName)
              cb.addEventListener('change', () => {
                if (cb.checked) selectedPlugins.add(p.moduleName)
                else selectedPlugins.delete(p.moduleName)
              })
              label.append(cb, document.createTextNode(p.moduleName))
              pluginGrid.append(label)
            }

            const skillGrid = el('div', 'kbt-check-grid')
            for (const s of catalog.skills) {
              const label = el('label')
              const cb = el('input') as HTMLInputElement
              cb.type = 'checkbox'
              cb.checked = selectedSkills.has(s.name)
              cb.addEventListener('change', () => {
                if (cb.checked) selectedSkills.add(s.name)
                else selectedSkills.delete(s.name)
              })
              label.append(cb, document.createTextNode(s.name))
              skillGrid.append(label)
            }

            const mcpGrid = el('div', 'kbt-check-grid')
            for (const m of catalog.mcps) {
              const label = el('label')
              const cb = el('input') as HTMLInputElement
              cb.type = 'checkbox'
              cb.checked = selectedMcps.has(m.serverName)
              cb.addEventListener('change', () => {
                if (cb.checked) selectedMcps.add(m.serverName)
                else selectedMcps.delete(m.serverName)
              })
              label.append(cb, document.createTextNode(m.serverName))
              mcpGrid.append(label)
            }

            const saveBtn = el('button', 'kbt-btn', '保存')
            const cancelBtn = el('button', 'kbt-btn ghost', '关闭')
            saveBtn.addEventListener('click', () => {
              saveBtn.disabled = true
              api(`/roles/${encodeURIComponent(roleId)}`, {
                method: 'PUT',
                body: JSON.stringify({
                  name: nameInput.value,
                  description: descInput.value,
                  plugins: [...selectedPlugins],
                  skills: [...selectedSkills],
                  mcps: [...selectedMcps],
                }),
              })
                .then(() => { editor.remove(); return refreshData() })
                .catch((e) => say(String(e), true))
                .finally(() => { saveBtn.disabled = false })
            })
            cancelBtn.addEventListener('click', () => editor.remove())

            editor.append(h4, nameInput, descInput)
            editor.append(el('h4', undefined, '插件'), pluginGrid)
            editor.append(el('h4', undefined, 'Skill'), skillGrid)
            editor.append(el('h4', undefined, 'MCP'), mcpGrid)
            editor.append(el('div', 'kbt-toolbar'), saveBtn, cancelBtn)
            rolesPanel.append(editor)
          }

          const refreshData = async (): Promise<void> => {
            try {
              const [c, r, s] = await Promise.all([
                api('/catalog'),
                api('/roles'),
                api('/state'),
              ])
              catalog = c
              roles = r
              state = s
              renderCatalog()
              renderRoles()
            } catch (e) {
              say(String(e), true)
            }
          }

          tabCatalog.addEventListener('click', () => {
            tabCatalog.classList.add('active')
            tabRoles.classList.remove('active')
            catalogPanel.style.display = ''
            rolesPanel.style.display = 'none'
          })
          tabRoles.addEventListener('click', () => {
            tabRoles.classList.add('active')
            tabCatalog.classList.remove('active')
            catalogPanel.style.display = 'none'
            rolesPanel.style.display = ''
          })

          refreshData()
          const timer = window.setInterval(() => { void refreshData() }, 30000)

          return {
            element: root,
            dispose: () => window.clearInterval(timer),
          }
}

function KabutackSection(): any {
  const ref = React.useRef(null)
  React.useEffect(() => {
    const panel = createKabutackPanel()
    if (ref.current) ref.current.appendChild(panel.element)
    return () => panel.dispose()
  }, [])
  return React.createElement('div', { ref })
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.slots.inject('settings.section', () =>
    ctx.slots.register({
      name: 'settings.section',
      id: '@dsh-external/kabutack',
      order: 60,
      label: () => 'Kabutack',
    }, KabutackSection),
  ), '@dsh-external/kabutack: settings page')
}
