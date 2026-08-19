const BASE = '/kabutack/api';
export function registerKabutackApi(ctx, service, audit) {
    const handler = async (req, res) => {
        const send = (code, obj) => {
            res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(obj));
        };
        try {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const path = url.pathname.replace(new RegExp('^' + BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '') || '/';
            const method = req.method || 'GET';
            const segments = path.split('/').filter(Boolean);
            // GET /catalog
            if (method === 'GET' && path === '/catalog') {
                const data = await service.listCatalog();
                return send(200, { ok: true, data });
            }
            // GET /state
            if (method === 'GET' && path === '/state') {
                return send(200, { ok: true, data: service.getState() });
            }
            // GET /roles（返回完整角色，含能力数组，便于编辑器直接使用）
            if (method === 'GET' && path === '/roles') {
                return send(200, { ok: true, data: service.listRoleDetails() });
            }
            // GET /roles/:id
            if (method === 'GET' && segments.length === 2 && segments[0] === 'roles') {
                const role = service.getRole(decodeURIComponent(segments[1]));
                if (!role)
                    return send(404, { ok: false, error: 'not-found: 角色不存在' });
                return send(200, { ok: true, data: role });
            }
            // POST /roles
            if (method === 'POST' && path === '/roles') {
                const body = (await readBody(req));
                const role = service.createRole(body);
                return send(200, { ok: true, data: role });
            }
            // PUT /roles/:id
            if (method === 'PUT' && segments.length === 2 && segments[0] === 'roles') {
                const id = decodeURIComponent(segments[1]);
                const body = (await readBody(req));
                const role = service.updateRole(id, body);
                return send(200, { ok: true, data: role });
            }
            // DELETE /roles/:id
            if (method === 'DELETE' && segments.length === 2 && segments[0] === 'roles') {
                const id = decodeURIComponent(segments[1]);
                service.deleteRole(id);
                return send(200, { ok: true, data: { id } });
            }
            // POST /roles/:id/duplicate
            if (method === 'POST' && segments.length === 3 && segments[0] === 'roles' && segments[2] === 'duplicate') {
                const id = decodeURIComponent(segments[1]);
                const role = service.duplicateRole(id);
                return send(200, { ok: true, data: role });
            }
            // POST /roles/:id/activate
            if (method === 'POST' && segments.length === 3 && segments[0] === 'roles' && segments[2] === 'activate') {
                const id = decodeURIComponent(segments[1]);
                const result = await service.activateRole(id);
                return send(result.ok ? 200 : 500, { ok: result.ok, data: result, error: result.error });
            }
            // POST /roles/deactivate
            if (method === 'POST' && path === '/roles/deactivate') {
                return send(200, { ok: true, data: service.deactivate() });
            }
            // POST /capabilities/plugin/:entryId/enable|disable
            if (method === 'POST' && segments.length === 4 && segments[0] === 'capabilities' && segments[1] === 'plugin' && (segments[3] === 'enable' || segments[3] === 'disable')) {
                const entryId = decodeURIComponent(segments[2]);
                const enabled = segments[3] === 'enable';
                const data = await service.setPluginEnabled(entryId, enabled);
                return send(200, { ok: true, data });
            }
            // DELETE /capabilities/plugin/:moduleName
            if (method === 'DELETE' && segments.length === 3 && segments[0] === 'capabilities' && segments[1] === 'plugin') {
                const moduleName = decodeURIComponent(segments[2]);
                await service.removePluginByModuleName(moduleName);
                return send(200, { ok: true, data: { moduleName } });
            }
            // POST /capabilities/mcp/:serverName/enable|disable
            if (method === 'POST' && segments.length === 4 && segments[0] === 'capabilities' && segments[1] === 'mcp' && (segments[3] === 'enable' || segments[3] === 'disable')) {
                const serverName = decodeURIComponent(segments[2]);
                const enabled = segments[3] === 'enable';
                await service.setMcpEnabled(serverName, enabled);
                return send(200, { ok: true, data: { serverName, enabled } });
            }
            // DELETE /capabilities/mcp/:serverName
            if (method === 'DELETE' && segments.length === 3 && segments[0] === 'capabilities' && segments[1] === 'mcp') {
                const serverName = decodeURIComponent(segments[2]);
                await service.removeMcp(serverName);
                return send(200, { ok: true, data: { serverName } });
            }
            // POST /capabilities/skill/:name/enable|disable
            if (method === 'POST' && segments.length === 4 && segments[0] === 'capabilities' && segments[1] === 'skill' && (segments[3] === 'enable' || segments[3] === 'disable')) {
                const name = decodeURIComponent(segments[2]);
                const enabled = segments[3] === 'enable';
                const body = (await readBody(req).catch(() => ({})));
                const opts = enabled
                    ? { modelInvocable: true, userInvocable: true }
                    : { modelInvocable: body.modelInvocable ?? false, userInvocable: body.userInvocable ?? false };
                const result = await service.setSkillInvocation(name, opts);
                return send(200, { ok: true, data: result });
            }
            // DELETE /capabilities/skill/:name
            if (method === 'DELETE' && segments.length === 3 && segments[0] === 'capabilities' && segments[1] === 'skill') {
                const name = decodeURIComponent(segments[2]);
                const trash = await service.removeSkill(name);
                return send(200, { ok: true, data: { name, trash } });
            }
            // POST /mcps
            if (method === 'POST' && path === '/mcps') {
                const body = (await readBody(req));
                const item = await service.addMcp(body);
                return send(200, { ok: true, data: item });
            }
            // PUT /mcps/:serverName
            if (method === 'PUT' && segments.length === 2 && segments[0] === 'mcps') {
                const serverName = decodeURIComponent(segments[1]);
                const body = (await readBody(req));
                const item = await service.updateMcp(serverName, body);
                return send(200, { ok: true, data: item });
            }
            // DELETE /mcps/:serverName
            if (method === 'DELETE' && segments.length === 2 && segments[0] === 'mcps') {
                const serverName = decodeURIComponent(segments[1]);
                await service.removeMcp(serverName);
                return send(200, { ok: true, data: { serverName } });
            }
            return send(404, { ok: false, error: 'not-found: ' + method + ' ' + path });
        }
        catch (err) {
            const message = err?.message || String(err);
            const code = /^invalid-input/.test(message) ? 400 :
                /^not-found/.test(message) ? 404 :
                    /^conflict/.test(message) ? 409 :
                        /^forbidden/.test(message) ? 403 :
                            /^unsupported/.test(message) ? 400 : 500;
            audit?.log('api.error', { path: req.url, error: message });
            return send(code, { ok: false, error: message });
        }
    };
    const dispose = ctx.webServer.register({
        kind: 'prefix',
        path: BASE,
        handler,
    });
    return dispose;
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            }
            catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}
//# sourceMappingURL=api.js.map