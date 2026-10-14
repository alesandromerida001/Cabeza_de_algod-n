// Ejecutar con: node --test tests/fundacion.test.js
// No abre puertos ni utiliza la base de datos del proyecto.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const frontend = fs.readFileSync(path.join(root, 'frontend/fundacion/solicitudes_fundacion.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'frontend/fundacion/solicitudes_fundacion.html'), 'utf8');
const horarios = ['09:00', '09:45', '10:30', '11:15', '12:00', '12:45', '14:00', '14:45', '15:30', '16:15', '17:00'];
const visita = {
    idSolicitud: 1, diagnostico: 'Control médico', costoConsulta: 500, costoExamenes: 1500,
    costoMedicamentos: 750, descuentoConsulta: 20, descuentoExamenes: 10, descuentoMedicamentos: 15
};

function crearBackend(opciones = {}) {
    const rutas = new Map();
    const operaciones = [];
    let tipoPersonal = 'Fundacion';
    class Transaction {
        async begin() { operaciones.push({ tipo: 'begin' }); }
        async commit() { operaciones.push({ tipo: 'commit' }); }
        async rollback() { operaciones.push({ tipo: 'rollback' }); }
    }
    class Request {
        constructor(transaction) { this.transaction = transaction; this.parametros = {}; }
        input(nombre, tipo, valor) { this.parametros[nombre] = valor; return this; }
        async query(consulta) {
            if (consulta.includes("OBJECT_ID('dbo.FinanzasVersion'")) return { recordset: [{ finanzas: opciones.finanzas ? 1 : 0, tablas: opciones.finanzas ? 11 : 0, correo: 254 }] };
            if (consulta.includes('SELECT version')) return { recordset: [{ version: 1 }] };
            if (consulta.includes('COL_LENGTH')) return { recordset: [{ usuariosMigrados: 1, especialidades: 1 }] };
            if (consulta.includes('SELECT TOP (1) u.id_usuario')) return { recordset: [] };
            if (consulta.includes('FROM dbo.Usuarios u WHERE u.id_usuario = @id')) {
                return { recordset: [{ id_usuario: 1, estado: 'Activo', tipo_personal: tipoPersonal, id_rol: 15 }] };
            }
            operaciones.push({ consulta, parametros: this.parametros, transaction: this.transaction });
            if (consulta.includes('WITH (UPDLOCK, HOLDLOCK)')) {
                return { recordset: opciones.ausente ? [] : [{ id_solicitud: 1, estado: opciones.estado || 'Programada' }] };
            }
            if (consulta.includes('SELECT s.id_residente,s.especialidad,s.medico')) return { recordset: [{ id_residente:2,nombres:'Residente',apellidos:'Prueba',especialidad:'Geriatría',fecha:'2026-10-10',hora:'09:00' }] };
            if (consulta.includes('INSERT dbo.NotificacionesCorreo') && opciones.fallaNotificacion) throw new Error('Fallo al encolar simulado');
            if (consulta.includes('SELECT v.id_visita,v.total,')) return { recordset: [{ id_visita: 5, id_residente: 2, total: 2387.5, fecha: '2026-01-01' }] };
            if (consulta.includes('INSERT dbo.CargosFamiliares')) return { recordset: [{ id_cargo: 3, id_residente: 2, monto: 2387.5, concepto: 'Atención médica' }] };
            if (consulta.includes('INSERT dbo.ObligacionesFundacion') && opciones.fallaFinanzas) throw new Error('Fallo financiero simulado');
            if (consulta.includes('INSERT INTO VisitasMedicas') && opciones.fallaInsercion) {
                throw new Error('Fallo de inserción simulado');
            }
            if (consulta.includes("SET estado = 'Finalizada'")) {
                return { rowsAffected: [opciones.fallaFinalizacion ? 0 : 1] };
            }
            return { recordset: [], rowsAffected: [1] };
        }
    }
    const sql = {
        Transaction, Request, Int: 'Int', Date: 'Date',
        NVarChar: n => `NVarChar(${n})`, MAX: -1, VarChar: n => `VarChar(${n})`, Decimal: (p, s) => `Decimal(${p},${s})`,
        connect: async () => ({ request: () => new Request() })
    };
    const app = { use() {}, listen() {} };
    for (const metodo of ['get', 'post', 'put', 'delete']) {
        app[metodo] = (ruta, ...handlers) => rutas.set(`${metodo} ${ruta}`, handlers);
    }
    const express = Object.assign(() => app, { json() {}, static() {} });
    const context = {
        __dirname: path.join(root, 'backend'), process: { env: { JWT_SECRET: 'solo-pruebas' } },
        console: { log() {}, error() {} },
        require(nombre) {
            if (nombre === './config/errores-db') return require('../backend/config/errores-db');
            if (nombre === './reportes') return require('../backend/reportes');
            if (nombre === './finanzas') return require('../backend/finanzas');
            if (nombre === 'express') return express;
            if (nombre === 'mssql') return sql;
            if (nombre === './config/db') return {};
            if (nombre === 'dotenv') return { config() {} };
            return require(nombre);
        }
    };
    vm.runInNewContext(backend, context);
    return {
        rutas, operaciones,
        async ejecutar(ruta, body = {}, rol = 'MedicoFundacion', params = { id: '1' }) {
            let status = 200;
            let payload;
            const res = { status(n) { status = n; return this; }, json(data) { payload = data; return this; } };
            tipoPersonal = rol === 'Admin' ? 'Asilo' : 'Fundacion';
            const req = { body, params, cookies: rol ? { token: jwt.sign({ id: 1, tipo_personal: tipoPersonal }, 'solo-pruebas') } : {} };
            const handlers = rutas.get(ruta);
            assert.ok(handlers, `Ruta existente: ${ruta}`);
            for (const handler of handlers) {
                let siguiente = false;
                await handler(req, res, () => { siguiente = true; });
                if (!siguiente) break;
            }
            return { status, payload };
        }
    };
}

function crearFrontend() {
    const elementos = new Map();
    const llamadas = [];
    for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
        const tag = match[0];
        const id = match[1];
        assert.ok(!elementos.has(id), `ID único: ${id}`);
        elementos.set(id, {
            id, value: tag.match(/\bvalue="([^"]*)"/)?.[1] || '', textContent: '', disabled: false,
            moneda: tag.includes('campo-moneda'), porcentaje: tag.includes('type="number"'),
            listeners: {}, hijos: [], mensaje: '', classList: { add() {} },
            addEventListener(tipo, fn) { (this.listeners[tipo] ||= []).push(fn); },
            appendChild(hijo) { this.hijos.push(hijo); },
            setCustomValidity(mensaje) { this.mensaje = mensaje; },
            get validity() {
                const valor = Number(this.value);
                return { valid: !this.mensaje && (!this.porcentaje ||
                    (this.value !== '' && Number.isFinite(valor) && valor >= 0 && valor <= 100 &&
                    Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-8)) };
            },
            reportValidity() { return this.validity.valid; }
        });
    }
    const document = {
        getElementById(id) { assert.ok(elementos.has(id), `ID existe: ${id}`); return elementos.get(id); },
        querySelectorAll(selector) {
            assert.equal(selector, '.campo-moneda');
            return [...elementos.values()].filter(e => e.moneda);
        },
        createElement() {
            return { textContent: '', hijos: [], appendChild(hijo) { this.hijos.push(hijo); }, addEventListener() {} };
        }
    };
    const context = vm.createContext({ Formatos:require('../frontend/compartido/formatos'), 
        document, console, URLSearchParams, setTimeout() {},
        window: { location: { search: '?estado=Programada' } },
        bootstrap: { Modal: class {
            constructor(elemento) { this.elemento = elemento; }
            show() { this.elemento.visible = true; }
            hide() { this.elemento.visible = false; }
        } },
        async fetch(url, opciones) {
            llamadas.push({ url, opciones });
            return { status: 200, json: async () => ({ success: true, solicitudes: [], calculo: { total: 2387.5 } }) };
        }
    });
    vm.runInContext(frontend, context);
    return { context, elementos, llamadas };
}

test('horarios del selector y backend; fechas inválidas rechazadas', async () => {
    const select = html.match(/<select\s+id="horaCita"[^>]*>([\s\S]*?)<\/select>/)[1];
    assert.deepEqual([...select.matchAll(/value="(\d{2}:\d{2})"/g)].map(m => m[1]), horarios);
    for (const horaCita of horarios) {
        const app = crearBackend();
        const respuesta = await app.ejecutar('put /api/solicitudes/:id/programar', { medico: 'Dra. Prueba', fechaCita: '2026-10-10', horaCita });
        assert.equal(respuesta.status, 200);
        const programacion = app.operaciones.find(o => o.consulta?.includes('UPDATE SolicitudesMedicas'));
        assert.match(programacion.consulta, /CAST\(@horaCita AS TIME\)/);
        assert.equal(programacion.parametros.horaCita, horaCita);
        assert.equal(app.operaciones.at(-1).tipo, 'commit');
    }
    for (const horaCita of ['08:00', '13:00', '17:45', '09:01', '9:00', '14:00:00', '02:00 PM', null, {}]) {
        const app = crearBackend();
        assert.equal((await app.ejecutar('put /api/solicitudes/:id/programar', { medico: 'Dra. Prueba', fechaCita: '2026-10-10', horaCita })).status, 400);
        assert.equal(app.operaciones.length, 0);
    }
    for (const fechaCita of ['2026-02-30', '2026-13-01', 'ayer']) {
        assert.equal((await crearBackend().ejecutar('put /api/solicitudes/:id/programar', { medico: 'Dra. Prueba', fechaCita, horaCita: '09:00' })).status, 400);
    }
});

test('cálculo oficial ignora totales enviados y guarda descuentos en la misma transacción', async () => {
    const app = crearBackend();
    const { status, payload } = await app.ejecutar('post /api/visitas', { ...visita, subtotal: 1, descuento: 0, total: 1, porcentajeDescuento: 100 });
    assert.equal(status, 200);
    assert.equal(payload.calculo.subtotal, 2750);
    assert.equal(payload.calculo.montoDescuentoConsulta, 100);
    assert.equal(payload.calculo.montoDescuentoExamenes, 150);
    assert.equal(payload.calculo.montoDescuentoMedicamentos, 112.5);
    assert.equal(payload.calculo.descuento, 362.5);
    assert.equal(payload.calculo.total, 2387.5);
    const consultas = app.operaciones.filter(op => op.consulta);
    assert.equal(consultas.length, 3);
    assert.ok(consultas.every(op => op.transaction === consultas[0].transaction));
    assert.equal(consultas[1].parametros.descuentoConsulta, 20);
    assert.equal(consultas[1].parametros.descuentoExamenes, 10);
    assert.equal(consultas[1].parametros.descuentoMedicamentos, 15);
    assert.equal(consultas[1].parametros.total, 2387.5);
    assert.equal(app.operaciones.at(-1).tipo, 'commit');
});

test('validación de costos, porcentajes, diagnóstico e identificador antes de SQL', async () => {
    const casos = [];
    for (const campo of ['costoConsulta', 'costoExamenes', 'costoMedicamentos']) {
        for (const valor of [-0.01, 'Q 500.00', '500', null, true, [], {}, NaN, Infinity, 100000000]) casos.push({ [campo]: valor });
    }
    for (const campo of ['descuentoConsulta', 'descuentoExamenes', 'descuentoMedicamentos']) {
        for (const valor of [-1, 100.01, '', null, undefined, true, [], {}, NaN, Infinity]) casos.push({ [campo]: valor });
    }
    casos.push({ diagnostico: '  ' }, { idSolicitud: 1.5 }, { costoConsulta: 99999999.99 }, { examenes: {} });
    for (const datos of casos) {
        const app = crearBackend();
        assert.equal((await app.ejecutar('post /api/visitas', { ...visita, ...datos })).status, 400);
        assert.equal(app.operaciones.length, 0);
    }
});

test('redondeo de centavos y límites de descuento 0 y 100', async () => {
    for (const porcentaje of [0, 100]) {
        const { payload } = await crearBackend().ejecutar('post /api/visitas', {
            ...visita, descuentoConsulta: porcentaje, descuentoExamenes: porcentaje, descuentoMedicamentos: porcentaje
        });
        assert.equal(payload.calculo.total, porcentaje === 0 ? 2750 : 0);
    }
    const { payload } = await crearBackend().ejecutar('post /api/visitas', {
        ...visita, costoConsulta: 0.05, costoExamenes: 0.05, costoMedicamentos: 0.05,
        descuentoConsulta: 10, descuentoExamenes: 10, descuentoMedicamentos: 10
    });
    assert.equal(payload.calculo.subtotal, 0.15);
    assert.equal(payload.calculo.descuento, 0.03);
    assert.equal(payload.calculo.total, 0.12);
});

test('estado obligatorio y rollback ante cualquier fallo', async () => {
    for (const estado of ['Pendiente', 'Cancelada', 'Finalizada']) {
        const app = crearBackend({ estado });
        assert.equal((await app.ejecutar('post /api/visitas', visita)).status, 400);
        assert.equal(app.operaciones.at(-1).tipo, 'rollback');
        assert.ok(!app.operaciones.some(op => op.consulta?.includes('INSERT')));
    }
    for (const opciones of [{ ausente: true }, { fallaInsercion: true }, { fallaFinalizacion: true }]) {
        const app = crearBackend(opciones);
        assert.equal((await app.ejecutar('post /api/visitas', visita)).status, opciones.ausente ? 404 : 500);
        assert.equal(app.operaciones.at(-1).tipo, 'rollback');
        assert.ok(!app.operaciones.some(op => op.tipo === 'commit'));
    }
});

test('JWT y roles preservados; listado entrega hora HH:mm', async () => {
    for (const ruta of ['post /api/visitas', 'put /api/solicitudes/:id/programar']) {
        assert.equal((await crearBackend().ejecutar(ruta, visita, null)).status, 401);
        assert.equal((await crearBackend().ejecutar(ruta, visita, 'Admin')).status, 403);
    }
    for (const rol of ['Admin', 'MedicoFundacion']) {
        const app = crearBackend();
        assert.equal((await app.ejecutar('get /api/solicitudes', {}, rol)).status, 200);
        assert.match(app.operaciones[0].consulta, /CONVERT\(VARCHAR\(5\), s\.hora_cita, 108\) AS hora_cita/);
        assert.equal((await app.ejecutar('get /api/visitas', {}, rol)).status, 200);
    }
});

test('IDs, listeners, formato monetario y previsualización del modal', () => {
    const { context, elementos } = crearFrontend();
    for (const match of frontend.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) assert.ok(elementos.has(match[1]), match[1]);
    assert.ok(!frontend.includes('porcentajeDescuento'));
    const funciones = [...frontend.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)].map(m => m[1]);
    assert.equal(new Set(funciones).size, funciones.length);
    context.abrirVisita({ id_solicitud: 1, nombres: 'Residente', apellidos: 'Prueba', especialidad: 'Geriatría', medico: 'Dra. Prueba' });
    for (const campo of elementos.values()) {
        for (const listeners of Object.values(campo.listeners)) assert.equal(listeners.length, 1);
        if (campo.moneda) assert.equal(campo.value, '');
        if (campo.porcentaje) assert.equal(campo.value, '20');
    }
    const costo = elementos.get('costoConsulta');
    for (const [valor, esperado] of [['500', 'Q 500.00'], ['2750', 'Q 2,750.00'], ['12345.5', 'Q 12,345.50'], ['0', 'Q 0.00'], ['', '']]) {
        costo.value = valor;
        costo.listeners.blur[0]();
        assert.equal(costo.value, esperado);
        costo.listeners.focus[0]();
        assert.equal(costo.value, valor === '' ? '' : Number(valor).toFixed(2));
    }
    for (const [id, valor] of Object.entries(visita)) if (elementos.has(id)) elementos.get(id).value = String(valor);
    context.actualizarPreviewCostos();
    for (const [id, valor] of Object.entries({ previewSubtotal: 'Q 2,750.00', previewDescuentoConsulta: 'Q 100.00', previewDescuentoExamenes: 'Q 150.00', previewDescuentoMedicamentos: 'Q 112.50', previewDescuento: 'Q 362.50', previewTotal: 'Q 2,387.50' })) {
        assert.equal(elementos.get(id).textContent, valor);
    }
    assert.equal(context.formatearHora('14:00'), '02:00 PM');
    assert.equal(context.formatearHora('09:45'), '09:45 AM');
    assert.equal(context.formatearHora('12:00'), '12:00 PM');
    assert.equal(context.formatearFecha('2026-10-10T00:00:00.000Z', true), '10/oct/2026');
});

test('frontend rechaza datos inválidos y envía solo costos, porcentajes y datos médicos', async () => {
    const { context, elementos, llamadas } = crearFrontend();
    await new Promise(resolve => setImmediate(resolve));
    context.abrirVisita({ id_solicitud: 1, nombres: 'Residente', apellidos: 'Prueba' });
    elementos.get('diagnostico').value = 'Control';
    const costo = elementos.get('costoConsulta');
    for (const valor of ['abc', '-1', '12,34', '1.234', 'Q', 'Infinity']) {
        costo.value = valor;
        costo.listeners.input[0]();
        assert.equal(elementos.get('previewTotal').textContent, '—');
        await context.registrarVisita();
        assert.equal(llamadas.filter(c => c.opciones?.method === 'POST').length, 0);
    }
    costo.value = 'Q 2,750.00';
    elementos.get('descuentoConsulta').value = '101';
    await context.registrarVisita();
    assert.equal(llamadas.filter(c => c.opciones?.method === 'POST').length, 0);
    elementos.get('descuentoConsulta').value = '20';
    await Promise.all([context.registrarVisita(), context.registrarVisita()]);
    const posts = llamadas.filter(c => c.opciones?.method === 'POST');
    assert.equal(posts.length, 1);
    const body = JSON.parse(posts[0].opciones.body);
    assert.equal(body.costoConsulta, 2750);
    assert.equal(body.costoExamenes, 0);
    assert.equal(body.descuentoConsulta, 20);
    for (const clave of ['subtotal', 'total', 'descuento', 'porcentajeDescuento']) assert.ok(!(clave in body));
    assert.equal(elementos.get('modalVisita').visible, false);
    assert.equal(elementos.get('btnRegistrarVisita').disabled, false);
    assert.equal(llamadas.at(-1).url, '/api/solicitudes');
    assert.match(elementos.get('toast').textContent, /Visita registrada/);
});


test('visita nueva migrada: cargo/obligación antes del COMMIT y rollback si falla Finanzas', async () => {
    for (const fallaFinanzas of [false, true]) {
        const app = crearBackend({ finanzas: true, fallaFinanzas });
        const r = await app.ejecutar('post /api/visitas', visita);
        assert.equal(r.status, fallaFinanzas ? 500 : 200);
        const consultas = app.operaciones.filter(o => o.consulta);
        assert.ok(consultas.some(o => o.consulta.includes('INSERT dbo.CargosFamiliares')));
        assert.ok(consultas.some(o => o.consulta.includes('INSERT dbo.ObligacionesFundacion')));
        assert.ok(consultas.every(o => o.transaction === consultas[0].transaction));
        assert.equal(app.operaciones.at(-1).tipo, fallaFinanzas ? 'rollback' : 'commit');
        const bloqueo = consultas.findIndex(o => o.consulta.includes('sp_getapplock'));
        const solicitud = consultas.findIndex(o => o.consulta.includes('FROM SolicitudesMedicas WITH'));
        assert.ok(bloqueo >= 0 && bloqueo < solicitud);
    }
});

test('programar cita migrada incluye aviso seguro dentro de su transacción',async()=>{
    for(const fallaNotificacion of [false,true]){
        const app=crearBackend({finanzas:true,fallaNotificacion});
        const r=await app.ejecutar('put /api/solicitudes/:id/programar',{medico:'Dra. Prueba',fechaCita:'2026-10-10',horaCita:'09:00'});
        assert.equal(r.status,fallaNotificacion?500:200);
        const consultas=app.operaciones.filter(o=>o.consulta),aviso=consultas.find(o=>o.consulta.includes('INSERT dbo.NotificacionesCorreo'));
        assert.ok(aviso);assert.match(aviso.parametros.cuerpo,/10\/oct\/2026/);assert.match(aviso.parametros.cuerpo,/09:00 AM/);
        assert.equal(aviso.parametros.evento,'Cita');assert.ok(consultas.every(o=>o.transaction===aviso.transaction));
        assert.equal(app.operaciones.at(-1).tipo,fallaNotificacion?'rollback':'commit');
    }
});
