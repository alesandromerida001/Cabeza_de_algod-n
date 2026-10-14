// Módulo financiero aditivo. Toda escritura financiera usa transacción e idempotencia.
const C = require('./finanzas-calculos');
const F = require('../frontend/compartido/formatos');
module.exports = function finanzas({ app, sql, dbConfig, verificarToken, soloAdmin }) {
    const request = db => db.request ? db.request() : new sql.Request(db);
    async function query(db, sentencia, valores = {}) {
        const r = request(db);
        for (const [k, v] of Object.entries(valores)) r.input(k, typeof v === 'number' ? (k.startsWith('id') ? sql.Int : sql.Decimal(12, 2)) : sql.NVarChar(sql.MAX), v);
        return r.query(sentencia);
    }
    const pool = () => sql.connect(dbConfig);
    async function disponible(db) {
        const r = await query(db, `SELECT CASE WHEN OBJECT_ID('dbo.FinanzasVersion','U') IS NOT NULL THEN 1 ELSE 0 END AS finanzas,
            (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') AND name IN
            ('CargosFamiliares','PagosFamiliares','AplicacionesPagos','ObligacionesFundacion','PagosFundacion','Donaciones','Gastos','OperacionesFinancieras','NotificacionesCorreo','AuditoriaContactoFinanciero','FinanzasVersion')) tablas,
            COL_LENGTH('dbo.Huespedes','correo_responsable') correo`);
        const estado = r.recordset[0];
        if (!estado?.finanzas && !estado?.tablas) return false;
        if (estado?.finanzas !== 1 || estado.tablas !== 11 || estado.correo !== 254) C.fallo('La migración financiera está incompleta. Revise el script 005 antes de continuar.', 503);
        const version = await query(db, 'SELECT version FROM dbo.FinanzasVersion WHERE version=1');
        if (!version.recordset.length) C.fallo('La migración financiera no está confirmada. Revise el script 005.', 503);
        return true;
    }
    async function bloqueo(tx) {
        await query(tx, "DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource='AsiloFinanzas',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; IF @r<0 THROW 51000,'No se pudo reservar la operación financiera.',1;");
    }
    async function transaccion(accion) {
        const tx = new sql.Transaction(await pool());
        await tx.begin();
        try { await bloqueo(tx); const resultado = await accion(tx); await tx.commit(); return resultado; }
        catch (error) { try { await tx.rollback(); } catch (_) {} throw error; }
    }
    async function operacion(req, tipo, accion) {
        const clave = C.clave(req.body.claveOperacion), huella = C.huella({ params: req.params, body: req.body });
        return transaccion(async tx => {
            const anterior = (await query(tx, 'SELECT * FROM dbo.OperacionesFinancieras WHERE clave=CONVERT(uniqueidentifier,@clave)', { clave })).recordset[0];
            if (anterior) {
                if (anterior.tipo !== tipo || anterior.id_usuario !== req.usuario.id_usuario || anterior.huella !== huella) C.fallo('Esta clave ya fue utilizada con otra operación.', 409);
                return JSON.parse(anterior.resultado);
            }
            const resultado = await accion(tx);
            await query(tx, 'INSERT dbo.OperacionesFinancieras(clave,tipo,id_usuario,huella,resultado) VALUES(CONVERT(uniqueidentifier,@clave),@tipo,@idUsuario,@huella,@resultado)', { clave, tipo, idUsuario: req.usuario.id_usuario, huella, resultado: JSON.stringify(resultado) });
            return resultado;
        });
    }
    function ruta(metodo, url, acceso, accion) {
        app[metodo](url, verificarToken, acceso, async (req, res) => {
            try {
                if (metodo !== 'get' && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) C.fallo('Debe enviar los datos de la operación.');
                const db = await pool();
                if (!await disponible(db)) C.fallo('Finanzas requiere aplicar la migración SQL 005. No se modificaron datos.', 503);
                res.json({ success: true, ...await accion(req, db) });
            } catch (error) {
                if (require('./config/errores-db').responder(error,res)) { console.error('Finanzas: conexión no disponible',error.code); return; }
                if (!error.status) console.error('Finanzas:', error);
                const status = error.status || ([2601, 2627].includes(error.number) ? 409 : 500);
                res.status(status).json({ success: false, message: error.status ? error.message : status === 409 ? 'La operación ya existe. Actualice la consulta.' : 'No se pudo completar la operación financiera. Intente nuevamente.' });
            }
        });
    }
    const ambos = (req, res, next) => ['Asilo', 'Fundacion'].includes(req.usuario.tipo_personal) ? next() : res.status(403).json({ success: false, message: 'Acceso no autorizado.' });
    const hoy = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Guatemala' }).format(new Date());
    function fechaPago(valor) { C.fecha(valor); if (valor > hoy()) C.fallo('No puede registrar dinero recibido o desembolsado en una fecha futura.'); return valor; }
    function rango(req) {
        const desde = req.query.desde ? C.fecha(req.query.desde) : '1900-01-01';
        const hasta = req.query.hasta ? C.fecha(req.query.hasta) : '9999-12-31';
        if (desde > hasta) C.fallo('El rango de fechas no es válido.');
        return { desde, hasta };
    }
    async function residente(db, idResidente) {
        const r = (await query(db, 'SELECT id_residente,nombres,apellidos,dpi,nombre_responsable,parentesco,telefono_emergencia,correo_responsable,cuota_mensual,estado FROM dbo.Huespedes WHERE id_residente=@idResidente', { idResidente })).recordset[0];
        if (!r) C.fallo('Residente no encontrado.', 404);
        return r;
    }
    async function cargos(db, idResidente) {
        return (await query(db, `SELECT c.*,COALESCE(a.aplicado,0) AS pagado,c.monto-COALESCE(a.aplicado,0) AS saldo
            FROM dbo.CargosFamiliares c OUTER APPLY(SELECT SUM(monto) aplicado FROM dbo.AplicacionesPagos WHERE id_cargo=c.id_cargo) a
            WHERE c.id_residente=@idResidente ORDER BY c.fecha,c.id_cargo`, { idResidente })).recordset;
    }
    async function saldo(db, idResidente) {
        return (await cargos(db, idResidente)).reduce((n, c) => n + C.centavos(c.saldo, true), 0) / 100;
    }
    async function notificar(db, evento, idEvento, idResidente, asunto, cuerpo) {
        await query(db, `INSERT dbo.NotificacionesCorreo(evento,id_evento,id_residente,destinatario,asunto,cuerpo)
            SELECT @evento,@idEvento,h.id_residente,h.correo_responsable,@asunto,@cuerpo FROM dbo.Huespedes h WHERE h.id_residente=@idResidente
            AND NOT EXISTS(SELECT 1 FROM dbo.NotificacionesCorreo WITH(UPDLOCK,HOLDLOCK) WHERE evento=@evento AND id_evento=@idEvento)`, { evento, idEvento, idResidente, asunto, cuerpo });
    }
    async function cargoNuevo(db, datos, avisar = true) {
        const c = (await query(db, `INSERT dbo.CargosFamiliares(id_residente,id_visita,tipo,periodo,fecha,concepto,monto,creado_por)
            OUTPUT INSERTED.* VALUES(@idResidente,@idVisita,@tipo,@periodo,@fecha,@concepto,@monto,@idUsuario)`, datos)).recordset[0];
        if (avisar) await notificar(db, 'Cargo', c.id_cargo, c.id_residente, 'Nuevo cargo en su estado de cuenta', `Concepto: ${c.concepto}\nImporte: ${F.dinero(c.monto)}\nPeríodo: ${F.periodo(c.periodo || F.dia(c.fecha).slice(0,7))}\nFecha: ${F.fecha(c.fecha)}\nSaldo pendiente: ${F.dinero(await saldo(db, c.id_residente))}`);
        return c;
    }
    async function registrarVisita(tx, idSolicitud, idUsuario) {
        if (!await disponible(tx)) return; // Antes de la migración se conserva el flujo clínico anterior.
        await bloqueo(tx);
        const v = (await query(tx, `SELECT v.id_visita,v.total,CONVERT(varchar(10),v.fecha_visita,23) fecha,s.id_residente
            FROM dbo.VisitasMedicas v JOIN dbo.SolicitudesMedicas s ON s.id_solicitud=v.id_solicitud WHERE v.id_solicitud=@idSolicitud`, { idSolicitud })).recordset[0];
        if (!v) C.fallo('No se pudo relacionar la visita financiera.', 500);
        C.centavos(v.total, true);
        const existe = (await query(tx, 'SELECT id_cargo FROM dbo.CargosFamiliares WHERE id_visita=@idVisita', { idVisita: v.id_visita })).recordset.length;
        if (!existe) await cargoNuevo(tx, { idResidente: v.id_residente, idVisita: v.id_visita, tipo: 'Medico', periodo: null, fecha: v.fecha, concepto: `Atención médica - visita ${v.id_visita}`, monto: Number(v.total), idUsuario });
        await query(tx, `INSERT dbo.ObligacionesFundacion(id_visita,monto,creado_por) SELECT @idVisita,@monto,@idUsuario
            WHERE NOT EXISTS(SELECT 1 FROM dbo.ObligacionesFundacion WHERE id_visita=@idVisita)`, { idVisita: v.id_visita, monto: Number(v.total), idUsuario });
    }
    async function prepararTransaccion(tx) {
        if (await disponible(tx)) await bloqueo(tx);
    }
    async function notificarCita(tx, idSolicitud) {
        if (!await disponible(tx)) return;
        const s = (await query(tx, `SELECT s.id_residente,s.especialidad,s.medico,CONVERT(varchar(10),s.fecha_cita,23) fecha,
            CONVERT(varchar(5),s.hora_cita,108) hora,h.nombres,h.apellidos FROM dbo.SolicitudesMedicas s JOIN dbo.Huespedes h ON h.id_residente=s.id_residente WHERE s.id_solicitud=@idSolicitud`, { idSolicitud })).recordset[0];
        await notificar(tx, 'Cita', idSolicitud, s.id_residente, 'Cita médica programada', `Residente: ${s.nombres} ${s.apellidos}\nEspecialidad: ${s.especialidad}\nFecha: ${F.fecha(s.fecha)}\nHora: ${F.hora(s.hora)}`);
    }
    ruta('get', '/api/finanzas/residentes', soloAdmin, async (req, db) => {
        const busqueda = C.texto(req.query.q, 100); if (busqueda.length < 2) C.fallo('Escriba al menos dos caracteres.');
        return { residentes: (await query(db, `SELECT TOP(20) id_residente,nombres,apellidos,dpi FROM dbo.Huespedes
            WHERE CHARINDEX(@busqueda,CONCAT(nombres,' ',apellidos))>0 OR CHARINDEX(@busqueda,dpi)>0 ORDER BY apellidos,nombres`, { busqueda })).recordset };
    });
    ruta('get', '/api/finanzas/cuentas/:id', soloAdmin, async (req, db) => {
        const idResidente = C.id(req.params.id), r = await residente(db, idResidente), cs = await cargos(db, idResidente);
        const pagos = (await query(db, 'SELECT * FROM dbo.PagosFamiliares WHERE id_residente=@idResidente ORDER BY fecha,id_pago', { idResidente })).recordset;
        const aplicaciones = (await query(db, `SELECT a.* FROM dbo.AplicacionesPagos a JOIN dbo.PagosFamiliares p ON p.id_pago=a.id_pago WHERE p.id_residente=@idResidente`, { idResidente })).recordset;
        const ajustes = await mensual.disponible(db) ? (await query(db, 'SELECT a.* FROM dbo.AjustesMensualidades a JOIN dbo.CargosFamiliares c ON c.id_cargo=a.id_cargo WHERE c.id_residente=@idResidente ORDER BY a.id_ajuste', { idResidente })).recordset : [];
        const operaciones = (await query(db, "SELECT resultado FROM dbo.OperacionesFinancieras WHERE tipo='pago-familiar' AND TRY_CONVERT(int,JSON_VALUE(resultado,'$.pago.id_residente'))=@idResidente", { idResidente })).recordset;
        const comprobantes = new Map();
        for(const o of operaciones){const v=JSON.parse(o.resultado);if(v.concepto && v.modalidad)comprobantes.set(v.pago.id_pago,v);}
        function conceptoPago(p) {
            return C.describirPago(p, cs, aplicaciones, ajustes, comprobantes.get(p.id_pago));
        }
        for(const p of pagos){p.concepto=conceptoPago(p);if(comprobantes.has(p.id_pago)){const v=comprobantes.get(p.id_pago);p.modalidad=v.modalidad;p.detalle_aplicaciones=v.aplicaciones;}}
        let acumulado = 0;
        const movimientos = [...cs.map(c => ({ fecha: c.fecha, tipo: 'Cargo', id: c.id_cargo, concepto: c.tipo==='Mensualidad' ? 'Mensualidad de '+F.periodo(c.periodo) : c.concepto, monto: ajustes.find(a => a.id_cargo === c.id_cargo)?.importe_anterior ?? c.monto })), ...ajustes.map(a => ({ fecha: a.creado_en, tipo: 'Ajuste', id: a.id_ajuste, concepto: a.motivo, monto: Math.round((a.importe_nuevo-a.importe_anterior)*100)/100 })), ...pagos.map(p => ({ fecha: p.fecha, tipo: 'Abono', id: p.id_pago, concepto: conceptoPago(p), monto: p.monto }))]
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || (a.tipo === b.tipo ? a.id - b.id : a.tipo === 'Cargo' ? -1 : 1))
            .map(m => { acumulado += Math.round(Number(m.monto)*100) * (m.tipo === 'Abono' ? -1 : 1); return { ...m, saldo: acumulado / 100 }; });
        return { residente: r, cargos: cs, pagos, aplicaciones, movimientos, ajustes,
            totales: { cargos: cs.reduce((n, c) => n + C.centavos(c.monto, true), 0) / 100, pagos: pagos.reduce((n, p) => n + C.centavos(p.monto), 0) / 100, saldo: acumulado / 100 } };
    });
    ruta('put', '/api/finanzas/cuentas/:id/correo', soloAdmin, req => operacion(req, 'correo', async tx => {
        const idResidente = C.id(req.params.id), correo = C.texto(req.body.correo, 254, false);
        if (correo && !/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(correo)) C.fallo('Correo del responsable inválido.');
        const r = await residente(tx, idResidente);
        await query(tx, 'INSERT dbo.AuditoriaContactoFinanciero(id_residente,correo_anterior,correo_nuevo,creado_por) VALUES(@idResidente,@anterior,@correo,@idUsuario); UPDATE dbo.Huespedes SET correo_responsable=@correo WHERE id_residente=@idResidente', { idResidente, anterior: r.correo_responsable, correo, idUsuario: req.usuario.id_usuario });
        return { message: 'Correo del responsable actualizado.' };
    }));
    ruta('post', '/api/finanzas/cargos', soloAdmin, req => operacion(req, 'cargo', async tx => {
        const idResidente = C.id(req.body.idResidente); await residente(tx, idResidente);
        const c = await cargoNuevo(tx, { idResidente, idVisita: null, tipo: 'Manual', periodo: null, fecha: C.fecha(req.body.fecha), concepto: C.texto(req.body.concepto, 300), monto: C.centavos(req.body.monto) / 100, idUsuario: req.usuario.id_usuario });
        return { cargo: c, message: 'Cargo registrado.' };
    }));
    const mensual = require('./mensualidades')({ query, pool, transaccion, cargoNuevo, hoy });
    const mensualidades = (db, b) => mensual.vista(db, b);
    ruta('post', '/api/finanzas/mensualidades/previsualizar', soloAdmin, (req, db) => mensualidades(db, req.body));
    ruta('post', '/api/finanzas/mensualidades', soloAdmin, req => operacion(req, 'mensualidades', async tx => {
        const vista = await mensualidades(tx, req.body);
        if (vista.huella !== req.body.huella) C.fallo('La previsualización cambió. Revise nuevamente.', 409);
        await mensual.generar(tx, vista, req.usuario.id_usuario);
        const resumen = { ...vista.resumen, generadas: vista.filas.length };
        return { cantidad: resumen.generadas, resumen, message: 'Mensualidades de '+F.periodo(vista.periodo)+': '+resumen.generadas+' generadas, '+resumen.existentes+' existentes y '+resumen.omitidas+' omitidas.' };
    }));
    ruta('post', '/api/finanzas/mensualidades/:id/ajustar', soloAdmin, req => operacion(req, 'ajuste-mensualidad', async tx => {
        await mensual.exigir(tx);
        const idCargo = C.id(req.params.id), nuevo = C.centavos(req.body.monto, true)/100, motivo = C.texto(req.body.motivo, 500);
        const c = (await query(tx, 'SELECT id_residente,tipo,monto FROM dbo.CargosFamiliares WHERE id_cargo=@idCargo', { idCargo })).recordset[0];
        if (!c || c.tipo !== 'Mensualidad') C.fallo('Solo puede ajustar una mensualidad existente.', 400);
        const cargo = (await cargos(tx,c.id_residente)).find(x=>x.id_cargo===idCargo);
        if (nuevo < Number(cargo.pagado)) C.fallo('El importe corregido no puede ser menor que los abonos ya aplicados.');
        if (nuevo === Number(c.monto)) C.fallo('El importe no cambió.');
        if (Number(req.body.importeAnterior) !== Number(c.monto)) C.fallo('La mensualidad cambió. Consulte nuevamente.',409);
        await query(tx, 'INSERT dbo.AjustesMensualidades(id_cargo,importe_anterior,importe_nuevo,motivo,creado_por) VALUES(@idCargo,@anterior,@nuevo,@motivo,@idUsuario); UPDATE dbo.CargosFamiliares SET monto=@nuevo WHERE id_cargo=@idCargo', { idCargo, anterior:Number(c.monto),nuevo,motivo,idUsuario:req.usuario.id_usuario });
        return { message:'Mensualidad ajustada con auditoría. Los pagos permanecen intactos.' };
    }));
    async function retirarResidente(idResidente) {
        return transaccion(async tx => {
            const nuevo = await mensual.disponible(tx);
            return query(tx, nuevo ? "UPDATE dbo.Huespedes SET estado='Inactivo',fecha_retiro=CASE WHEN estado='Activo' AND fecha_ingreso IS NOT NULL THEN @fecha ELSE fecha_retiro END WHERE id_residente=@idResidente" : "UPDATE dbo.Huespedes SET estado='Inactivo' WHERE id_residente=@idResidente", { idResidente:C.id(idResidente),fecha:hoy() });
        });
    }
    async function historicos(db) {
        const filas = (await query(db, `SELECT v.id_visita,v.id_solicitud,v.total,v.fecha_visita,s.id_residente,h.nombres,h.apellidos
            FROM dbo.VisitasMedicas v JOIN dbo.SolicitudesMedicas s ON s.id_solicitud=v.id_solicitud JOIN dbo.Huespedes h ON h.id_residente=s.id_residente
            WHERE NOT EXISTS(SELECT 1 FROM dbo.CargosFamiliares c WHERE c.id_visita=v.id_visita)
               OR NOT EXISTS(SELECT 1 FROM dbo.ObligacionesFundacion o WHERE o.id_visita=v.id_visita)
            ORDER BY v.id_visita`)).recordset;
        return { filas, huella: C.huella(filas) };
    }
    ruta('get', '/api/finanzas/historicos', soloAdmin, (req, db) => historicos(db));
    ruta('post', '/api/finanzas/historicos', soloAdmin, req => operacion(req, 'historicos', async tx => {
        const vista = await historicos(tx); if (vista.huella !== req.body.huella) C.fallo('Los históricos cambiaron. Revise la previsualización.', 409);
        for (const v of vista.filas) await registrarVisita(tx, v.id_solicitud, req.usuario.id_usuario);
        return { cantidad: vista.filas.length, message: 'Visitas históricas conciliadas sin recalcular importes.' };
    }));
    async function vistaPago(db, b) {
        const idResidente=C.id(b.idResidente),fecha=fechaPago(b.fecha),r=await residente(db,idResidente),modalidad=b.modalidad??'General';
        const pendientes=(await cargos(db,idResidente)).filter(c=>Number(c.saldo)>0&&F.dia(c.fecha)<=fecha);
        const aplicaciones=C.planPago(pendientes,b.monto,modalidad,b.idCargo);
        const concepto=C.conceptoPago(aplicaciones,pendientes);
        return { residente:r.nombres+' '+r.apellidos,responsable:r.nombre_responsable||'No registrado',modalidad,concepto,importe:C.centavos(b.monto)/100,aplicaciones,
            huella:C.huella({idResidente,fecha,modalidad,aplicaciones,pendientes}) };
    }
    ruta('post', '/api/finanzas/pagos/previsualizar', soloAdmin, (req, db) => vistaPago(db, req.body));
    ruta('post', '/api/finanzas/pagos', soloAdmin, req => operacion(req, 'pago-familiar', async tx => {
        const b = req.body, vista = await vistaPago(tx, b);
        if (vista.huella !== b.huella) C.fallo('El saldo cambió. Revise nuevamente la distribución.', 409);
        const idResidente = C.id(b.idResidente);
        const pago = (await query(tx, `INSERT dbo.PagosFamiliares(id_residente,fecha,monto,metodo,referencia,observaciones,creado_por)
            OUTPUT INSERTED.* VALUES(@idResidente,@fecha,@monto,@metodo,@referencia,@observaciones,@idUsuario)`, {
            idResidente, fecha: fechaPago(b.fecha), monto: C.centavos(b.monto) / 100, metodo: C.texto(b.metodo, 50), referencia: C.texto(b.referencia, 150, false), observaciones: C.texto(b.observaciones, 1000, false), idUsuario: req.usuario.id_usuario
        })).recordset[0];
        for (const a of vista.aplicaciones) await query(tx, 'INSERT dbo.AplicacionesPagos(id_pago,id_cargo,monto) VALUES(@idPago,@idCargo,@monto)', { idPago: pago.id_pago, idCargo: a.id_cargo, monto: a.monto });
        await notificar(tx, 'Pago', pago.id_pago, idResidente, 'Pago recibido', `Modalidad: ${vista.modalidad==='General'?'Pago general':'Mensualidad específica'}\nConcepto: ${vista.concepto}\nComprobante: ${pago.id_pago}\nImporte abonado: ${F.dinero(pago.monto)}\nFecha: ${F.fecha(pago.fecha)}\nSaldo pendiente: ${F.dinero(await saldo(tx, idResidente))}`);
        return { pago, modalidad:vista.modalidad,concepto:vista.concepto, aplicaciones: vista.aplicaciones, message: `Pago registrado. Comprobante ${pago.id_pago}. ${vista.concepto}.` };
    }));
    async function obligaciones(db) {
        return (await query(db, `SELECT o.*,v.fecha_visita,v.costo_consulta,v.costo_examenes,v.costo_medicamentos,v.descuento,
            v.descuento_consulta_porcentaje,v.descuento_examenes_porcentaje,v.descuento_medicamentos_porcentaje,
            h.nombres,h.apellidos,COALESCE(p.pagado,0) pagado,o.monto-COALESCE(p.pagado,0) saldo,
            CASE WHEN o.monto=COALESCE(p.pagado,0) THEN 'Pagada' WHEN COALESCE(p.pagado,0)>0 THEN 'Parcial' ELSE 'Pendiente' END estado
            FROM dbo.ObligacionesFundacion o JOIN dbo.VisitasMedicas v ON v.id_visita=o.id_visita
            JOIN dbo.SolicitudesMedicas s ON s.id_solicitud=v.id_solicitud JOIN dbo.Huespedes h ON h.id_residente=s.id_residente
            OUTER APPLY(SELECT SUM(monto) pagado FROM dbo.PagosFundacion WHERE id_obligacion=o.id_obligacion) p ORDER BY v.fecha_visita,o.id_obligacion`)).recordset;
    }
    ruta('get', '/api/finanzas/fundacion', ambos, async (req, db) => ({ obligaciones: await obligaciones(db), pagos: (await query(db, 'SELECT id_pago_fundacion,id_obligacion,fecha,monto,metodo,referencia,observaciones FROM dbo.PagosFundacion ORDER BY fecha DESC,id_pago_fundacion DESC')).recordset, puedePagar: req.usuario.tipo_personal === 'Asilo', regla: 'Provisional: total neto descontado de la visita. Pendiente de confirmación con el responsable.' }));
    ruta('post', '/api/finanzas/fundacion/pagos', soloAdmin, req => operacion(req, 'pago-fundacion', async tx => {
        const b = req.body, idObligacion = C.id(b.idObligacion), fecha = fechaPago(b.fecha), monto = C.centavos(b.monto);
        const o = (await obligaciones(tx)).find(o => o.id_obligacion === idObligacion);
        if (!o) C.fallo('Obligación no encontrada.', 404);
        if (monto > C.centavos(o.saldo, true)) C.fallo('El pago excede el saldo de la obligación.');
        if (fecha < new Date(o.fecha_visita).toISOString().slice(0, 10)) C.fallo('La fecha de pago no puede ser anterior a la visita.');
        const pago = (await query(tx, `INSERT dbo.PagosFundacion(id_obligacion,fecha,monto,metodo,referencia,observaciones,creado_por) OUTPUT INSERTED.*
            VALUES(@idObligacion,@fecha,@monto,@metodo,@referencia,@observaciones,@idUsuario)`, { idObligacion, fecha, monto: monto / 100, metodo: C.texto(b.metodo, 50), referencia: C.texto(b.referencia, 150, false), observaciones: C.texto(b.observaciones, 1000, false), idUsuario: req.usuario.id_usuario })).recordset[0];
        return { pago, message: 'Pago a Fundación registrado.' };
    }));
    const tipos = ['Empresa internacional', 'Empresa nacional', 'Gobierno', 'Particular'];
    const categorias = ['Agua', 'Energía eléctrica', 'Alimentación', 'Mantenimiento', 'Transporte', 'Servicios', 'Otros'];
    for (const donacion of [true, false]) {
        const nombre = donacion ? 'donaciones' : 'gastos', tabla = donacion ? 'Donaciones' : 'Gastos', pk = donacion ? 'id_donacion' : 'id_gasto';
        ruta('get', `/api/finanzas/${nombre}`, soloAdmin, async (req, db) => ({ registros: (await query(db, `SELECT * FROM dbo.${tabla} WHERE fecha BETWEEN @desde AND @hasta ORDER BY fecha DESC,${pk} DESC`, rango(req))).recordset }));
        ruta('post', `/api/finanzas/${nombre}`, soloAdmin, req => operacion(req, nombre, async tx => {
            const b = req.body, valores = { fecha: fechaPago(b.fecha), monto: C.centavos(b.monto) / 100, referencia: C.texto(b.referencia, 150, false), idUsuario: req.usuario.id_usuario };
            let sentencia;
            if (donacion) {
                if (!tipos.includes(b.tipo_donante)) C.fallo('Tipo de donante inválido.');
                Object.assign(valores, { donante: C.texto(b.donante, 150), tipo: b.tipo_donante, descripcion: C.texto(b.descripcion, 1000) });
                sentencia = 'INSERT dbo.Donaciones(donante,tipo_donante,fecha,monto,descripcion,referencia,creado_por) OUTPUT INSERTED.* VALUES(@donante,@tipo,@fecha,@monto,@descripcion,@referencia,@idUsuario)';
            } else {
                if (!categorias.includes(b.categoria)) C.fallo('Categoría inválida.');
                Object.assign(valores, { categoria: b.categoria, concepto: C.texto(b.concepto, 300), beneficiario: C.texto(b.beneficiario, 150, false), observaciones: C.texto(b.observaciones, 1000, false) });
                sentencia = 'INSERT dbo.Gastos(categoria,concepto,fecha,monto,beneficiario,referencia,observaciones,creado_por) OUTPUT INSERTED.* VALUES(@categoria,@concepto,@fecha,@monto,@beneficiario,@referencia,@observaciones,@idUsuario)';
            }
            return { registro: (await query(tx, sentencia, valores)).recordset[0], message: 'Registro confirmado.' };
        }));
        ruta('post', `/api/finanzas/${nombre}/:id/anular`, soloAdmin, req => operacion(req, `${nombre}-anular-${C.id(req.params.id)}`, async tx => {
            const result = await query(tx, `UPDATE dbo.${tabla} SET estado=@estado,motivo_anulacion=@motivo,anulado_por=@idUsuario,anulado_en=SYSUTCDATETIME()
                WHERE ${pk}=@id AND motivo_anulacion IS NULL`, { id: C.id(req.params.id), estado: donacion ? 'Anulada' : 'Anulado', motivo: C.texto(req.body.motivo, 500), idUsuario: req.usuario.id_usuario });
            if (!result.rowsAffected[0]) C.fallo('El registro no existe o ya fue anulado.', 409);
            return { message: 'Registro anulado; el historial permanece disponible.' };
        }));
    }
    ruta('get', '/api/finanzas/resumen', soloAdmin, async (req, db) => {
        const movimientos = (await query(db, `SELECT fecha,'Ingreso' tipo,N'Pagos familiares' origen,monto,id_pago id FROM dbo.PagosFamiliares
            UNION ALL SELECT fecha,'Ingreso',N'Donaciones',monto,id_donacion FROM dbo.Donaciones WHERE estado='Confirmada'
            UNION ALL SELECT fecha,'Egreso',categoria,monto,id_gasto FROM dbo.Gastos WHERE estado='Confirmado'
            UNION ALL SELECT fecha,'Egreso',N'Fundación',monto,id_pago_fundacion FROM dbo.PagosFundacion`)).recordset;
        const fechas = rango(req), filtrados = movimientos.filter(m => { const f = new Date(m.fecha).toISOString().slice(0, 10); return f >= fechas.desde && f <= fechas.hasta; });
        const sumar = xs => xs.reduce((n, m) => n + C.centavos(m.monto, true), 0) / 100;
        const porCobrar = (await query(db, `SELECT (SELECT COALESCE(SUM(monto),0) FROM dbo.CargosFamiliares)-(SELECT COALESCE(SUM(monto),0) FROM dbo.PagosFamiliares) saldo`)).recordset[0].saldo;
        const deuda = (await obligaciones(db)).reduce((n, o) => n + C.centavos(o.saldo, true), 0) / 100;
        const ingresos = sumar(filtrados.filter(m => m.tipo === 'Ingreso')), egresos = sumar(filtrados.filter(m => m.tipo === 'Egreso'));
        const disponible = sumar(movimientos.filter(m => m.tipo === 'Ingreso')) - sumar(movimientos.filter(m => m.tipo === 'Egreso'));
        return { resumen: { ingresos, egresos, netoPeriodo: Math.round((ingresos - egresos) * 100) / 100, disponible: Math.round(disponible * 100) / 100, porCobrar, deudaFundacion: deuda, donaciones: sumar(filtrados.filter(m => m.origen === 'Donaciones')) }, movimientos: filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) };
    });
    const correos = require('./notificaciones-correo')({ sql, pool, query, disponible });
    ruta('get', '/api/finanzas/notificaciones', soloAdmin, async (req, db) => ({ configurado: correos.configurado(), notificaciones: (await query(db, 'SELECT TOP(200) id_notificacion,evento,id_evento,id_residente,destinatario,estado,intentos,creado_en,ultimo_intento,enviado_en,error FROM dbo.NotificacionesCorreo ORDER BY id_notificacion DESC')).recordset }));
    return { registrarVisita, notificarCita, prepararTransaccion, iniciarCorreos: correos.iniciar, disponible, registrarCuota: mensual.cuota, retirarResidente, iniciarMensualidades: mensual.iniciar, recuperarMensualidades: mensual.recuperar };
};
