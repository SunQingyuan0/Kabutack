import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiResponse, CreateRoleInput, RoleManagerStore, UpdateRoleInput } from './types.js'
import { listCatalog } from './catalog.js'
import { createRole, deleteRole, duplicateRole, getRole, setActiveRole, updateRole } from './roles.js'
import { buildPlan, executePlan } from './apply.js'
import { findEntryByModuleName, isManagedPlugin, isProtectedPlugin, listEntries, removeEntry, setPluginEnabled } from './loader-ops.js'
import { addMcp, removeMcp, setMcpEnabled, updateMcp } from './mcp-ops.js'
import { removeSkill, setSkillInvocation } from './skills-ops.js'
import type { Audit } from './audit.js'

export interface KabutackServices {
  ctx: any
  getStore(): RoleManagerStore
  save(store: RoleManagerStore): void
  audit: Audit
}

const BASE = '/kabutack/api'

export function registerKabutackApi(services: KabutackServices): () => void {
  const { ctx } = services

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const send = (code: number, obj: ApiResponse): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(obj))
    }

    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname.replace(new RegExp('^' + BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '') || '/'
      const method = req.method || 'GET'
      const segments = path.split('/').filter(Boolean)

      // GET /catalog
      if (method === 'GET' && path === '/catalog') {
        const data = await listCatalog(ctx)
        return send(200, { ok: true, data })
      }

      // GET /state
      if (method === 'GET' && path === '/state') {
        const store = services.getStore()
        return send(200, { ok: true, data: { activeRoleId: store.activeRoleId, lastActivation: store.lastActivation } })
      }

      // GET /roles（返回完整角色，含能力数组，便于编辑器直接使用）
      if (method === 'GET' && path === '/roles') {
        return send(200, { ok: true, data: services.getStore().roles })
      }

      // GET /roles/:id
      if (method === 'GET' && segments.length === 2 && segments[0] === 'roles') {
        const role = getRole(services.getStore(), decodeURIComponent(segments[1]))
        if (!role) return send(404, { ok: false, error: 'not-found: 角色不存在' })
        return send(200, { ok: true, data: role })
      }

      // POST /roles
      if (method === 'POST' && path === '/roles') {
        const body = (await readBody(req)) as CreateRoleInput
        const store = services.getStore()
        const role = createRole(store, body)
        services.save(store)
        services.audit.log('role.create', { id: role.id })
        return send(200, { ok: true, data: role })
      }

      // PUT /roles/:id
      if (method === 'PUT' && segments.length === 2 && segments[0] === 'roles') {
        const id = decodeURIComponent(segments[1])
        const body = (await readBody(req)) as UpdateRoleInput
        const store = services.getStore()
        const role = updateRole(store, id, body)
        services.save(store)
        services.audit.log('role.update', { id })
        return send(200, { ok: true, data: role })
      }

      // DELETE /roles/:id
      if (method === 'DELETE' && segments.length === 2 && segments[0] === 'roles') {
        const id = decodeURIComponent(segments[1])
        const store = services.getStore()
        deleteRole(store, id)
        services.save(store)
        services.audit.log('role.delete', { id })
        return send(200, { ok: true, data: { id } })
      }

      // POST /roles/:id/duplicate
      if (method === 'POST' && segments.length === 3 && segments[0] === 'roles' && segments[2] === 'duplicate') {
        const id = decodeURIComponent(segments[1])
        const store = services.getStore()
        const role = duplicateRole(store, id)
        services.save(store)
        services.audit.log('role.duplicate', { id, newId: role.id })
        return send(200, { ok: true, data: role })
      }

      // POST /roles/:id/activate
      if (method === 'POST' && segments.length === 3 && segments[0] === 'roles' && segments[2] === 'activate') {
        const id = decodeURIComponent(segments[1])
        const store = services.getStore()
        const role = getRole(store, id)
        if (!role) return send(404, { ok: false, error: 'not-found: 角色不存在' })
        const catalog = await listCatalog(ctx)
        const plan = buildPlan(role, catalog, store)
        const result = await executePlan(ctx, plan, catalog, store, services.save)
        if (result.ok) {
          setActiveRole(store, id)
          // 角色激活后以角色为持久真源，清除旧的单点启停覆盖
          store.pluginOverrides = {}
          store.mcpOverrides = {}
          store.lastActivation = { roleId: id, at: Date.now(), result: 'ok' }
          services.save(store)
          services.audit.log('role.activate', { id, executed: result.executed })
        } else {
          store.lastActivation = { roleId: store.activeRoleId, at: Date.now(), result: 'failed', message: result.error }
          services.save(store)
          services.audit.log('role.activate.failed', { id, error: result.error, rolledBack: result.rolledBack })
        }
        return send(result.ok ? 200 : 500, { ok: result.ok, data: result, error: result.error })
      }

      // POST /roles/deactivate
      if (method === 'POST' && path === '/roles/deactivate') {
        const store = services.getStore()
        const previous = store.activeRoleId
        setActiveRole(store, null)
        store.lastActivation = { roleId: null, at: Date.now(), result: 'ok' }
        services.save(store)
        services.audit.log('role.deactivate', { previous })
        return send(200, { ok: true, data: { previous } })
      }

      // POST /capabilities/plugin/:entryId/enable|disable
      if (method === 'POST' && segments.length === 4 && segments[0] === 'capabilities' && segments[1] === 'plugin' && (segments[3] === 'enable' || segments[3] === 'disable')) {
        const entryId = decodeURIComponent(segments[2])
        const enabled = segments[3] === 'enable'
        const entry = listEntries(ctx).find((e) => e.id === entryId)
        if (!entry) return send(404, { ok: false, error: 'not-found: 插件 entry 不存在' })
        await setPluginEnabled(ctx, entryId, enabled)
        const store = services.getStore()
        store.pluginOverrides = store.pluginOverrides || {}
        store.pluginOverrides[entry.options.name] = enabled
        services.save(store)
        services.audit.log('plugin.setEnabled', { entryId, moduleName: entry.options.name, enabled })
        return send(200, { ok: true, data: { entryId, moduleName: entry.options.name, enabled } })
      }

      // DELETE /capabilities/plugin/:moduleName
      if (method === 'DELETE' && segments.length === 3 && segments[0] === 'capabilities' && segments[1] === 'plugin') {
        const moduleName = decodeURIComponent(segments[2])
        if (!isManagedPlugin(moduleName) || isProtectedPlugin(moduleName)) {
          return send(403, { ok: false, error: 'forbidden: 该插件不可卸载' })
        }
        const entry = findEntryByModuleName(ctx, moduleName)
        if (!entry) return send(404, { ok: false, error: 'not-found: 插件不存在' })
        await removeEntry(ctx, entry.id)
        const store = services.getStore()
        store.removedPlugins = store.removedPlugins || []
        if (!store.removedPlugins.includes(moduleName)) store.removedPlugins.push(moduleName)
        if (store.pluginOverrides) delete store.pluginOverrides[moduleName]
        services.save(store)
        services.audit.log('plugin.remove', { moduleName, entryId: entry.id })
        return send(200, { ok: true, data: { moduleName } })
      }

      // POST /capabilities/mcp/:serverName/enable|disable
      if (method === 'POST' && segments.length === 4 && segments[0] === 'capabilities' && segments[1] === 'mcp' && (segments[3] === 'enable' || segments[3] === 'disable')) {
        const serverName = decodeURIComponent(segments[2])
        const enabled = segments[3] === 'enable'
        await setMcpEnabled(ctx, serverName, enabled)
        const store = services.getStore()
        store.mcpOverrides = store.mcpOverrides || {}
        store.mcpOverrides[serverName] = enabled
        services.save(store)
        services.audit.log('mcp.setEnabled', { serverName, enabled })
        return send(200, { ok: true, data: { serverName, enabled } })
      }

      // DELETE /capabilities/mcp/:serverName
      if (method === 'DELETE' && segments.length === 3 && segments[0] === 'capabilities' && segments[1] === 'mcp') {
        const serverName = decodeURIComponent(segments[2])
        const store = services.getStore()
        await removeMcp(ctx, store, serverName, services.save)
        if (store.mcpOverrides) delete store.mcpOverrides[serverName]
        services.save(store)
        services.audit.log('mcp.remove', { serverName })
        return send(200, { ok: true, data: { serverName } })
      }

      // POST /capabilities/skill/:name/enable|disable
      if (method === 'POST' && segments.length === 4 && segments[0] === 'capabilities' && segments[1] === 'skill' && (segments[3] === 'enable' || segments[3] === 'disable')) {
        const name = decodeURIComponent(segments[2])
        const enabled = segments[3] === 'enable'
        const body = (await readBody(req).catch(() => ({}))) as { modelInvocable?: boolean; userInvocable?: boolean }
        const opts = enabled
          ? { modelInvocable: true, userInvocable: true }
          : { modelInvocable: body.modelInvocable ?? false, userInvocable: body.userInvocable ?? false }
        const result = await setSkillInvocation(ctx, name, opts)
        services.audit.log('skill.setInvocation', { name, opts })
        return send(200, { ok: true, data: result })
      }

      // DELETE /capabilities/skill/:name
      if (method === 'DELETE' && segments.length === 3 && segments[0] === 'capabilities' && segments[1] === 'skill') {
        const name = decodeURIComponent(segments[2])
        const trash = await removeSkill(ctx, name)
        services.audit.log('skill.remove', { name, trash })
        return send(200, { ok: true, data: { name, trash } })
      }

      // POST /mcps
      if (method === 'POST' && path === '/mcps') {
        const body = (await readBody(req)) as any
        const store = services.getStore()
        const item = await addMcp(ctx, store, body, services.save)
        store.mcpOverrides = store.mcpOverrides || {}
        store.mcpOverrides[item.serverName] = true
        services.save(store)
        services.audit.log('mcp.create', { serverName: item.serverName })
        return send(200, { ok: true, data: item })
      }

      // PUT /mcps/:serverName
      if (method === 'PUT' && segments.length === 2 && segments[0] === 'mcps') {
        const serverName = decodeURIComponent(segments[1])
        const body = (await readBody(req)) as any
        const store = services.getStore()
        const item = await updateMcp(ctx, store, serverName, body, services.save)
        services.audit.log('mcp.update', { serverName })
        return send(200, { ok: true, data: item })
      }

      // DELETE /mcps/:serverName
      if (method === 'DELETE' && segments.length === 2 && segments[0] === 'mcps') {
        const serverName = decodeURIComponent(segments[1])
        const store = services.getStore()
        await removeMcp(ctx, store, serverName, services.save)
        if (store.mcpOverrides) delete store.mcpOverrides[serverName]
        services.save(store)
        services.audit.log('mcp.remove', { serverName })
        return send(200, { ok: true, data: { serverName } })
      }

      return send(404, { ok: false, error: 'not-found: ' + method + ' ' + path })
    } catch (err: any) {
      const code = /^(invalid-input|conflict|not-found|forbidden|unsupported)/.test(err?.message || '') ? 400 : 500
      services.audit.log('api.error', { path: req.url, error: err?.message })
      return send(code, { ok: false, error: err?.message || String(err) })
    }
  }

  const dispose = ctx.webServer.register({
    kind: 'prefix',
    path: BASE,
    handler,
  })
  return dispose
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}
