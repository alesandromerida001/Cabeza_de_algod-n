// Solo datos simulados: no SQL Server, puertos ni escrituras.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'frontend/fundacion/visitas_realizadas.html'), 'utf8');
const fuente = fs.readFileSync(path.join(root, 'frontend/fundacion/detalle_visita.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'frontend/fundacion/visitas_realizadas.js'), 'utf8');
const datos = [
    { id_visita: 1, id_solicitud: 3, id_residente: 10, nombres: 'Ana', apellidos: 'Pérez', medico: 'Médico Uno', especialidad: 'Geriatría', fecha_visita: '2026-10-01T00:00:00.000Z', total: 1250, descuento_consulta_porcentaje: 0 },
    { id_visita: 2, id_solicitud: 4, id_residente: 10, nombres: 'Ana', apellidos: 'Pérez', medico: 'Médico Dos', especialidad: 'Cardiología', fecha_visita: '2026-10-07T12:00:00.000Z', total: 0 },
    { id_visita: 3, id_solicitud: 5, id_residente: 11, nombres: 'Luis', apellidos: 'López', medico: null, especialidad: 'Geriatría', fecha_visita: '2026-09-30T00:00:00.000Z', total: null }
];
function elemento() {
    return { value: '', textContent: '', children: [], listeners: {},
        appendChild(e) { this.children.push(e); }, replaceChildren(...e) { this.children = e; this.textContent = ''; },
        setAttribute() {}, addEventListener(tipo, fn) { (this.listeners[tipo] ||= []).push(fn); } };
}
async function pagina(status = 200, filas = datos, origen = '?origen=asilo') {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    const elementos = Object.fromEntries(ids.map(id => [id, elemento()]));
    const llamadas = []; let abierto = false;
    const contexto = vm.createContext({ Formatos:require('../frontend/compartido/formatos'),  Intl, Date, URLSearchParams, console,
        document: { getElementById(id) { assert.ok(elementos[id], id); return elementos[id]; }, createElement: elemento },
        window: { location: { search: origen } },
        bootstrap: { Modal: class { show() { abierto = true; } } },
        async fetch(url, opciones) { llamadas.push({ url, opciones }); return { status, ok: status === 200, json: async () => ({ success: status === 200, visitas: filas }) }; }
    });
    vm.runInContext(fuente, contexto);
    await new Promise(resolve => setImmediate(resolve));
    return { contexto, elementos, llamadas, abierto: () => abierto };
}

test('visitas: orden, búsqueda y fechas combinadas, contadores globales por ID y mes', async () => {
    const { contexto: c, elementos: e, llamadas } = await pagina();
    assert.equal(e.volverMenu.href, '/principal/admin_dashboard.html');
    c.actualizarResumen(new Date('2026-10-07T12:00:00Z'));
    assert.equal(e.statVisitas.textContent, 3);
    assert.equal(e.statResidentes.textContent, 2);
    assert.equal(e.statMes.textContent, 2);
    assert.equal(e.tablaVisitas.children[0].children[4].textContent, 'Q 0.00');
    e.buscarVisita.value = 'perez'; e.fechaDesde.value = '2026-10-01'; e.fechaHasta.value = '2026-10-01';
    c.mostrarVisitas();
    assert.equal(e.tablaVisitas.children.length, 1);
    assert.equal(e.tablaVisitas.children[0].children[4].textContent, 'Q 1,250.00');
    assert.equal(e.statVisitas.textContent, 3); assert.equal(e.statResidentes.textContent, 2); assert.equal(e.statMes.textContent, 2);
    e.fechaDesde.value = '2026-11-01'; c.mostrarVisitas(); assert.match(e.mensajeVisitas.textContent, /posterior/);
    await e.limpiarFiltros.listeners.click[0](); assert.equal(e.tablaVisitas.children.length, 3);
    for (const busqueda of ['Médico Dos', 'cardiologia']) { e.buscarVisita.value = busqueda; c.mostrarVisitas(); assert.equal(e.tablaVisitas.children.length, 1); }
    assert.equal(llamadas.length, 1);
    assert.equal(e.buscarVisita.listeners.input.length, 1);
    assert.equal(c.fechaVisible('2026-10-01T00:00:00.000Z'), '01/oct/2026');
    assert.equal(c.fechaVisible('2026-02-30'), 'No registrado');
});

test('detalle seguro de solo lectura, valores ausentes y errores de acceso', async () => {
    const p = await pagina();
    p.contexto.verVisita({ ...datos[0], diagnostico: '<img src=x onerror=alert(1)>', costo_consulta: 0 });
    assert.ok(p.abierto());
    assert.equal(p.elementos.detalle_diagnostico.textContent, '<img src=x onerror=alert(1)>');
    assert.equal(p.elementos.detalle_total.textContent, 'Q 1,250.00');
    assert.equal(p.elementos.detalle_costo_consulta.textContent, 'Q 0.00');
    assert.equal(p.elementos.detalle_descuento_consulta_porcentaje.textContent, '0 %');
    assert.equal(p.elementos.detalle_resultados_examenes.textContent, 'No registrado');
    for (const valor of [undefined, null, '', 'abc', NaN]) assert.equal(p.contexto.moneda(valor), 'No registrado');
    assert.doesNotMatch(fuente, /innerHTML|insertAdjacentHTML/);
    const vacia = await pagina(200, []); assert.match(vacia.elementos.tablaVisitas.children[0].children[0].textContent, /Todavía/);
    const sinSesion = await pagina(401); assert.equal(sinSesion.contexto.window.location.href, '/');
    const prohibido = await pagina(403); assert.match(prohibido.elementos.mensajeVisitas.textContent, /permisos/); assert.equal(prohibido.elementos.tablaVisitas.children.length, 0);
    const fallo = await pagina(500); assert.match(fallo.elementos.mensajeVisitas.textContent, /Recargue/);
});

test('GET visitas conserva campos y JOIN, autoriza solo Asilo/Fundacion y rechaza anónimos', async () => {
    async function consultar(tipo, token = true) {
        const rutas = new Map(), consultas = [];
        const app = { use() {}, listen() {} };
        for (const m of ['get', 'post', 'put', 'delete']) app[m] = (ruta, ...handlers) => rutas.set(m + ' ' + ruta, handlers);
        const express = Object.assign(() => app, { static() {}, json() {} });
        const sql = { Int: 'Int', connect: async () => ({ request: () => ({ input() { return this; }, async query(q) {
            consultas.push(q);
            if (q.includes('COL_LENGTH')) return { recordset: [{ usuariosMigrados: 1 }] };
            if (q.includes('SELECT TOP (1)')) return { recordset: [] };
            if (q.includes('FROM dbo.Usuarios u WHERE')) return { recordset: [{ id_usuario: 13, estado: 'Activo', tipo_personal: tipo, id_rol: 1 }] };
            if (q.includes('FROM VisitasMedicas v')) return { recordset: datos };
            throw new Error('Consulta inesperada');
        } }) }) };
        vm.runInNewContext(fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8'), {
            console: { log() {}, error() {} }, __dirname: path.join(root, 'backend'), process: { env: { JWT_SECRET: 'visitas-test' } },
            require(n) {
            if (n === './config/errores-db') return require('../backend/config/errores-db');
            if (n === './reportes') return require('../backend/reportes');
            if (n === './finanzas') return require('../backend/finanzas'); if (n === 'express') return express; if (n === 'mssql') return sql; if (n === './config/db') return {}; if (n === 'dotenv') return { config() {} }; return require(n); }
        });
        let status = 200, payload;
        const req = { cookies: token ? { token: jwt.sign({ id: 13 }, 'visitas-test') } : {} };
        const res = { status(n) { status = n; return this; }, json(v) { payload = v; } };
        for (const fn of rutas.get('get /api/visitas')) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; }
        return { status, payload, consultas };
    }
    for (const tipo of ['Asilo', 'Fundacion']) {
        const r = await consultar(tipo); assert.equal(r.status, 200); assert.equal(r.payload.visitas, datos);
        const q = r.consultas.at(-1);
        for (const campo of ['id_visita', 'id_solicitud', 'id_residente', 'nombres', 'apellidos', 'especialidad', 'medico', 'fecha_visita', 'diagnostico', 'examenes', 'resultados_examenes', 'costo_examenes', 'descuento_examenes_porcentaje', 'medicamentos', 'cantidad_medicamentos', 'indicaciones', 'costo_medicamentos', 'descuento_medicamentos_porcentaje', 'costo_consulta', 'descuento_consulta_porcentaje', 'subtotal', 'descuento', 'total', 'observaciones']) assert.ok(q.includes('.' + campo), campo);
        assert.match(q, /JOIN SolicitudesMedicas/); assert.match(q, /JOIN Huespedes/); assert.match(q, /fecha_visita DESC/);
        assert.ok(!r.consultas.some(q => /INSERT|UPDATE|DELETE/.test(q)));
    }
    const otro = await consultar('Otro'); assert.equal(otro.status, 403); assert.ok(!otro.consultas.some(q => q.includes('FROM VisitasMedicas')));
    const anonimo = await consultar('Asilo', false); assert.equal(anonimo.status, 401); assert.equal(anonimo.consultas.length, 0);
});
