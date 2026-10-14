// SQL y navegador simulados. No se conecta a la BD ni abre puertos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const root = path.resolve(__dirname, '..');
const ficha = { id_residente: 4, nombres: 'Ana', apellidos: 'Pérez', dpi: '1234567890123', fecha_nacimiento: '1950-10-08T00:00:00Z', genero: 'Femenino', tipo_sangre: 'O+', alergias: 'Penicilina', padecimientos: 'Hipertensión', psicopatologias: 'No', medicamentos_habituales: 'Tratamiento', antecedentes: 'Antecedente', requiere_asistencia_especial: true, descripcion_asistencia: 'Movilidad', observaciones: null, ficha_existe: 1 };

function servidor(opciones = {}) {
    const rutas = new Map(), consultas = [];
    const app = { use() {}, listen() {} };
    for (const metodo of ['get', 'post', 'put', 'delete']) app[metodo] = (ruta, ...handlers) => rutas.set(`${metodo} ${ruta}`, handlers);
    class Request {
        constructor() { this.params = {}; }
        input(k, t, v) { this.params[k] = v; return this; }
        async query(q) {
            consultas.push({ q, params: this.params });
            if (q.includes('COL_LENGTH')) return { recordset: [{ usuariosMigrados: 1 }] };
            if (q.includes('SELECT TOP (1)')) return { recordset: [] };
            if (q.includes('FROM dbo.Usuarios u WHERE')) return { recordset: [{ id_usuario: 13, estado: 'Activo', tipo_personal: opciones.tipo || 'Fundacion', id_rol: 9 }] };
            if (opciones.fallo) throw new Error('SQL interno privado');
            if (q.includes('SELECT TOP (20)')) return { recordset: [{ id_residente: 4, nombres: 'Ana', apellidos: 'Pérez', dpi: ficha.dpi }] };
            if (q.includes('AS ficha_existe')) return { recordset: opciones.ausente ? [] : [{ ...ficha, ficha_existe: opciones.sinFicha ? 0 : 1 }] };
            if (q.includes('FROM VisitasMedicas')) return { recordset: [] };
            throw new Error('Consulta inesperada');
        }
    }
    vm.runInNewContext(fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8'), {
        console: { log() {}, error() {} }, __dirname: path.join(root, 'backend'), process: { env: { JWT_SECRET: 'fichas-test' } },
        require(n) {
            if (n === './config/errores-db') return require('../backend/config/errores-db');
            if (n === './reportes') return require('../backend/reportes');
            if (n === './finanzas') return require('../backend/finanzas');
            if (n === 'express') return Object.assign(() => app, { static() {}, json() {} });
            if (n === 'mssql') return { Int: 'Int', VarChar: n => n, connect: async () => ({ request: () => new Request() }) };
            if (n === './config/db') return {};
            if (n === 'dotenv') return { config() {} };
            return require(n);
        }
    });
    return { consultas, async ejecutar(ruta, query = {}, id = '4', autenticado = true) {
        let status = 200, payload;
        const req = { query, params: { id }, cookies: autenticado ? { token: jwt.sign({ id: 13 }, 'fichas-test') } : {} };
        const res = { status(n) { status = n; return this; }, json(v) { payload = v; } };
        for (const handler of rutas.get(ruta)) {
            let siguiente = false;
            await handler(req, res, () => { siguiente = true; });
            if (!siguiente) break;
        }
        return { status, payload };
    } };
}

test('búsqueda mínima parametrizada y consultas médicas individuales sin escrituras', async () => {
    const app = servidor();
    for (const q of ['Ana', 'Pérez', 'Ana Pérez', ficha.dpi, "' OR 1=1 --"]) {
        const r = await app.ejecutar('get /api/huespedes/buscar', { q });
        assert.equal(r.status, 200);
        assert.equal(app.consultas.at(-1).params.busqueda, q);
        assert.doesNotMatch(app.consultas.at(-1).q, /FichaMedica|alergias|SELECT\s+\*/);
        assert.deepEqual(Object.keys(r.payload.residentes[0]).sort(), ['apellidos', 'dpi', 'id_residente', 'nombres']);
    }
    for (const q of ['', 'A', 'a'.repeat(101), ['Ana']]) assert.equal((await app.ejecutar('get /api/huespedes/buscar', { q })).status, 400);
    assert.equal((await app.ejecutar('get /api/huespedes/:id/ficha-medica')).payload.ficha.alergias, 'Penicilina');
    assert.equal(app.consultas.at(-1).params.idResidente, 4);
    assert.doesNotMatch(app.consultas.at(-1).q, /cuota_mensual|telefono_emergencia|nombre_responsable/);
    assert.equal((await app.ejecutar('get /api/visitas', { id_residente: '4' })).status, 200);
    assert.match(app.consultas.at(-1).q, /WHERE h.id_residente = @idResidente/);
    assert.equal(app.consultas.at(-1).params.idResidente, 4);
    for (const id of ['0', '-1', '1.5', '4 OR 1=1', '2147483648', ['4']]) {
        assert.equal((await app.ejecutar('get /api/huespedes/:id/ficha-medica', {}, id)).status, 400);
        assert.equal((await app.ejecutar('get /api/visitas', { id_residente: id })).status, 400);
    }
    assert.ok(!app.consultas.some(c => /INSERT|UPDATE|DELETE|MERGE/.test(c.q)));
});

test('sin ficha, residente inexistente, errores privados y autorización de solo lectura', async () => {
    assert.equal((await servidor({ sinFicha: true }).ejecutar('get /api/huespedes/:id/ficha-medica')).payload.ficha.ficha_existe, 0);
    assert.equal((await servidor({ ausente: true }).ejecutar('get /api/huespedes/:id/ficha-medica')).status, 404);
    for (const ruta of ['get /api/huespedes/buscar', 'get /api/huespedes/:id/ficha-medica']) {
        const app = servidor();
        assert.equal((await app.ejecutar(ruta, { q: 'Ana' }, '4', false)).status, 401);
        assert.equal(app.consultas.length, 0);
        assert.equal((await servidor({ tipo: 'Otro' }).ejecutar(ruta, { q: 'Ana' })).status, 403);
        const fallo = await servidor({ fallo: true }).ejecutar(ruta, { q: 'Ana' });
        assert.equal(fallo.status, 500);
        assert.ok(!JSON.stringify(fallo.payload).includes('SQL interno'));
    }
    for (const ruta of ['post /api/huespedes', 'put /api/huespedes/:id', 'delete /api/huespedes/:id']) {
        assert.equal((await servidor().ejecutar(ruta)).status, 403);
    }
});

function pagina(fetchRespuesta) {
    const html = fs.readFileSync(path.join(root, 'frontend/fundacion/fichas_medicas.html'), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length);
    function elemento() { return { value: '', textContent: '', hidden: false, children: [], listeners: {}, clases: new Set(),
        classList: { toggle() {} }, focus() {}, appendChild(v) { this.children.push(v); },
        replaceChildren() { this.children = []; }, addEventListener(t, f) { (this.listeners[t] ||= []).push(f); },
        dispatchEvent(e) { for (const f of this.listeners[e.type] || []) f(e); } }; }
    const elementos = Object.fromEntries(ids.map(id => [id, elemento()]));
    for (const e of Object.values(elementos)) e.classList.toggle = (c, on) => on ? e.clases.add(c) : e.clases.delete(c);
    let abierto = false;
    const timers = new Map(); let timer = 0;
    const ctx = vm.createContext({ Formatos:require('../frontend/compartido/formatos'),  Date, Intl, AbortController, Event, console,
        setTimeout(f) { timers.set(++timer, f); return timer; }, clearTimeout(n) { timers.delete(n); },
        window: { location: {} }, fetch: fetchRespuesta,
        document: { getElementById(id) { assert.ok(elementos[id], id); return elementos[id]; }, createElement: elemento,
            querySelectorAll(s) { return Object.entries(elementos).filter(([id]) => id.startsWith(s.includes('ficha_') ? 'ficha_' : 'detalle_')).map(([, e]) => e); } },
        bootstrap: { Modal: class { show() { abierto = true; } hide() { abierto = false; } } }
    });
    for (const f of ['detalle_visita.js', 'fichas_medicas.js']) vm.runInContext(fs.readFileSync(path.join(root, 'frontend/fundacion', f), 'utf8'), ctx);
    return { ctx, elementos, timers, abierto: () => abierto };
}
const respuesta = datos => ({ status: 200, ok: true, json: async () => ({ success: true, ...datos }) });

test('selección, campos clínicos, edad, ausencia de ficha/visitas y detalle seguro', async () => {
    const p = pagina(async url => respuesta(url.includes('ficha-medica') ? { ficha } : { visitas: [] }));
    await p.ctx.seleccionarResidente(ficha);
    assert.equal(p.elementos.ficha_alergias.textContent, 'Penicilina');
    assert.equal(p.elementos.ficha_padecimientos.textContent, 'Hipertensión');
    assert.equal(p.elementos.ficha_psicopatologias.textContent, 'No');
    assert.equal(p.elementos.ficha_observaciones.textContent, 'No registrado');
    assert.equal(p.elementos.ficha_requiere_asistencia_especial.textContent, 'Sí');
    assert.ok(p.elementos.grupo_alergias.clases.has('dato-importante'));
    assert.equal(p.ctx.edadResidente(ficha.fecha_nacimiento, new Date('2026-10-07T12:00:00Z')), '75 años');
    assert.equal(p.ctx.edadResidente(ficha.fecha_nacimiento, new Date('2026-10-08T12:00:00Z')), '76 años');
    assert.match(p.elementos.mensajeHistorial.textContent, /no tiene visitas/);
    p.ctx.mostrarFicha({ ...ficha, ficha_existe: 0 });
    assert.equal(p.elementos.avisoSinFicha.hidden, false);
    p.ctx.mostrarHistorial([{ id_visita: 7, fecha_visita: '2026-10-07', diagnostico: '<script>ejemplo</script>', total: 100 }]);
    p.elementos.tablaHistorial.children[0].children[4].children[0].listeners.click[0]();
    assert.ok(p.abierto());
    assert.equal(p.elementos.detalle_diagnostico.textContent, '<script>ejemplo</script>');
    assert.equal(p.elementos.detalle_total.textContent, 'Q 100.00');
});

test('respuestas tardías no mezclan residentes, debounce y búsqueda vacía', async () => {
    const pendientes = [];
    const p = pagina(url => new Promise(resolve => pendientes.push({ url, resolve })));
    const a = p.ctx.seleccionarResidente(ficha);
    const b = p.ctx.seleccionarResidente({ ...ficha, id_residente: 8, nombres: 'Luis' });
    pendientes[2].resolve(respuesta({ ficha: { ...ficha, id_residente: 8, nombres: 'Luis' } }));
    pendientes[3].resolve(respuesta({ visitas: [] })); await b;
    pendientes[0].resolve(respuesta({ ficha })); pendientes[1].resolve(respuesta({ visitas: [{ diagnostico: 'No debe aparecer' }] })); await a;
    assert.equal(p.elementos.ficha_nombre.textContent, 'Luis Pérez');
    assert.equal(p.elementos.tablaHistorial.children.length, 0);
    for (const texto of ['A', 'An', 'Ana']) { p.elementos.buscarResidente.value = texto; p.elementos.buscarResidente.listeners.input[0](); }
    assert.equal(p.timers.size, 1);
    assert.equal(p.elementos.fichaResidente.hidden, true);
    assert.equal(p.elementos.ficha_nombre.textContent, 'No registrado');
    const busqueda = [...p.timers.values()][0]();
    assert.match(pendientes[4].url, /buscar\?q=Ana/);
    pendientes[4].resolve(respuesta({ residentes: [] })); await busqueda;
    assert.match(p.elementos.ayudaBusqueda.textContent, /No se encontraron/);
});
