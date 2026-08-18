/**
 * @dsh-external/kabutack — client 设置页（settings.section slot）。
 * 构建：npm run build:client（scripts/build-client.mjs，产物 lib/client.js，ModuleLoader.load 注册）。
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
.kbt-page{font-family:inherit;color:var(--dsw-alias-label-primary);max-width:760px;display:flex;flex-direction:column;gap:12px;padding:2px 4px 20px}
.kbt-page h3{margin:0;font-size:18px;font-weight:600;line-height:1.4}
.kbt-page h4{margin:0 0 6px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.kbt-intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:1.5}
.kbt-tabs{border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:flex-end;gap:22px;margin-top:2px}
.kbt-tab{color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;background:transparent;border:0;padding:7px 1px 9px;position:relative}
.kbt-tab:hover,.kbt-tab.active{color:var(--dsw-alias-label-primary)}
.kbt-tab.active::after{background:var(--dsw-alias-label-primary);content:"";border-radius:2px 2px 0 0;height:2px;position:absolute;bottom:-1px;left:0;right:0}
.kbt-tab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;color:var(--dsw-alias-label-primary);border-radius:2px}
.kbt-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.kbt-input{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 10px;font:inherit;font-size:13px;line-height:1.5}
.kbt-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.kbt-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.kbt-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);white-space:nowrap}
.kbt-btn.ghost{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:transparent}
.kbt-btn.ghost:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}
.kbt-btn.danger{border-color:var(--dsw-alias-state-danger-border, #d33);color:var(--dsw-alias-label-error, #e74c3c);background:transparent}
.kbt-btn:disabled{opacity:.4;cursor:default}
.kbt-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.kbt-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.kbt-item{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;display:flex;align-items:center;gap:8px;padding:10px 14px;flex-wrap:wrap}
.kbt-item:hover{border-color:var(--dsw-alias-label-dimmed)}
.kbt-item .name{flex:1;font-weight:600;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbt-item .desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;flex-basis:100%;margin:2px 0 0}
.kbt-item .st{font-size:11px;font-weight:500;line-height:17px;padding:1px 8px;border-radius:999px;white-space:nowrap}
.kbt-item .st.on{background:var(--dsw-alias-bg-success, rgba(46,204,113,.15));color:var(--dsw-alias-label-success, #2ecc71)}
.kbt-item .st.off{background:var(--dsw-alias-bg-warning, rgba(255,193,7,.12));color:var(--dsw-alias-label-warning, #f1c40f)}
.kbt-item .st.warn{background:var(--dsw-alias-bg-error, rgba(231,76,60,.15));color:var(--dsw-alias-label-error, #e74c3c)}
.kbt-msg{margin:0;padding:8px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);white-space:pre-wrap;max-height:220px;overflow:auto;font-size:12px;line-height:1.5}
.kbt-role-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.kbt-role-card:hover{border-color:var(--dsw-alias-label-dimmed)}
.kbt-role-card.active{border-color:var(--dsw-alias-label-primary)}
.kbt-editor{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px}
.kbt-check-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px 12px;max-height:240px;overflow:auto;padding:4px 2px}
.kbt-check-grid label{display:flex;gap:6px;align-items:center;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:13px}
.kbt-section-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin:14px 0 6px}
.kbt-modal-overlay{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);display:flex;align-items:center;justify-content:center;z-index:1000}
.kbt-modal{background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv3);border-radius:16px;width:640px;max-width:calc(100vw - 32px);max-height:calc(100vh - 48px);display:flex;flex-direction:column;overflow:hidden}
.kbt-modal-header{padding:16px 20px 8px;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary)}
.kbt-modal-body{padding:8px 20px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.kbt-modal-footer{padding:12px 20px;border-top:1px solid var(--dsw-alias-border-l2);display:flex;justify-content:flex-end;gap:8px}
`

function createKabutackPanel(): { element: HTMLElement; dispose: () => void } {
          const root = el('div', 'kbt-page')
          const style = el('style')
          style.textContent = styles
          root.append(style)

          const h = el('h3', undefined, 'Kabutack')
          const intro = el('p', 'kbt-intro', '统一管理 DSH 插件 / Skill / MCP，按角色动态装载与切换。')
          const stateLine = el('p', 'kbt-msg')
          stateLine.style.display = 'none'
          root.append(h, intro, stateLine)

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
            search.placeholder = '搜索当前分类…'
            const refresh = el('button', 'kbt-btn ghost', '刷新')
            toolbar.append(search, refresh)
            catalogPanel.append(toolbar)

            // 分类分页
            const kindTabs = el('div', 'kbt-tabs')
            let currentKind: 'plugin' | 'skill' | 'mcp' = 'plugin'
            const kindButtons: HTMLButtonElement[] = []
            const kinds: Array<['plugin' | 'skill' | 'mcp', string]> = [['plugin', '插件'], ['skill', 'Skill'], ['mcp', 'MCP']]
            for (const [value, label] of kinds) {
              const btn = el('button', 'kbt-tab' + (value === currentKind ? ' active' : ''), label)
              btn.addEventListener('click', () => {
                currentKind = value
                for (const b of kindButtons) b.classList.toggle('active', b === btn)
                draw()
              })
              kindButtons.push(btn)
              kindTabs.append(btn)
            }
            catalogPanel.append(kindTabs)

            const draw = (): void => {
              for (const node of Array.from(catalogPanel.querySelectorAll('.kbt-section'))) node.remove()
              const q = search.value.trim().toLowerCase()
              const matches = (title: string): boolean => !q || title.toLowerCase().includes(q)

              const renderItems = (items: any[], kind: string): HTMLUListElement => {
                const list = el('ul', 'kbt-list')
                if (!items.length) {
                  list.append(el('li', 'kbt-item', '（无匹配项）'))
                  return list
                }
                for (const item of items) {
                  const li = el('li', 'kbt-item')
                  const name = el('span', 'name', item.title)
                  const st = el('span', 'st ' + item.stateCls, item.stateText)
                  li.append(name, st)

                  if (kind === 'plugin') {
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

                  if (kind === 'mcp') {
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

                  if (kind === 'skill') {
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
                return list
              }

              const section = el('div', 'kbt-section')
              if (currentKind === 'plugin') {
                const items = catalog.plugins
                  .map((p: any) => ({ ...p, title: p.moduleName, stateText: p.enabled ? '运行中' : '已停用', stateCls: p.enabled ? 'on' : 'off' }))
                  .filter((x: any) => matches(x.title))
                section.append(renderItems(items, 'plugin'))
              } else if (currentKind === 'skill') {
                const items = catalog.skills
                  .map((s: any) => ({ ...s, title: s.name, stateText: (s.modelInvocable ? 'M' : '-') + '/' + (s.userInvocable ? 'U' : '-'), stateCls: s.modelInvocable || s.userInvocable ? 'on' : 'off' }))
                  .filter((x: any) => matches(x.title))
                section.append(renderItems(items, 'skill'))
              } else {
                const head = el('div', 'kbt-toolbar')
                const addMcpBtn = el('button', 'kbt-btn ghost', '添加 MCP')
                addMcpBtn.addEventListener('click', () => openMcpModal())
                head.append(addMcpBtn)
                section.append(head)
                const items = catalog.mcps
                  .map((m: any) => ({ ...m, title: m.serverName, stateText: m.enabled ? '运行中' : '已停用', stateCls: m.enabled ? 'on' : 'off' }))
                  .filter((x: any) => matches(x.title))
                section.append(renderItems(items, 'mcp'))
              }
              catalogPanel.append(section)
            }

            search.addEventListener('input', draw)
            refresh.addEventListener('click', refreshData)
            draw()
          }

          // ── MCP 添加弹窗 ──
          const openMcpModal = (): void => {
            const overlay = el('div', 'kbt-modal-overlay')
            const modal = el('div', 'kbt-modal')
            const header = el('div', 'kbt-modal-header', '添加 MCP')
            const body = el('div', 'kbt-modal-body')
            const footer = el('div', 'kbt-modal-footer')

            const serverInput = el('input', 'kbt-input') as HTMLInputElement
            serverInput.placeholder = 'serverName'
            const transportSelect = el('select', 'kbt-input') as HTMLSelectElement
            for (const [value, label] of [['stdio', 'stdio'], ['streamable-http', 'streamable-http']] as const) {
              const opt = el('option', undefined, label) as HTMLOptionElement
              opt.value = value
              transportSelect.append(opt)
            }
            const commandInput = el('input', 'kbt-input') as HTMLInputElement
            commandInput.placeholder = 'command (stdio)'
            const urlInput = el('input', 'kbt-input') as HTMLInputElement
            urlInput.placeholder = 'url (streamable-http)'
            const argsInput = el('input', 'kbt-input') as HTMLInputElement
            argsInput.placeholder = 'args，逗号分隔'

            body.append(serverInput, transportSelect, commandInput, urlInput, argsInput)

            const close = (): void => overlay.remove()
            const saveBtn = el('button', 'kbt-btn', '添加')
            const cancelBtn = el('button', 'kbt-btn ghost', '取消')
            saveBtn.addEventListener('click', () => {
              const serverName = serverInput.value.trim()
              if (!serverName) return say('MCP serverName 必填', true)
              const transport = transportSelect.value as 'stdio' | 'streamable-http'
              const payload: any = { serverName, transport }
              if (transport === 'stdio') {
                if (!commandInput.value.trim()) return say('stdio 需要 command', true)
                payload.command = commandInput.value.trim()
                payload.args = argsInput.value.split(',').map((s) => s.trim()).filter(Boolean)
              } else {
                if (!urlInput.value.trim()) return say('streamable-http 需要 url', true)
                payload.url = urlInput.value.trim()
              }
              saveBtn.disabled = true
              api('/mcps', { method: 'POST', body: JSON.stringify(payload) })
                .then(() => { close(); return refreshData() })
                .catch((e) => say(String(e), true))
                .finally(() => { saveBtn.disabled = false })
            })
            cancelBtn.addEventListener('click', close)
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })

            footer.append(cancelBtn, saveBtn)
            modal.append(header, body, footer)
            overlay.append(modal)
            document.body.appendChild(overlay)
            serverInput.focus()
          }

          // ── Roles 渲染 ──
          const renderRoles = (): void => {
            rolesPanel.textContent = ''
            const toolbar = el('div', 'kbt-toolbar')
            const createBtn = el('button', 'kbt-btn', '创建角色')
            toolbar.append(createBtn)
            rolesPanel.append(toolbar)

            const list = el('div', 'kbt-list')
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
                edit.addEventListener('click', () => openRoleModal(role.id))
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

            createBtn.addEventListener('click', () => openRoleModal())
            draw()
          }

          // ── 角色创建/编辑弹窗 ──
          const openRoleModal = (roleId?: string): void => {
            const role = roleId ? roles.find((r) => r.id === roleId) : undefined
            const overlay = el('div', 'kbt-modal-overlay')
            const modal = el('div', 'kbt-modal')
            const header = el('div', 'kbt-modal-header', role ? '编辑角色' : '创建角色')
            const body = el('div', 'kbt-modal-body')
            const footer = el('div', 'kbt-modal-footer')

            const nameInput = el('input', 'kbt-input') as HTMLInputElement
            nameInput.placeholder = '角色名称'
            if (role) nameInput.value = role.name
            const descInput = el('input', 'kbt-input') as HTMLInputElement
            descInput.placeholder = '描述（可选）'
            if (role) descInput.value = role.description || ''

            // 创建角色时，默认勾选 DSH 原始自带的插件与全部 Skill；编辑时保留原选择
            const originalPlugins = catalog.plugins
              .filter((p: any) => !p.moduleName.startsWith('@dsh-external/'))
              .map((p: any) => p.moduleName)
            const selectedPlugins = new Set<string>(role ? role.plugins || [] : originalPlugins)
            const selectedSkills = new Set<string>(role ? role.skills || [] : catalog.skills.map((s: any) => s.name))
            const selectedMcps = new Set<string>(role ? role.mcps || [] : [])

            const makeGrid = (items: Array<{ id: string; label: string }>, selected: Set<string>): HTMLDivElement => {
              const grid = el('div', 'kbt-check-grid')
              if (!items.length) {
                grid.append(el('span', 'kbt-msg', '（暂无可用项）'))
                return grid
              }
              for (const item of items) {
                const label = el('label')
                const cb = el('input') as HTMLInputElement
                cb.type = 'checkbox'
                cb.checked = selected.has(item.id)
                cb.addEventListener('change', () => {
                  if (cb.checked) selected.add(item.id)
                  else selected.delete(item.id)
                })
                label.append(cb, document.createTextNode(item.label))
                grid.append(label)
              }
              return grid
            }

            body.append(nameInput, descInput)
            body.append(el('h4', 'kbt-section-title', '插件'))
            body.append(makeGrid(catalog.plugins.map((p: any) => ({ id: p.moduleName, label: p.moduleName })), selectedPlugins))
            body.append(el('h4', 'kbt-section-title', 'Skill'))
            body.append(makeGrid(catalog.skills.map((s: any) => ({ id: s.name, label: s.name })), selectedSkills))
            body.append(el('h4', 'kbt-section-title', 'MCP'))
            body.append(makeGrid(catalog.mcps.map((m: any) => ({ id: m.serverName, label: m.serverName })), selectedMcps))

            const close = (): void => overlay.remove()
            const saveBtn = el('button', 'kbt-btn', role ? '保存' : '创建')
            const cancelBtn = el('button', 'kbt-btn ghost', '取消')
            saveBtn.addEventListener('click', () => {
              const name = nameInput.value.trim()
              if (!name) return say('请输入角色名称', true)
              const payload = {
                name,
                description: descInput.value.trim(),
                plugins: [...selectedPlugins],
                skills: [...selectedSkills],
                mcps: [...selectedMcps],
              }
              saveBtn.disabled = true
              const request = role
                ? api(`/roles/${encodeURIComponent(role.id)}`, { method: 'PUT', body: JSON.stringify(payload) })
                : api('/roles', { method: 'POST', body: JSON.stringify(payload) })
              request
                .then(() => { close(); return refreshData() })
                .catch((e) => say(String(e), true))
                .finally(() => { saveBtn.disabled = false })
            })
            cancelBtn.addEventListener('click', close)
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })

            footer.append(cancelBtn, saveBtn)
            modal.append(header, body, footer)
            overlay.append(modal)
            document.body.appendChild(overlay)
            nameInput.focus()
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
