// ==========================================================
// ASILO CABEZA DE ALGODÓN
// BACKEND PRINCIPAL
// ==========================================================


// ==========================================================
// 1. CONFIGURACIÓN Y DEPENDENCIAS
// ==========================================================

// Carga las variables privadas del archivo .env
require('dotenv').config();

const express = require('express');
const sql = require('mssql');
const erroresDb = require('./config/errores-db');
// mssql reutiliza su pool global; escuchar errores evita eventos sin manejar.
sql.on?.('error', error => console.error('SQL pool:', error.code || error.name));
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const formatos = require('../frontend/compartido/formatos');

// Configuración de conexión a SQL Server
const dbConfig = require('./config/db');

const app = express();
const produccion = process.env.NODE_ENV === 'production';
// Activar solo detrás del proxy conocido de App Service, no confiar en cualquier origen.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);


// ==========================================================
// 2. MIDDLEWARE GENERAL
// ==========================================================

// Permite recibir JSON desde el frontend
app.use(express.json());

// Actualmente se mantiene CORS.
// Como frontend y backend funcionan desde localhost:3000,
// más adelante podemos revisar si todavía lo necesitamos.
app.use(cors());

// Permite leer cookies como req.cookies.token
app.use(cookieParser());

// Sirve los archivos del frontend desde Express.
// Gracias a esto usamos http://localhost:3000
app.use(
    express.static(
        path.join(__dirname, '../frontend')
    )
);


// ==========================================================
// 3. MIDDLEWARE DE SEGURIDAD
// ==========================================================


// ----------------------------------------------------------
// Verificar sesión JWT
// ----------------------------------------------------------

// Compatibilidad temporal: estos valores solo traducen el esquema antiguo.
const rolesAnteriores = [
    { id_rol: -1, nombre: 'Administrador', anterior: 'Admin', tipo_personal: 'Asilo' },
    { id_rol: -2, nombre: 'Médico Fundación', anterior: 'MedicoFundacion', tipo_personal: 'Fundacion' }
];
const especialidadesAnteriores = ['Cardiología', 'Medicina Interna', 'Neurología', 'Geriatría', 'Traumatología'];

async function obtenerEsquema(pool) {
    const resultado = await pool.request().query(`
        SELECT CASE WHEN COL_LENGTH('dbo.Usuarios', 'tipo_personal') IS NOT NULL
            AND COL_LENGTH('dbo.Usuarios', 'id_rol') IS NOT NULL
            AND OBJECT_ID('dbo.Roles', 'U') IS NOT NULL
            AND COL_LENGTH('dbo.Roles', 'id_rol') IS NOT NULL
            AND COL_LENGTH('dbo.Roles', 'nombre') IS NOT NULL
            AND COL_LENGTH('dbo.Roles', 'estado') IS NOT NULL
            AND (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Usuarios')
                AND name IN ('tipo_personal', 'id_rol') AND is_nullable = 0) = 2
            AND EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.Usuarios')
                AND name = 'CK_Usuarios_TipoPersonal' AND is_disabled = 0 AND is_not_trusted = 0)
            AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('dbo.Usuarios')
                AND name = 'FK_Usuarios_Roles' AND referenced_object_id = OBJECT_ID('dbo.Roles')
                AND is_disabled = 0 AND is_not_trusted = 0)
            THEN 1 ELSE 0 END AS usuariosMigrados,
            CASE WHEN COL_LENGTH('dbo.Usuarios', 'tipo_personal') IS NOT NULL
                OR COL_LENGTH('dbo.Usuarios', 'id_rol') IS NOT NULL THEN 1 ELSE 0 END AS usuariosIniciados,
            CASE WHEN OBJECT_ID('dbo.Especialidades', 'U') IS NOT NULL THEN 1 ELSE 0 END AS especialidades
    `);
    const esquema = resultado.recordset[0];
    let incompleto = esquema.usuariosIniciados && !esquema.usuariosMigrados;
    if (esquema.usuariosMigrados) {
        // Solo se compila esta consulta cuando existen las columnas nuevas.
        const invalidos = await pool.request().query(`
            SELECT TOP (1) u.id_usuario FROM dbo.Usuarios u
            LEFT JOIN dbo.Roles r ON r.id_rol = u.id_rol
            WHERE u.tipo_personal IS NULL OR u.tipo_personal NOT IN ('Asilo', 'Fundacion')
                OR u.id_rol IS NULL OR r.id_rol IS NULL
        `);
        incompleto = invalidos.recordset.length > 0;
    }
    if (incompleto) {
        const error = new Error('La migración de usuarios está incompleta. Revise y complete el script 003 antes de continuar.');
        error.code = 'MIGRACION_INCOMPLETA';
        throw error;
    }
    return esquema;
}

function normalizarUsuario(usuario, esquema) {
    if (!esquema.usuariosMigrados) {
        const anterior = rolesAnteriores.find(rol => rol.anterior === usuario.rol);
        usuario.tipo_personal = anterior?.tipo_personal || null;
        usuario.id_rol = anterior?.id_rol || null;
        usuario.rol = anterior?.nombre || usuario.rol;
    }
    return usuario;
}

async function verificarToken(req, res, next) {

    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado. Debe iniciar sesión.'
        });
    }

    let sesion;
    try {
        sesion = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: 'Sesión inválida o expirada.'
        });
    }

    if (!Number.isInteger(sesion.id) || sesion.id <= 0) {
        return res.status(401).json({ success: false, message: 'Sesión inválida. Inicie sesión nuevamente.' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const esquema = await obtenerEsquema(pool);
        const resultado = await pool.request().input('id', sql.Int, sesion.id).query(`
            SELECT u.id_usuario, u.estado,
                ${esquema.usuariosMigrados ? 'u.tipo_personal, u.id_rol' : 'u.rol'}
            FROM dbo.Usuarios u WHERE u.id_usuario = @id
        `);
        const usuario = resultado.recordset[0];
        if (!usuario || usuario.estado !== 'Activo') {
            return res.status(401).json({ success: false, message: 'La sesión ya no está disponible. Inicie sesión.' });
        }
        req.usuario = normalizarUsuario(usuario, esquema);
        req.esquema = esquema;
        next();
    } catch (err) {
        console.error(err);
        if (erroresDb.responder(err, res)) return;
        return res.status(503).json({ success: false, message: err.code === 'MIGRACION_INCOMPLETA'
            ? err.message : 'No se pudo verificar la sesión. Intente nuevamente.' });
    }
}


// ----------------------------------------------------------
// Acceso administrativo por tipo de personal; el nombre se conserva por compatibilidad.
// ----------------------------------------------------------

function soloAdmin(req, res, next) {

    if (req.usuario.tipo_personal !== 'Asilo') {

        return res.status(403).json({
            success: false,
            message: 'No tiene permisos para realizar esta acción.'
        });
    }

    next();
}


// ----------------------------------------------------------
// Permitir solamente Fundación
// ----------------------------------------------------------
// Lo utilizaremos cuando la Fundación programe solicitudes
// y posteriormente registre visitas médicas.

function soloFundacion(req, res, next) {

    if (req.usuario.tipo_personal !== 'Fundacion') {

        return res.status(403).json({
            success: false,
            message: 'Esta acción corresponde a la Fundación.'
        });
    }

    next();
}


// Finanzas se incorpora sin dividir ni reemplazar los módulos existentes.
const finanzas = require('./finanzas')({ app, sql, dbConfig, verificarToken, soloAdmin });
require('./reportes')({ app, sql, dbConfig, verificarToken });

// ==========================================================
// 4. AUTENTICACIÓN
// ==========================================================


// ----------------------------------------------------------
// LOGIN
// ----------------------------------------------------------

app.post('/api/login', async (req, res) => {

    const { correo, contrasena } = req.body;

    if (typeof correo !== 'string' || !correo.trim() || correo.length > 100 ||
        typeof contrasena !== 'string' || !contrasena) {

        return res.status(400).json({
            success: false,
            message: 'Correo y contraseña son obligatorios.'
        });
    }

    try {

        const pool = await sql.connect(dbConfig);

        const esquema = await obtenerEsquema(pool);

        const result = await pool.request()
            .input('correo', sql.VarChar(100), correo.trim())
            .query(`
                SELECT
                    u.id_usuario, u.correo, u.contrasena, u.nombres, u.apellidos,
                    ${esquema.usuariosMigrados ? 'u.tipo_personal, u.id_rol' : 'u.rol'}
                FROM dbo.Usuarios u
                WHERE u.correo = @correo
                AND u.estado = 'Activo'
            `);

        if (result.recordset.length === 0) {

            return res.status(401).json({
                success: false,
                message: 'El correo o la contraseña son incorrectos.'
            });
        }

        const usuario = normalizarUsuario(result.recordset[0], esquema);

        const contrasenaCorrecta = await bcrypt.compare(
            contrasena,
            usuario.contrasena
        );

        if (!contrasenaCorrecta) {

            return res.status(401).json({
                success: false,
                message: 'El correo o la contraseña son incorrectos.'
            });
        }

        if (!['Asilo', 'Fundacion'].includes(usuario.tipo_personal)) {
            return res.status(403).json({ success: false, message: 'El usuario requiere revisión de su tipo de personal.' });
        }

        // Creamos token válido durante 2 horas
        const token = jwt.sign(
            {
                id: usuario.id_usuario,
                tipo_personal: usuario.tipo_personal
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '2h'
            }
        );

        // Guardamos JWT en cookie HttpOnly
        res.cookie('token', token, {
            httpOnly: true,
            secure: produccion, // HTTPS en producción; HTTP local conserva compatibilidad.
            sameSite: 'lax',
            maxAge: 2 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            tipo_personal: usuario.tipo_personal,
            nombres: usuario.nombres,
            apellidos: usuario.apellidos
        });

    } catch (err) {

        console.error(err);
        if (erroresDb.responder(err, res)) return;

        res.status(err.code === 'MIGRACION_INCOMPLETA' ? 503 : 500).json({
            success: false,
            message: err.code === 'MIGRACION_INCOMPLETA' ? err.message : 'Error al conectar con la base de datos.'
        });
    }
});


// ----------------------------------------------------------
// LOGOUT
// ----------------------------------------------------------

app.post('/api/logout', (req, res) => {

    res.clearCookie('token', {
        httpOnly: true,
        secure: produccion,
        sameSite: 'lax'
    });

    res.json({
        success: true,
        message: 'Sesión cerrada correctamente.'
    });
});


// ==========================================================
// 5. RESIDENTES + FICHA MÉDICA
// ==========================================================
//
// Administrador:
//   POST   /api/huespedes
//   GET    /api/huespedes
//   PUT    /api/huespedes/:id
//   DELETE /api/huespedes/:id
//
// Todo residente se crea junto con su FichaMedica.
// ==========================================================


// ----------------------------------------------------------
// CREAR RESIDENTE + FICHA MÉDICA
// ----------------------------------------------------------

app.post(
    '/api/huespedes',
    verificarToken,
    soloAdmin,
    async (req, res) => {

        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);

        try {

            await transaction.begin();
            await finanzas.prepararTransaccion(transaction);

            const resultResidente =
                await new sql.Request(transaction)

                    .input('nombres', sql.VarChar, req.body.nombres)
                    .input('apellidos', sql.VarChar, req.body.apellidos)
                    .input('dpi', sql.VarChar, req.body.dpi)
                    .input('fechaNacimiento', sql.Date, req.body.fechaNacimiento)
                    .input('genero', sql.VarChar, req.body.genero)
                    .input('tipoSangre', sql.VarChar, req.body.tipoSangre)
                    .input('alergias', sql.VarChar, req.body.alergias)

                    .input(
                        'requiereAsistencia',
                        sql.Bit,
                        req.body.requiereAsistencia
                    )

                    .input(
                        'descripcionAsistencia',
                        sql.VarChar,
                        req.body.descripcionAsistencia
                    )

                    .input(
                        'responsable',
                        sql.VarChar,
                        req.body.responsable
                    )

                    .input(
                        'parentesco',
                        sql.VarChar,
                        req.body.parentesco
                    )

                    .input(
                        'telefonoEmergencia',
                        sql.VarChar,
                        req.body.telefonoEmergencia
                    )

                    .input(
                        'cuotaMensual',
                        sql.Decimal(10, 2),
                        req.body.cuotaMensual
                    )

                    .query(`
                        INSERT INTO Huespedes (
                            nombres,
                            apellidos,
                            dpi,
                            fecha_nacimiento,
                            genero,
                            tipo_sangre,
                            alergias,
                            requiere_asistencia_especial,
                            descripcion_asistencia,
                            nombre_responsable,
                            parentesco,
                            telefono_emergencia,
                            cuota_mensual
                        )

                        OUTPUT INSERTED.id_residente

                        VALUES (
                            @nombres,
                            @apellidos,
                            @dpi,
                            @fechaNacimiento,
                            @genero,
                            @tipoSangre,
                            @alergias,
                            @requiereAsistencia,
                            @descripcionAsistencia,
                            @responsable,
                            @parentesco,
                            @telefonoEmergencia,
                            @cuotaMensual
                        )
                    `);

            const idResidente =
                resultResidente.recordset[0].id_residente;


            await finanzas.registrarCuota(transaction, idResidente, req.body.cuotaMensual, req.usuario.id_usuario, true);

            // Creamos automáticamente la ficha médica
            await new sql.Request(transaction)

                .input(
                    'idResidente',
                    sql.Int,
                    idResidente
                )

                .input(
                    'psicopatologias',
                    sql.VarChar,
                    req.body.psicopatologias
                )

                .input(
                    'padecimientos',
                    sql.VarChar,
                    req.body.padecimientos
                )

                .input(
                    'medicamentosHabituales',
                    sql.VarChar,
                    req.body.medicamentosHabituales
                )

                .input(
                    'antecedentes',
                    sql.VarChar,
                    req.body.antecedentes
                )

                .input(
                    'observaciones',
                    sql.VarChar,
                    req.body.observaciones
                )

                .query(`
                    INSERT INTO FichaMedica (
                        id_residente,
                        psicopatologias,
                        padecimientos,
                        medicamentos_habituales,
                        antecedentes,
                        observaciones
                    )

                    VALUES (
                        @idResidente,
                        @psicopatologias,
                        @padecimientos,
                        @medicamentosHabituales,
                        @antecedentes,
                        @observaciones
                    )
                `);

            await transaction.commit();

            res.json({
                success: true,
                message: 'Residente y ficha médica registrados exitosamente.'
            });

        } catch (err) {

            try {
                await transaction.rollback();
            } catch (_) {
                // La transacción ya no estaba activa
            }

            console.error(err);
        if (erroresDb.responder(err, res)) return;

            if (
                [2601, 2627].includes(err.number) ||
                (err.message && err.message.includes('UNIQUE KEY'))
            ) {

                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un residente registrado con ese DPI.'
                });
            }

            if (responderValidacionResidente(err, res)) return;

            res.status(500).json({
                success: false,
                message: 'No se pudo registrar el residente. Revise los datos e intente nuevamente.'
            });
        }
    }
);


// ----------------------------------------------------------
// LISTAR RESIDENTES + FICHA MÉDICA
// ----------------------------------------------------------

// Consultas de solo lectura para Fundación, sin datos administrativos.
// Solo mensajes de negocio conocidos; nunca transportar texto arbitrario del driver.
function responderValidacionResidente(error, res) {
    const mensajes = new Map([
        ['Ingrese un importe válido con hasta dos decimales.', 400],
        ['El importe está fuera del rango permitido.', 400],
        ['La cuota mensual excede el límite permitido.', 400],
        ['La migración 007 está incompleta.', 503],
        ['La migración financiera está incompleta. Revise el script 005 antes de continuar.', 503],
        ['La migración financiera no está confirmada. Revise el script 005.', 503]
    ]);
    const estado = mensajes.get(error.message);
    if (!estado || error.status !== estado || error.number) return false;
    res.status(estado).json({ success: false, message: error.message });
    return true;
}

function idResidenteValido(valor) {
    return typeof valor === 'string' && /^[1-9]\d*$/.test(valor) && Number(valor) <= 2147483647;
}

app.get('/api/huespedes/buscar', verificarToken, soloFundacion, async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().replace(/\s+/g, ' ') : '';
    if (q.length < 2 || q.length > 100) return res.status(400).json({ success: false, message: 'Escriba entre 2 y 100 caracteres para buscar.' });
    try {
        const pool = await sql.connect(dbConfig);
        const resultado = await pool.request().input('busqueda', sql.VarChar(100), q).query(`
            SELECT TOP (20) h.id_residente, h.nombres, h.apellidos, h.dpi
            FROM Huespedes h
            WHERE CHARINDEX(@busqueda, CONCAT(h.nombres, ' ', h.apellidos)) > 0
                OR CHARINDEX(@busqueda, COALESCE(h.dpi, '')) > 0
            ORDER BY h.apellidos, h.nombres, h.id_residente
        `);
        res.json({ success: true, residentes: resultado.recordset });
    } catch (err) {
        console.error(err);
        if (erroresDb.responder(err, res)) return;
        res.status(500).json({ success: false, message: 'No se pudo buscar residentes. Intente nuevamente.' });
    }
});

app.get('/api/huespedes/:id/ficha-medica', verificarToken, soloFundacion, async (req, res) => {
    if (!idResidenteValido(req.params.id)) return res.status(400).json({ success: false, message: 'Identificador de residente inválido.' });
    try {
        const pool = await sql.connect(dbConfig);
        const resultado = await pool.request().input('idResidente', sql.Int, Number(req.params.id)).query(`
            SELECT h.id_residente, h.nombres, h.apellidos, h.dpi, h.fecha_nacimiento, h.genero,
                h.tipo_sangre, h.alergias, h.requiere_asistencia_especial, h.descripcion_asistencia,
                CASE WHEN f.id_residente IS NULL THEN 0 ELSE 1 END AS ficha_existe,
                f.psicopatologias, f.padecimientos, f.medicamentos_habituales, f.antecedentes, f.observaciones
            FROM Huespedes h LEFT JOIN FichaMedica f ON f.id_residente = h.id_residente
            WHERE h.id_residente = @idResidente
        `);
        if (!resultado.recordset.length) return res.status(404).json({ success: false, message: 'Residente no encontrado.' });
        res.json({ success: true, ficha: resultado.recordset[0] });
    } catch (err) {
        console.error(err);
        if (erroresDb.responder(err, res)) return;
        res.status(500).json({ success: false, message: 'No se pudo consultar la ficha médica. Intente nuevamente.' });
    }
});

app.get(
    '/api/huespedes',
    verificarToken,
    soloAdmin,
    async (req, res) => {

        try {

            const pool = await sql.connect(dbConfig);

            const result = await pool.request().query(`
                SELECT
                    h.id_residente,
                    h.nombres,
                    h.apellidos,
                    h.dpi,
                    h.fecha_nacimiento,
                    h.genero,
                    h.tipo_sangre,
                    h.alergias,
                    h.requiere_asistencia_especial,
                    h.descripcion_asistencia,
                    h.nombre_responsable,
                    h.parentesco,
                    h.telefono_emergencia,
                    h.cuota_mensual,
                    h.estado,
                    h.fecha_registro,

                    f.psicopatologias,
                    f.padecimientos,
                    f.medicamentos_habituales,
                    f.antecedentes,
                    f.observaciones

                FROM Huespedes h

                LEFT JOIN FichaMedica f
                    ON f.id_residente = h.id_residente

                ORDER BY
                    h.estado ASC,
                    h.apellidos ASC,
                    h.nombres ASC
            `);

            res.json({
                success: true,
                huespedes: result.recordset
            });

        } catch (err) {

            console.error(err);
        if (erroresDb.responder(err, res)) return;

            res.status(500).json({
                success: false,
                message: 'Error al consultar los residentes.'
            });
        }
    }
);


// ----------------------------------------------------------
// EDITAR RESIDENTE + FICHA MÉDICA
// ----------------------------------------------------------

app.put(
    '/api/huespedes/:id',
    verificarToken,
    soloAdmin,
    async (req, res) => {

        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);

        try {

            await transaction.begin();
            await finanzas.prepararTransaccion(transaction);
            const cambioCuota = await finanzas.registrarCuota(transaction, Number(req.params.id), req.body.cuotaMensual, req.usuario.id_usuario);

            await new sql.Request(transaction)

                .input('id', sql.Int, req.params.id)
                .input('nombres', sql.VarChar, req.body.nombres)
                .input('apellidos', sql.VarChar, req.body.apellidos)
                .input('dpi', sql.VarChar, req.body.dpi)

                .input(
                    'fechaNacimiento',
                    sql.Date,
                    req.body.fechaNacimiento
                )

                .input('genero', sql.VarChar, req.body.genero)

                .input(
                    'tipoSangre',
                    sql.VarChar,
                    req.body.tipoSangre
                )

                .input(
                    'alergias',
                    sql.VarChar,
                    req.body.alergias
                )

                .input(
                    'requiereAsistencia',
                    sql.Bit,
                    req.body.requiereAsistencia
                )

                .input(
                    'descripcionAsistencia',
                    sql.VarChar,
                    req.body.descripcionAsistencia
                )

                .input(
                    'responsable',
                    sql.VarChar,
                    req.body.responsable
                )

                .input(
                    'parentesco',
                    sql.VarChar,
                    req.body.parentesco
                )

                .input(
                    'telefonoEmergencia',
                    sql.VarChar,
                    req.body.telefonoEmergencia
                )

                .input(
                    'cuotaMensual',
                    sql.Decimal(10, 2),
                    req.body.cuotaMensual
                )

                .query(`
                    UPDATE Huespedes

                    SET
                        nombres = @nombres,
                        apellidos = @apellidos,
                        dpi = @dpi,
                        fecha_nacimiento = @fechaNacimiento,
                        genero = @genero,
                        tipo_sangre = @tipoSangre,
                        alergias = @alergias,
                        requiere_asistencia_especial = @requiereAsistencia,
                        descripcion_asistencia = @descripcionAsistencia,
                        nombre_responsable = @responsable,
                        parentesco = @parentesco,
                        telefono_emergencia = @telefonoEmergencia,
                        cuota_mensual = @cuotaMensual

                    WHERE id_residente = @id
                `);


            // Actualiza la ficha.
            // Si por alguna razón no existe, la crea.
            await new sql.Request(transaction)

                .input(
                    'idResidente',
                    sql.Int,
                    req.params.id
                )

                .input(
                    'psicopatologias',
                    sql.VarChar,
                    req.body.psicopatologias
                )

                .input(
                    'padecimientos',
                    sql.VarChar,
                    req.body.padecimientos
                )

                .input(
                    'medicamentosHabituales',
                    sql.VarChar,
                    req.body.medicamentosHabituales
                )

                .input(
                    'antecedentes',
                    sql.VarChar,
                    req.body.antecedentes
                )

                .input(
                    'observaciones',
                    sql.VarChar,
                    req.body.observaciones
                )

                .query(`
                    MERGE FichaMedica AS destino

                    USING (
                        SELECT @idResidente AS id_residente
                    ) AS origen

                    ON destino.id_residente = origen.id_residente

                    WHEN MATCHED THEN

                        UPDATE SET
                            psicopatologias = @psicopatologias,
                            padecimientos = @padecimientos,
                            medicamentos_habituales = @medicamentosHabituales,
                            antecedentes = @antecedentes,
                            observaciones = @observaciones,
                            fecha_actualizacion = GETDATE()

                    WHEN NOT MATCHED THEN

                        INSERT (
                            id_residente,
                            psicopatologias,
                            padecimientos,
                            medicamentos_habituales,
                            antecedentes,
                            observaciones
                        )

                        VALUES (
                            @idResidente,
                            @psicopatologias,
                            @padecimientos,
                            @medicamentosHabituales,
                            @antecedentes,
                            @observaciones
                        );
                `);

            await transaction.commit();

            res.json({
                success: true,
                message: 'Residente actualizado exitosamente.' + (cambioCuota ? ` La nueva cuota se aplica desde ${formatos.periodo(cambioCuota.desde)} a mensualidades no generadas.` : '')
            });

        } catch (err) {

            try {
                await transaction.rollback();
            } catch (_) {
                // La transacción ya no estaba activa
            }

            console.error(err);
        if (erroresDb.responder(err, res)) return;

            if (
                [2601, 2627].includes(err.number) ||
                (err.message && err.message.includes('UNIQUE KEY'))
            ) {

                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un residente registrado con ese DPI.'
                });
            }

            if (responderValidacionResidente(err, res)) return;

            res.status(500).json({
                success: false,
                message: 'No se pudo actualizar el residente. Revise los datos e intente nuevamente.'
            });
        }
    }
);


// ----------------------------------------------------------
// RETIRAR RESIDENTE
// Baja lógica: no elimina su información.
// ----------------------------------------------------------

app.delete(
    '/api/huespedes/:id',
    verificarToken,
    soloAdmin,
    async (req, res) => {

        try {

            const result = await finanzas.retirarResidente(req.params.id);

            if (result.rowsAffected[0] === 0) {

                return res.status(404).json({
                    success: false,
                    message: 'Residente no encontrado.'
                });
            }

            res.json({
                success: true,
                message: 'Residente retirado correctamente.'
            });

        } catch (err) {

            console.error(err);
        if (erroresDb.responder(err, res)) return;

            res.status(500).json({
                success: false,
                message: 'Error al retirar al residente.'
            });
        }
    }
);


// ==========================================================
// 6. USUARIOS
// ==========================================================
//
// Solo el Administrador puede administrar usuarios.
//
// POST   /api/usuarios
// GET    /api/usuarios
// PUT    /api/usuarios/:id
// DELETE /api/usuarios/:id
// ==========================================================


// ----------------------------------------------------------
// CREAR USUARIO
// ----------------------------------------------------------

// Crear y editar comparten validación, conservando contraseña opcional al editar.
async function guardarUsuario(req, res) {
    const editando = req.params.id !== undefined;
    const id = Number(req.params.id);
    const { nombres, apellidos, correo, telefono, contrasena, tipo_personal, id_rol } = req.body;
    const estado = editando ? req.body.estado : 'Activo';
    if ((editando && (!Number.isInteger(id) || id <= 0 || id > 2147483647)) ||
        !['Asilo', 'Fundacion'].includes(tipo_personal) || !Number.isInteger(id_rol) || id_rol === 0 ||
        id_rol < -2 || id_rol > 2147483647 ||
        ![nombres, apellidos, correo].every(v => typeof v === 'string' && v.trim() && v.length <= 100) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) ||
        (telefono != null && (typeof telefono !== 'string' || telefono.length > 20)) ||
        !['Activo', 'Inactivo', ...(editando ? [null] : [])].includes(estado)) {
        return res.status(400).json({ success: false, message: 'Revise nombres, apellidos, correo, tipo de personal, rol y estado.' });
    }
    if ((contrasena != null && typeof contrasena !== 'string') ||
        (!editando && !contrasena) || (contrasena && contrasena.length < 8)) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres; al editar puede dejarla vacía.' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const esquema = req.esquema;
        const rolAnterior = rolesAnteriores.find(r => r.tipo_personal === tipo_personal).anterior;
        if (esquema.usuariosMigrados) {
            const rol = await pool.request().input('idRol', sql.Int, id_rol).query(`
                SELECT id_rol FROM dbo.Roles WHERE id_rol = @idRol AND estado = 'Activo'
            `);
            if (!rol.recordset.length) return res.status(400).json({ success: false, message: 'Seleccione un rol disponible.' });
        } else {
            const compatible = rolesAnteriores.find(r => r.id_rol === id_rol && r.tipo_personal === tipo_personal);
            if (!compatible) return res.status(503).json({ success: false, message: 'Ejecute la migración de usuarios para asignar roles independientes del tipo de personal.' });
        }
        const duplicado = await pool.request()
            .input('correo', sql.VarChar(100), correo.trim()).input('id', sql.Int, editando ? id : 0)
            .query('SELECT id_usuario FROM dbo.Usuarios WHERE correo = @correo AND id_usuario <> @id');
        if (duplicado.recordset.length) return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese correo.' });
        const request = pool.request()
            .input('nombres', sql.VarChar(100), nombres.trim())
            .input('apellidos', sql.VarChar(100), apellidos.trim())
            .input('correo', sql.VarChar(100), correo.trim())
            .input('telefono', sql.VarChar(20), telefono?.trim() || null)
            .input('rolAnterior', sql.VarChar(50), rolAnterior)
            .input('estado', sql.VarChar(20), estado);
        if (esquema.usuariosMigrados) {
            request.input('tipoPersonal', sql.VarChar(20), tipo_personal).input('idRol', sql.Int, id_rol);
        }
        if (contrasena) request.input('contrasena', sql.VarChar(100), await bcrypt.hash(contrasena, 10));
        let resultado;
        if (editando) {
            resultado = await request.input('id', sql.Int, id).query(`
                UPDATE dbo.Usuarios SET nombres = @nombres, apellidos = @apellidos, correo = @correo,
                    telefono = @telefono, estado = @estado, rol = @rolAnterior
                    ${esquema.usuariosMigrados ? ', tipo_personal = @tipoPersonal, id_rol = @idRol' : ''}
                    ${contrasena ? ', contrasena = @contrasena' : ''}
                WHERE id_usuario = @id
            `);
            if (!resultado.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        } else {
            await request.query(`
                INSERT INTO dbo.Usuarios (nombres, apellidos, correo, telefono, contrasena, rol, estado
                    ${esquema.usuariosMigrados ? ', tipo_personal, id_rol' : ''})
                VALUES (@nombres, @apellidos, @correo, @telefono, @contrasena, @rolAnterior, @estado
                    ${esquema.usuariosMigrados ? ', @tipoPersonal, @idRol' : ''})
            `);
        }
        res.json({ success: true, message: editando ? 'Usuario actualizado correctamente.' : 'Usuario creado exitosamente.' });
    } catch (err) {
        console.error(err);
        if (erroresDb.responder(err, res)) return;
        const duplicado = [2601, 2627].includes(err.number);
        res.status(duplicado ? 409 : 500).json({ success: false,
            message: duplicado ? 'Ya existe un usuario con ese correo.' : 'No se pudo guardar el usuario.' });
    }
}

app.post('/api/usuarios', verificarToken, soloAdmin, guardarUsuario);
app.put('/api/usuarios/:id', verificarToken, soloAdmin, guardarUsuario);

app.get('/api/usuarios', verificarToken, soloAdmin, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const esquema = req.esquema;
        const resultado = await pool.request().query(`
            SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, u.telefono, u.estado,
                ${esquema.usuariosMigrados ? 'u.tipo_personal, u.id_rol, r.nombre AS rol' : 'u.rol'}
            FROM dbo.Usuarios u
            ${esquema.usuariosMigrados ? 'LEFT JOIN dbo.Roles r ON r.id_rol = u.id_rol' : ''}
            ORDER BY u.nombres, u.apellidos
        `);
        res.json({ success: true, usuarios: resultado.recordset.map(u => normalizarUsuario(u, esquema)),
            migracionPendiente: !esquema.usuariosMigrados });
    } catch (err) {
        console.error(err);
        if (erroresDb.responder(err, res)) return;
        res.status(500).json({ success: false, message: 'Error al obtener los usuarios.' });
    }
});

// ----------------------------------------------------------
// DESACTIVAR USUARIO
// Baja lógica.
// ----------------------------------------------------------

app.delete(
    '/api/usuarios/:id',
    verificarToken,
    soloAdmin,
    async (req, res) => {

        const { id } = req.params;

        try {

            const pool = await sql.connect(dbConfig);

            const result = await pool.request()

                .input(
                    'id',
                    sql.Int,
                    id
                )

                .query(`
                    UPDATE Usuarios
                    SET estado = 'Inactivo'
                    WHERE id_usuario = @id
                `);


            if (result.rowsAffected[0] === 0) {

                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado.'
                });
            }


            res.json({
                success: true,
                message: 'Usuario desactivado correctamente.'
            });


        } catch (err) {

            console.error(err);
        if (erroresDb.responder(err, res)) return;

            res.status(500).json({
                success: false,
                message: 'Error al desactivar el usuario.'
            });
        }
    }
);


// Catálogos simples: el rol identifica un cargo, nunca otorga permisos.
for (const catalogo of [
    { ruta: 'roles', tabla: 'Roles', id: 'id_rol', limite: 100, flag: 'usuariosMigrados', singular: 'rol' },
    { ruta: 'especialidades', tabla: 'Especialidades', id: 'id_especialidad', limite: 50, flag: 'especialidades', singular: 'especialidad' }
]) {
    app.get(`/api/${catalogo.ruta}`, verificarToken, async (req, res) => {
        if (!['Asilo', 'Fundacion'].includes(req.usuario.tipo_personal)) {
            return res.status(403).json({ success: false, message: 'No tiene acceso a los catálogos.' });
        }
        try {
            if (!req.esquema[catalogo.flag]) {
                const datos = catalogo.ruta === 'roles'
                    ? rolesAnteriores.map(({ id_rol, nombre }) => ({ id_rol, nombre, estado: 'Activo' }))
                    : especialidadesAnteriores.map((nombre, indice) => ({ id_especialidad: -(indice + 1), nombre, estado: 'Activo' }));
                return res.json({ success: true, [catalogo.ruta]: datos, migracionPendiente: true });
            }
            const pool = await sql.connect(dbConfig);
            const resultado = await pool.request().query(`
                SELECT ${catalogo.id}, nombre, estado FROM dbo.${catalogo.tabla} WHERE estado = 'Activo' ORDER BY nombre
            `);
            res.json({ success: true, [catalogo.ruta]: resultado.recordset, migracionPendiente: false });
        } catch (err) {
            console.error(err);
        if (erroresDb.responder(err, res)) return;
            res.status(500).json({ success: false, message: 'No se pudo consultar el catálogo.' });
        }
    });
    app.post(`/api/${catalogo.ruta}`, verificarToken, soloAdmin, async (req, res) => {
        const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
        if (!nombre || nombre.length > catalogo.limite) {
            return res.status(400).json({ success: false, message: `Ingrese un nombre de hasta ${catalogo.limite} caracteres.` });
        }
        if (!req.esquema[catalogo.flag]) {
            return res.status(503).json({ success: false, message: 'El catálogo requiere aplicar primero los scripts SQL de migración.' });
        }
        try {
            const pool = await sql.connect(dbConfig);
            const resultado = await pool.request().input('nombre', sql.VarChar(catalogo.limite), nombre).query(`
                INSERT INTO dbo.${catalogo.tabla} (nombre, estado)
                OUTPUT INSERTED.${catalogo.id}, INSERTED.nombre, INSERTED.estado
                VALUES (@nombre, 'Activo')
            `);
            res.status(201).json({ success: true, message: 'Registro creado correctamente.', [catalogo.singular]: resultado.recordset[0] });
        } catch (err) {
            console.error(err);
        if (erroresDb.responder(err, res)) return;
            const duplicado = [2601, 2627].includes(err.number);
            res.status(duplicado ? 409 : 500).json({ success: false,
                message: duplicado ? 'Ese nombre ya existe en el catálogo (puede estar inactivo).' : 'No se pudo crear el registro.' });
        }
    });
}

// ==========================================================
// 7. SOLICITUDES MÉDICAS
// ==========================================================
//
// FLUJO:
//
// ADMINISTRADOR
//     ↓
// crea solicitud
//     ↓
// PENDIENTE
//     ↓
// FUNDACIÓN
//     ↓
// asigna médico + fecha + hora
//     ↓
// PROGRAMADA
//     ↓
// posteriormente se registra VisitaMedica
//     ↓
// FINALIZADA
//
// Tabla utilizada: SolicitudesMedicas
// ==========================================================


// ----------------------------------------------------------
// CREAR SOLICITUD MÉDICA
// Solo Administrador
// ----------------------------------------------------------

app.post(
    '/api/solicitudes',
    verificarToken,
    soloAdmin,
    async (req, res) => {

        const {
            idResidente,
            motivo,
            especialidad,
            enfermero
        } = req.body;


        // ----------------------------------------------
        // Validación básica
        // ----------------------------------------------

        if (
            !idResidente ||
            !motivo ||
            !especialidad ||
            !enfermero
        ) {

            return res.status(400).json({
                success: false,
                message: 'Complete todos los campos de la solicitud.'
            });
        }


        if (typeof especialidad !== 'string' || !especialidad.trim() || especialidad.length > 50) {
            return res.status(400).json({ success: false, message: 'Seleccione una especialidad válida.' });
        }

        try {

            const pool = await sql.connect(dbConfig);
            let disponible = especialidadesAnteriores.includes(especialidad.trim());
            if (req.esquema.especialidades) {
                const catalogo = await pool.request().input('nombre', sql.VarChar(50), especialidad.trim())
                    .query("SELECT id_especialidad FROM dbo.Especialidades WHERE nombre = @nombre AND estado = 'Activo'");
                disponible = catalogo.recordset.length > 0;
            }
            if (!disponible) return res.status(400).json({ success: false, message: 'La especialidad no está disponible. Actualice el catálogo.' });



            // Verificamos que el residente exista y esté activo
            const residente = await pool.request()

                .input(
                    'idResidente',
                    sql.Int,
                    idResidente
                )

                .query(`
                    SELECT id_residente

                    FROM Huespedes

                    WHERE id_residente = @idResidente
                    AND estado = 'Activo'
                `);


            if (residente.recordset.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: 'El residente no existe o se encuentra inactivo.'
                });
            }


            // Creamos la solicitud.
            // SQL Server coloca automáticamente:
            // fecha_solicitud = GETDATE()
            // estado = Pendiente

            await pool.request()

                .input(
                    'idResidente',
                    sql.Int,
                    idResidente
                )

                .input(
                    'motivo',
                    sql.VarChar(500),
                    motivo
                )

                .input(
                    'especialidad',
                    sql.VarChar(50),
                    especialidad.trim()
                )

                .input(
                    'enfermero',
                    sql.VarChar(150),
                    enfermero
                )

                .query(`
                    INSERT INTO SolicitudesMedicas (
                        id_residente,
                        motivo,
                        especialidad,
                        enfermero
                    )

                    VALUES (
                        @idResidente,
                        @motivo,
                        @especialidad,
                        @enfermero
                    )
                `);


            res.json({
                success: true,
                message: 'Solicitud médica creada correctamente.'
            });


        } catch (err) {

            console.error(err);
        if (erroresDb.responder(err, res)) return;

            res.status(500).json({
                success: false,
                message: 'Error al crear la solicitud médica.'
            });
        }
    }
);


// ----------------------------------------------------------
// LISTAR SOLICITUDES MÉDICAS
// Admin y Fundación pueden consultarlas.
// ----------------------------------------------------------

app.get(
    '/api/solicitudes',
    verificarToken,
    async (req, res) => {

        // Solo permitimos nuestros dos roles conocidos.
        if (
            req.usuario.tipo_personal !== 'Asilo' &&
            req.usuario.tipo_personal !== 'Fundacion'
        ) {

            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para consultar solicitudes.'
            });
        }


        try {

            const pool = await sql.connect(dbConfig);


            const result = await pool.request().query(`
                SELECT
                    s.id_solicitud,
                    s.id_residente,

                    h.nombres,
                    h.apellidos,

                    s.motivo,
                    s.especialidad,
                    s.enfermero,
                    s.fecha_solicitud,
                    s.estado,

                    s.medico,
                    s.fecha_cita,
                    
                    CONVERT(VARCHAR(5), s.hora_cita, 108) AS hora_cita

                FROM SolicitudesMedicas s

                INNER JOIN Huespedes h
                    ON h.id_residente = s.id_residente

                ORDER BY
                    s.fecha_solicitud DESC,
                    s.id_solicitud DESC
            `);


            res.json({
                success: true,
                solicitudes: result.recordset
            });


        } catch (err) {

            console.error(err);
        if (erroresDb.responder(err, res)) return;

            res.status(500).json({
                success: false,
                message: 'Error al consultar las solicitudes médicas.'
            });
        }
    }
);


// ----------------------------------------------------------
// PROGRAMAR SOLICITUD
// Solo Fundación.
//
// Recibe:
//   medico
//   fechaCita
//   horaCita
//
// Pendiente -> Programada
// ----------------------------------------------------------

app.put(
    '/api/solicitudes/:id/programar',
    verificarToken,
    soloFundacion,
    async (req, res) => {

        const { id } = req.params;

        const {
            medico,
            fechaCita,
            horaCita
        } = req.body;


        if (
            !medico ||
            !fechaCita ||
            !horaCita
        ) {

            return res.status(400).json({
                success: false,
                message: 'Médico, fecha y hora son obligatorios.'
            });
        }
        const horariosPermitidos = [
            '09:00', '09:45', '10:30', '11:15', '12:00', '12:45',
            '14:00', '14:45', '15:30', '16:15', '17:00'
        ];

        if (!horariosPermitidos.includes(horaCita)) {
            return res.status(400).json({
                success: false,
                message: 'Seleccione uno de los horarios permitidos.'
            });
        }

        const fechaValida = typeof fechaCita === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(fechaCita) &&
            Number.isFinite(Date.parse(`${fechaCita}T00:00:00Z`)) &&
            new Date(`${fechaCita}T00:00:00Z`).toISOString().slice(0, 10) === fechaCita &&
            fechaCita >= '0001-01-01';

        if (!Number.isInteger(Number(id)) || Number(id) <= 0 || Number(id) > 2147483647 ||
            typeof medico !== 'string' || !medico.trim() || medico.trim().length > 150 ||
            !fechaValida) {
            return res.status(400).json({
                success: false,
                message: 'La solicitud, el médico o la fecha no son válidos.'
            });
        }

        let transaccionCita;
        try {

            const pool = await sql.connect(dbConfig);


            transaccionCita = new sql.Transaction(pool);
            await transaccionCita.begin();
            await finanzas.prepararTransaccion(transaccionCita);
            const result = await new sql.Request(transaccionCita)

                .input(
                    'id',
                    sql.Int,
                    id
                )

                .input(
                    'medico',
                    sql.VarChar(150),
                    medico.trim()
                )

                .input(
                    'fechaCita',
                    sql.Date,
                    fechaCita
                )

                .input(
                    'horaCita',
                    sql.VarChar(5),
                    horaCita
                )

                .query(`
                    UPDATE SolicitudesMedicas

                    SET
                        medico = @medico,
                        fecha_cita = @fechaCita,
                        hora_cita = CAST(@horaCita AS TIME),
                        estado = 'Programada'

                    WHERE id_solicitud = @id
                    AND estado = 'Pendiente'
                `);


            if (result.rowsAffected[0] === 0) {
                await transaccionCita.rollback();

                return res.status(400).json({
                    success: false,
                    message: 'La solicitud no existe o ya no se encuentra pendiente.'
                });
            }


            await finanzas.notificarCita(transaccionCita, Number(id));
            await transaccionCita.commit();
            res.json({
                success: true,
                message: 'Solicitud médica programada correctamente.'
            });


        } catch (err) {
            if (transaccionCita) { try { await transaccionCita.rollback(); } catch (_) {} }

            console.error(err);
        if (erroresDb.responder(err, res)) return;

            res.status(500).json({
                success: false,
                message: 'Error al programar la solicitud médica.'
            });
        }
    }
);


// ----------------------------------------------------------
// CANCELAR SOLICITUD
// Solo Administrador.
//
// Para mantener el flujo sencillo, únicamente permitimos
// cancelar solicitudes que todavía estén Pendientes.
// ----------------------------------------------------------

app.put(
    '/api/solicitudes/:id/cancelar',
    verificarToken,
    soloAdmin,
    async (req, res) => {

        const { id } = req.params;


        try {

            const pool = await sql.connect(dbConfig);


            const result = await pool.request()

                .input(
                    'id',
                    sql.Int,
                    id
                )

                .query(`
                    UPDATE SolicitudesMedicas

                    SET estado = 'Cancelada'

                    WHERE id_solicitud = @id
                    AND estado = 'Pendiente'
                `);


            if (result.rowsAffected[0] === 0) {

                return res.status(400).json({
                    success: false,
                    message: 'La solicitud no existe o ya no puede cancelarse.'
                });
            }


            res.json({
                success: true,
                message: 'Solicitud médica cancelada correctamente.'
            });


        } catch (err) {

            console.error(err);
        if (erroresDb.responder(err, res)) return;

            res.status(500).json({
                success: false,
                message: 'Error al cancelar la solicitud médica.'
            });
        }
    }
);

// ==========================================================
// 8. VISITAS MÉDICAS
// ==========================================================
//
// Una visita médica nace de una solicitud PROGRAMADA.
//
// Fundación registra:
//   - Diagnóstico
//   - Exámenes y resultados
//   - Medicamentos e indicaciones
//   - Costos
//   - Observaciones
//
// El BACKEND calcula:
//   subtotal
//   descuentos independientes de consulta, exámenes y medicamentos
//   total
//
// Al terminar:
//   Solicitud Programada -> Finalizada
// ==========================================================


// ----------------------------------------------------------
// REGISTRAR VISITA MÉDICA
// Solo Fundación
// ----------------------------------------------------------

app.post(
    '/api/visitas',
    verificarToken,
    soloFundacion,
    async (req, res) => {

        const {
            idSolicitud,
            diagnostico,

            examenes,
            resultadosExamenes,
            costoExamenes,

            medicamentos,
            cantidadMedicamentos,
            indicaciones,
            costoMedicamentos,

            costoConsulta,

            descuentoConsulta,
            descuentoExamenes,
            descuentoMedicamentos,

            observaciones
        } = req.body;


        // ==================================================
        // VALIDACIONES BÁSICAS
        // ==================================================

        if (!Number.isInteger(idSolicitud) || idSolicitud <= 0 || idSolicitud > 2147483647 ||
            typeof diagnostico !== 'string' || !diagnostico.trim() || diagnostico.length > 1000) {

            return res.status(400).json({
                success: false,
                message: 'La solicitud y el diagnóstico son obligatorios.'
            });
        }


        // El navegador envía números (0 para costos vacíos), nunca moneda formateada.
        const costos = [costoConsulta, costoExamenes, costoMedicamentos];
        if (costos.some(valor => !Number.isFinite(valor) || valor < 0 || valor > 99999999.99)) {
            return res.status(400).json({
                success: false,
                message: 'Los costos deben ser números entre 0 y Q 99,999,999.99.'
            });
        }

        const porcentajes = [descuentoConsulta, descuentoExamenes, descuentoMedicamentos];
        if (porcentajes.some(valor => !Number.isFinite(valor) || valor < 0 || valor > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Cada descuento debe ser un número entre 0 y 100.'
            });
        }

        const textosOpcionales = [
            [examenes, 1000], [resultadosExamenes, 1500],
            [medicamentos, 1000], [cantidadMedicamentos, 300],
            [indicaciones, 1000], [observaciones, 1500]
        ];
        if (textosOpcionales.some(([valor, limite]) =>
            valor != null && (typeof valor !== 'string' || valor.length > limite))) {
            return res.status(400).json({
                success: false,
                message: 'Revise el formato y la longitud de los datos médicos.'
            });
        }

        // ==================================================
        // CÁLCULO FINANCIERO
        // ==================================================
        //
        // El frontend NO decide estos valores.
        // El backend es quien calcula todo.
        // ==================================================

        // Centavos y centésimas de porcentaje: redondear cada rubro antes de sumar.
        const costosCentavos = costos.map(valor => Math.round((valor + Number.EPSILON) * 100));
        const porcentajesCentesimas = porcentajes.map(valor => Math.round((valor + Number.EPSILON) * 100));
        const [costoConsultaNumero, costoExamenesNumero, costoMedicamentosNumero] =
            costosCentavos.map(valor => valor / 100);
        const [descuentoConsultaNumero, descuentoExamenesNumero, descuentoMedicamentosNumero] =
            porcentajesCentesimas.map(valor => valor / 100);
        const descuentosCentavos = costosCentavos.map((costo, indice) =>
            Math.round(costo * porcentajesCentesimas[indice] / 10000));
        const subtotalCentavos = costosCentavos.reduce((suma, valor) => suma + valor, 0);
        const descuentoCentavos = descuentosCentavos.reduce((suma, valor) => suma + valor, 0);
        const subtotalFinal = subtotalCentavos / 100;
        const descuentoFinal = descuentoCentavos / 100;
        const totalFinal = (subtotalCentavos - descuentoCentavos) / 100;

        if (subtotalFinal > 99999999.99) {
            return res.status(400).json({
                success: false,
                message: 'El subtotal supera el máximo permitido de Q 99,999,999.99.'
            });
        }


        // ==================================================
        // TRANSACCIÓN
        // ==================================================

        let transaction;

        try {

            const pool =
                await sql.connect(dbConfig);

            transaction =
                new sql.Transaction(pool);

            await transaction.begin();
            await finanzas.prepararTransaccion(transaction);


            // ----------------------------------------------
            // 1. VERIFICAR SOLICITUD
            // ----------------------------------------------

            const solicitud =
                await new sql.Request(transaction)

                    .input(
                        'idSolicitud',
                        sql.Int,
                        idSolicitud
                    )

                    .query(`
                        SELECT
                            id_solicitud,
                            estado

                        FROM SolicitudesMedicas WITH (UPDLOCK, HOLDLOCK)

                        WHERE id_solicitud = @idSolicitud
                    `);


            if (solicitud.recordset.length === 0) {

                await transaction.rollback();

                return res.status(404).json({
                    success: false,
                    message: 'La solicitud médica no existe.'
                });
            }


            if (
                solicitud.recordset[0].estado !==
                'Programada'
            ) {

                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message: 'Solo se pueden registrar visitas de solicitudes programadas.'
                });
            }


            // ----------------------------------------------
            // 2. REGISTRAR VISITA
            // ----------------------------------------------

            await new sql.Request(transaction)

                .input(
                    'idSolicitud',
                    sql.Int,
                    idSolicitud
                )

                .input(
                    'diagnostico',
                    sql.VarChar(1000),
                    diagnostico.trim()
                )

                .input(
                    'examenes',
                    sql.VarChar(1000),
                    examenes || null
                )

                .input(
                    'resultadosExamenes',
                    sql.VarChar(1500),
                    resultadosExamenes || null
                )

                .input(
                    'costoExamenes',
                    sql.Decimal(10, 2),
                    costoExamenesNumero
                )

                .input(
                    'medicamentos',
                    sql.VarChar(1000),
                    medicamentos || null
                )

                .input(
                    'cantidadMedicamentos',
                    sql.VarChar(300),
                    cantidadMedicamentos || null
                )

                .input(
                    'indicaciones',
                    sql.VarChar(1000),
                    indicaciones || null
                )

                .input(
                    'costoMedicamentos',
                    sql.Decimal(10, 2),
                    costoMedicamentosNumero
                )

                .input(
                    'costoConsulta',
                    sql.Decimal(10, 2),
                    costoConsultaNumero
                )

                .input(
                    'subtotal',
                    sql.Decimal(10, 2),
                    subtotalFinal
                )

                .input(
                    'descuentoConsulta',
                    sql.Decimal(5, 2),
                    descuentoConsultaNumero
                )

                .input(
                    'descuentoExamenes',
                    sql.Decimal(5, 2),
                    descuentoExamenesNumero
                )

                .input(
                    'descuentoMedicamentos',
                    sql.Decimal(5, 2),
                    descuentoMedicamentosNumero
                )

                .input(
                    'descuento',
                    sql.Decimal(10, 2),
                    descuentoFinal
                )

                .input(
                    'total',
                    sql.Decimal(10, 2),
                    totalFinal
                )

                .input(
                    'observaciones',
                    sql.VarChar(1500),
                    observaciones || null
                )

                .query(`
                    INSERT INTO VisitasMedicas (

                        id_solicitud,
                        diagnostico,

                        examenes,
                        resultados_examenes,
                        costo_examenes,

                        medicamentos,
                        cantidad_medicamentos,
                        indicaciones,
                        costo_medicamentos,

                        costo_consulta,

                        subtotal,
                        porcentaje_descuento,
                        descuento_consulta_porcentaje,
                        descuento_examenes_porcentaje,
                        descuento_medicamentos_porcentaje,
                        descuento,
                        total,

                        observaciones

                    )

                    VALUES (

                        @idSolicitud,
                        @diagnostico,

                        @examenes,
                        @resultadosExamenes,
                        @costoExamenes,

                        @medicamentos,
                        @cantidadMedicamentos,
                        @indicaciones,
                        @costoMedicamentos,

                        @costoConsulta,

                        @subtotal,
                        0, -- Compatibilidad con la columna antigua NOT NULL; no interviene en el cálculo.
                        @descuentoConsulta,
                        @descuentoExamenes,
                        @descuentoMedicamentos,
                        @descuento,
                        @total,

                        @observaciones
                    )
                `);


            // ----------------------------------------------
            // 3. FINALIZAR SOLICITUD
            // ----------------------------------------------

            const finalizacion = await new sql.Request(transaction)

                .input(
                    'idSolicitud',
                    sql.Int,
                    idSolicitud
                )

                .query(`
                    UPDATE SolicitudesMedicas

                    SET estado = 'Finalizada'

                    WHERE id_solicitud = @idSolicitud
                    AND estado = 'Programada'
                `);

            if (finalizacion.rowsAffected[0] !== 1) {
                throw new Error('No se pudo finalizar la solicitud médica.');
            }

            // Cargo y obligación usan el total guardado, en la misma transacción clínica.
            await finanzas.registrarVisita(transaction, Number(idSolicitud), req.usuario.id_usuario);
            // Todo salió bien
            await transaction.commit();


            res.json({

                success: true,

                message:
                    'Visita médica registrada correctamente.',

                calculo: {

                    subtotal:
                        subtotalFinal,

                    descuentoConsulta: descuentoConsultaNumero,
                    descuentoExamenes: descuentoExamenesNumero,
                    descuentoMedicamentos: descuentoMedicamentosNumero,
                    montoDescuentoConsulta: descuentosCentavos[0] / 100,
                    montoDescuentoExamenes: descuentosCentavos[1] / 100,
                    montoDescuentoMedicamentos: descuentosCentavos[2] / 100,

                    descuento:
                        descuentoFinal,

                    total:
                        totalFinal
                }
            });


        } catch (err) {

            if (transaction) {

                try {
                    await transaction.rollback();
                } catch (_) {
                    // Ya no existía transacción activa
                }
            }


            console.error(err);
        if (erroresDb.responder(err, res)) return;


            // Por la restricción UNIQUE:
            // una solicitud no puede tener dos visitas.
            if (
                err.message &&
                (
                    err.message.includes('UQ_VisitasMedicas_Solicitud') ||
                    err.message.includes('UNIQUE')
                )
            ) {

                return res.status(409).json({
                    success: false,
                    message: 'Esta solicitud ya tiene una visita médica registrada.'
                });
            }


            res.status(500).json({
                success: false,
                message: 'Error al registrar la visita médica.'
            });
        }
    }
);


// ----------------------------------------------------------
// LISTAR VISITAS MÉDICAS
// Admin y Fundación pueden consultar el historial.
// ----------------------------------------------------------

app.get(
    '/api/visitas',
    verificarToken,
    async (req, res) => {

        if (
            req.usuario.tipo_personal !== 'Asilo' &&
            req.usuario.tipo_personal !== 'Fundacion'
        ) {

            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para consultar visitas médicas.'
            });
        }


        const residenteId = req.query?.id_residente;
        if (residenteId !== undefined && !idResidenteValido(residenteId)) {
            return res.status(400).json({ success: false, message: 'Identificador de residente inválido.' });
        }
        try {

            const pool =
                await sql.connect(dbConfig);


            const consulta = pool.request();
            if (residenteId !== undefined) consulta.input('idResidente', sql.Int, Number(residenteId));
            const result = await consulta.query(`

                    SELECT

                        v.id_visita,
                        v.id_solicitud,

                        h.id_residente,
                        h.nombres,
                        h.apellidos,

                        s.especialidad,
                        s.medico,
                        s.fecha_cita,

                        v.diagnostico,

                        v.examenes,
                        v.resultados_examenes,
                        v.costo_examenes,

                        v.medicamentos,
                        v.cantidad_medicamentos,
                        v.indicaciones,
                        v.costo_medicamentos,

                        v.costo_consulta,

                        v.subtotal,
                        v.porcentaje_descuento,
                        v.descuento_consulta_porcentaje,
                        v.descuento_examenes_porcentaje,
                        v.descuento_medicamentos_porcentaje,
                        v.descuento,
                        v.total,

                        v.observaciones,
                        v.fecha_visita

                    FROM VisitasMedicas v

                    INNER JOIN SolicitudesMedicas s
                        ON s.id_solicitud =
                           v.id_solicitud

                    INNER JOIN Huespedes h
                        ON h.id_residente =
                           s.id_residente

                    ${residenteId !== undefined ? 'WHERE h.id_residente = @idResidente' : ''}
                    ORDER BY
                        v.fecha_visita DESC,
                        v.id_visita DESC
                `);


            res.json({
                success: true,
                visitas: result.recordset
            });


        } catch (err) {

            console.error(err);
        if (erroresDb.responder(err, res)) return;


            res.status(500).json({
                success: false,
                message: 'Error al consultar las visitas médicas.'
            });
        }
    }
);


// ==========================================================
// 8. ARRANQUE DEL SERVIDOR
// ==========================================================

const PUERTO = process.env.PORT || 3000;

// Último control para errores asíncronos de Express y JSON inválido, sin exponer SQL.
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Petición:', error.code || error.name);
    if (erroresDb.responder(error, res)) return;
    res.status(error.status === 400 ? 400 : 500).json({ success: false,
        message: error.status === 400 ? 'Revise los datos enviados.' : 'No se pudo completar la petición. Intente nuevamente.' });
});

app.listen(PUERTO, () => {
    finanzas.iniciarCorreos();
    finanzas.iniciarMensualidades();

    console.log(
        `Backend corriendo en http://localhost:${PUERTO}`
    );
});
