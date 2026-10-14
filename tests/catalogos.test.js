// node --test tests/*.test.js — SQL simulado, sin modificar la BD real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const hash = bcrypt.hashSync('Prueba123!', 10);

function servidor(opciones = {}) {
    const rutas = new Map(), consultas = [];
    const migrado = opciones.migrado ?? true;
    const actor = { id_usuario: 1, estado: 'Activo', tipo_personal: 'Asilo', id_rol: 8,
        rol: 'Admin', contrasena: hash, nombres: 'Prueba', apellidos: 'Local', ...opciones.actor };
    class Request {
        constructor() { this.parametros = {}; }
        input(nombre, tipo, valor) { this.parametros[nombre] = valor; return this; }
        async query(sql) {
            consultas.push({ sql, parametros: this.parametros });
            if (sql.includes('COL_LENGTH')) return { recordset: [{ usuariosMigrados: +migrado, usuariosIniciados: +(opciones.parcial ?? migrado), especialidades: +(opciones.especialidades ?? migrado) }] };
            if (sql.includes('SELECT TOP (1) u.id_usuario')) return { recordset: opciones.datosInvalidos ? [{ id_usuario: 13 }] : [] };
            if (sql.includes('FROM dbo.Usuarios u WHERE u.id_usuario = @id')) return { recordset: [{ ...actor }] };
            if (sql.includes('u.contrasena')) return { recordset: actor.estado === 'Activo' ? [{ ...actor }] : [] };
            if (sql.includes('WHERE correo = @correo AND')) return { recordset: opciones.correoDuplicado ? [{ id_usuario: 2 }] : [] };
            if (sql.includes('WHERE id_rol = @idRol')) return { recordset: opciones.rolInvalido ? [] : [{ id_rol: 8 }] };
            if (sql.includes('WHERE nombre = @nombre')) return { recordset: opciones.especialidadInvalida ? [] : [{ id_especialidad: 5 }] };
            if (sql.includes('FROM Huespedes')) return { recordset: [{ id_residente: 1, estado: 'Activo' }] };
            if (sql.includes('INSERT INTO') && opciones.errorInsert) throw Object.assign(new Error('Detalle SQL privado'), { number: opciones.errorInsert });
            if (sql.includes('OUTPUT INSERTED')) return { recordset: [{ id_rol: 12, id_especialidad: 5, nombre: this.parametros.nombre, estado: 'Activo' }] };
            if (sql.includes('ORDER BY u.nombres')) return { recordset: [{ ...actor, contrasena: undefined }] };
            return { recordset: [], rowsAffected: [1] };
        }
    }
    const sql = { Int: 'Int', VarChar: n => `varchar(${n})`, connect: async () => ({ request: () => new Request() }) };
    const app = { use() {}, listen() {} };
    for (const metodo of ['get', 'post', 'put', 'delete']) app[metodo] = (url, ...handlers) => rutas.set(`${metodo} ${url}`, handlers);
    const express = Object.assign(() => app, { json() {}, static() {} });
    vm.runInNewContext(source, { console: { log() {}, error() {} }, __dirname: path.join(root, 'backend'),
        process: { env: { JWT_SECRET: 'catalogos-test' } }, require(nombre) {
            if (nombre === './config/errores-db') return require('../backend/config/errores-db');
            if (nombre === './reportes') return require('../backend/reportes');
            if (nombre === './finanzas') return require('../backend/finanzas');
            if (nombre === 'express') return express;
            if (nombre === 'mssql') return sql;
            if (nombre === './config/db') return {};
            if (nombre === 'dotenv') return { config() {} };
            return require(nombre);
        }
    });
    return { consultas, actor, async ejecutar(ruta, body = {}, token = jwt.sign({ id: 1, tipo_personal: 'Asilo' }, 'catalogos-test')) {
        let status = 200, payload, cookie;
        const res = { status(n) { status = n; return this; }, json(data) { payload = data; },
            cookie(nombre, valor, opciones) { cookie = { nombre, valor, opciones }; }, clearCookie() {} };
        const req = { body, params: ruta.startsWith('put') ? { id: '1' } : {}, cookies: token ? { token } : {} };
        const handlers = rutas.get(ruta);
        assert.ok(handlers, ruta);
        for (const fn of handlers) {
            let continuar = false;
            await fn(req, res, () => { continuar = true; });
            if (!continuar) break;
        }
        return { status, payload, cookie };
    } };
}
const usuario = { nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.test', telefono: '',
    contrasena: 'Prueba123!', tipo_personal: 'Asilo', id_rol: 8, estado: 'Activo' };

test('login viejo y migrado: mismo bcrypt/cookie, JWT mínimo y redirección por tipo', async () => {
    for (const migrado of [false, true]) {
        for (const tipo of ['Asilo', 'Fundacion']) {
            const app = servidor({ migrado, actor: { tipo_personal: tipo, rol: tipo === 'Asilo' ? 'Admin' : 'MedicoFundacion' } });
            const r = await app.ejecutar('post /api/login', { correo: '  ana@example.test  ', contrasena: 'Prueba123!' });
            assert.equal(r.status, 200);
            assert.equal(r.payload.tipo_personal, tipo);
            const decoded = jwt.verify(r.cookie.valor, 'catalogos-test');
            assert.equal(decoded.tipo_personal, tipo);
            assert.equal(decoded.exp - decoded.iat, 7200);
            assert.equal(decoded.rol, undefined);
            assert.equal(r.cookie.opciones.httpOnly, true);
            assert.equal(r.cookie.opciones.sameSite, 'lax');
            assert.equal(r.cookie.opciones.maxAge, 7200000);
        }
    }
    assert.equal((await servidor().ejecutar('post /api/login', { correo: 'ana@example.test', contrasena: 'incorrecta' })).status, 401);
});

test('autorización toma tipo y estado actuales de BD, no el rol ni el JWT antiguo', async () => {
    const fundacion = servidor({ actor: { tipo_personal: 'Fundacion', rol: 'Administrador' } });
    for (const ruta of ['get /api/usuarios', 'post /api/usuarios', 'post /api/roles', 'post /api/especialidades', 'get /api/huespedes']) {
        assert.equal((await fundacion.ejecutar(ruta, usuario)).status, 403);
    }
    const asilo = servidor({ actor: { tipo_personal: 'Asilo', rol: 'Médico Fundación' } });
    const tokenViejo = jwt.sign({ id: 1, rol: 'MedicoFundacion' }, 'catalogos-test');
    assert.equal((await asilo.ejecutar('get /api/usuarios', {}, tokenViejo)).status, 200);
    asilo.actor.estado = 'Inactivo';
    assert.equal((await asilo.ejecutar('get /api/usuarios', {}, tokenViejo)).status, 401);
    assert.equal((await servidor().ejecutar('get /api/roles', {}, null)).status, 401);
    assert.equal((await servidor().ejecutar('get /api/roles', {}, 'token falso')).status, 401);
});

test('catálogos antes de migrar: listas compatibles y altas bloqueadas con 503', async () => {
    for (const ruta of ['roles', 'especialidades']) {
        const app = servidor({ migrado: false });
        const lista = await app.ejecutar(`get /api/${ruta}`);
        assert.equal(lista.status, 200);
        assert.equal(lista.payload.migracionPendiente, true);
        assert.ok(lista.payload[ruta].length > 0);
        assert.equal((await app.ejecutar(`post /api/${ruta}`, { nombre: 'Nuevo' })).status, 503);
        assert.ok(!app.consultas.some(c => /INSERT INTO|FROM dbo\.(Roles|Especialidades)/.test(c.sql)));
    }
});

test('catálogos migrados: trim, parámetros, límites, duplicados y errores sin detalles SQL', async () => {
    for (const ruta of ['roles', 'especialidades']) {
        const app = servidor();
        assert.equal((await app.ejecutar(`post /api/${ruta}`, { nombre: '  Recepción  ' })).status, 201);
        assert.equal(app.consultas.at(-1).parametros.nombre, 'Recepción');
        assert.match(app.consultas.at(-1).sql, /VALUES \(@nombre/);
        for (const nombre of ['', '   ', null, {}, 'x'.repeat(101)]) {
            assert.equal((await servidor().ejecutar(`post /api/${ruta}`, { nombre })).status, 400);
        }
        for (const numero of [2601, 2627, 50000]) {
            const r = await servidor({ errorInsert: numero }).ejecutar(`post /api/${ruta}`, { nombre: 'Nuevo' });
            assert.equal(r.status, numero === 50000 ? 500 : 409);
            assert.ok(!JSON.stringify(r.payload).includes('Detalle SQL'));
        }
    }
});

test('crear/editar usuarios: rol independiente, hash opcional, estado y correo duplicado', async () => {
    const app = servidor();
    assert.equal((await app.ejecutar('post /api/usuarios', { ...usuario, tipo_personal: 'Fundacion' })).status, 200);
    let escritura = app.consultas.at(-1);
    assert.equal(escritura.parametros.tipoPersonal, 'Fundacion');
    assert.equal(escritura.parametros.idRol, 8);
    assert.equal(escritura.parametros.rolAnterior, 'MedicoFundacion');
    assert.ok(await bcrypt.compare(usuario.contrasena, escritura.parametros.contrasena));
    assert.equal((await app.ejecutar('put /api/usuarios/:id', { ...usuario, contrasena: '', estado: 'Inactivo' })).status, 200);
    escritura = app.consultas.at(-1);
    assert.ok(!escritura.sql.includes('contrasena ='));
    assert.equal(escritura.parametros.estado, 'Inactivo');
    assert.equal((await servidor({ correoDuplicado: true }).ejecutar('post /api/usuarios', usuario)).status, 409);
    assert.equal((await servidor({ errorInsert: 2627 }).ejecutar('post /api/usuarios', usuario)).status, 409);
    assert.equal((await servidor({ rolInvalido: true }).ejecutar('post /api/usuarios', usuario)).status, 400);
    assert.equal((await servidor().ejecutar('post /api/usuarios', { ...usuario, tipo_personal: 'Otro' })).status, 400);
    assert.equal((await servidor().ejecutar('post /api/usuarios', { ...usuario, id_rol: 'Administrador' })).status, 400);
});

test('usuarios y solicitudes siguen guardando contra el esquema anterior sin columnas nuevas', async () => {
    const app = servidor({ migrado: false });
    assert.equal((await app.ejecutar('post /api/usuarios', { ...usuario, id_rol: -1 })).status, 200);
    assert.ok(!app.consultas.at(-1).sql.includes('tipo_personal'));
    assert.equal((await app.ejecutar('post /api/usuarios', { ...usuario, id_rol: -2 })).status, 503);
    const solicitud = { idResidente: 1, motivo: 'Control', especialidad: 'Geriatría', enfermero: 'Prueba' };
    assert.equal((await app.ejecutar('post /api/solicitudes', solicitud)).status, 200);
    assert.equal((await app.ejecutar('post /api/solicitudes', { ...solicitud, especialidad: 'Nueva' })).status, 400);
    assert.equal((await servidor().ejecutar('post /api/solicitudes', { ...solicitud, especialidad: 'Nueva' })).status, 200);
    assert.equal((await servidor({ especialidadInvalida: true }).ejecutar('post /api/solicitudes', solicitud)).status, 400);
});

test('scripts SQL preservan hashes, IDs, estados e históricos y son transaccionales', () => {
    const migracion = fs.readFileSync(path.join(root, 'sql/003_migrar_usuarios.sql'), 'utf8');
    assert.match(migracion, /COALESCE\(u.tipo_personal/);
    assert.match(migracion, /FOREIGN KEY \(id_rol\)/);
    assert.match(migracion, /ROLLBACK/);
    assert.doesNotMatch(migracion, /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE|SET\s+(contrasena|estado|id_usuario)\s*=/i);
    const especialidades = fs.readFileSync(path.join(root, 'sql/002_especialidades.sql'), 'utf8');
    assert.match(especialidades, /UNION SELECT LTRIM\(RTRIM\(especialidad\)\)/);
});


test('migración parcial y datos inválidos bloquean login y rutas protegidas sin fallback', async () => {
    for (const opciones of [{ migrado: false, parcial: true }, { datosInvalidos: true }]) {
        const app = servidor(opciones);
        for (const ruta of ['post /api/login', 'get /api/usuarios', 'post /api/usuarios']) {
            const r = await app.ejecutar(ruta, { ...usuario, correo: 'ana@example.test' });
            assert.equal(r.status, 503);
            assert.match(r.payload.message, /migración.*incompleta/);
        }
        assert.ok(!app.consultas.some(c => /INSERT INTO|UPDATE dbo/.test(c.sql)));
    }
    const desconocido = servidor({ migrado: false, actor: { rol: 'Desconocido' } });
    assert.equal((await desconocido.ejecutar('post /api/login', usuario)).status, 403);
    assert.equal((await desconocido.ejecutar('get /api/usuarios')).status, 403);
});


test('errores al guardar usuario permanecen en el modal y conservan campos', async () => {
    const fuente = fs.readFileSync(path.join(root, 'frontend/usuarios/usuarios.js'), 'utf8');
    const guardar = fuente.slice(fuente.indexOf('async function guardarUsuario()'), fuente.indexOf('//descativar'));
    const mensajes = fuente.slice(fuente.indexOf('function limpiarErrorUsuario()'), fuente.indexOf('//mesnajes del cerrar sesion'));
    for (const status of [409, 403, 500, 'red']) {
        const valores = { idUsuario: '', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.test',
            telefono: '', rol: '8', tipoPersonal: 'Asilo', estado: 'Activo', contrasena: 'Prueba123!' };
        const elementos = Object.fromEntries(Object.entries(valores).map(([k, value]) => [k, { value }]));
        elementos.mensajeUsuario = { textContent: '', replaceChildren() { this.textContent = ''; } };
        let cerrado = false;
        const boton = { disabled: false };
        const contexto = vm.createContext({ document: { getElementById: id => elementos[id] }, btnGuardarUsuario: boton,
            modalUsuario: { hide() { cerrado = true; } }, window: { location: {} }, console: { error() {} },
            mostrarMensaje() { assert.fail('El error no debe salir del modal'); }, cargarUsuarios() {},
            async fetch() { if (status === 'red') throw new Error('sin red');
                return { status, ok: false, json: async () => ({ message: 'Error amigable' }) }; } });
        vm.runInContext(mensajes + guardar, contexto);
        await contexto.guardarUsuario();
        assert.ok(elementos.mensajeUsuario.textContent);
        assert.equal(cerrado, false);
        assert.equal(boton.disabled, false);
        for (const [id, valor] of Object.entries(valores)) assert.equal(elementos[id].value, valor);
    }
});
