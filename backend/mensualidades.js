// Extensión de Finanzas: cuotas por vigencia y recuperación mensual optativa.
const C = require('./finanzas-calculos');
const F = require('../frontend/compartido/formatos');
function evaluar(r, periodo, hoy) {
    let motivo = '';
    if (r.id_cargo) motivo = 'La mensualidad ya existe.';
    else if (!r.ingreso) motivo = 'Falta verificar la fecha de ingreso.';
    else if (periodo < r.ingreso.slice(0,7)) motivo = `Período anterior al ingreso (${F.fecha(r.ingreso)}).`;
    else if (r.ingreso > hoy) motivo = `El ingreso todavía no ha ocurrido (${F.fecha(r.ingreso)}).`;
    else if (r.retiro && periodo > r.retiro.slice(0,7)) motivo = `Período posterior al retiro (${F.fecha(r.retiro)}).`;
    else if (r.estado !== 'Activo' && !r.retiro) motivo = 'Falta verificar la fecha de retiro.';
    else if (r.monto == null) motivo = 'Falta una cuota histórica verificable para este período.';
    else if (Number(r.monto) <= 0) motivo = 'La cuota vigente es cero; no se genera un cargo.';
    return { ...r, periodo, elegible: !motivo, estado_elegibilidad: r.id_cargo ? 'Existente' : motivo ? 'Omitida' : 'Elegible', motivo: motivo || 'Cuota histórica verificada; puede generarse.' };
}
function periodos(desde, hasta) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(desde || '') || !/^\d{4}-(0[1-9]|1[0-2])$/.test(hasta || '')) C.fallo('Período inválido.');
    const resultado = [];
    const numero = p => Number(p.slice(0, 4)) * 12 + Number(p.slice(5)) - 1;
    for (let n = numero(desde); n <= numero(hasta); n++) {
        resultado.push(`${String(Math.floor(n / 12)).padStart(4, '0')}-${String(n % 12 + 1).padStart(2, '0')}`);
    }
    return resultado;
}
module.exports = function crear({ query, pool, transaccion, cargoNuevo, hoy, env = process.env }) {
    async function disponible(db) {
        const r = (await query(db, `SELECT OBJECT_ID('dbo.ConfiguracionMensualidades','U') configuracion,
            OBJECT_ID('dbo.CuotasResidentes','U') cuotas,OBJECT_ID('dbo.AjustesMensualidades','U') ajustes,
            COL_LENGTH('dbo.Huespedes','fecha_ingreso') ingreso,COL_LENGTH('dbo.Huespedes','fecha_retiro') retiro`)).recordset[0];
        if (!r?.configuracion && !r?.cuotas && !r?.ajustes && !r?.ingreso && !r?.retiro) return false;
        if (!r.configuracion || !r.cuotas || !r.ajustes || r.ingreso !== 3 || r.retiro !== 3) C.fallo('La migración 007 está incompleta.', 503);
        return true;
    }
    async function exigir(db) { if (!await disponible(db)) C.fallo('Aplique manualmente 007_mensualidades.sql para esta operación.', 503); }
    async function vista(db, b, automatico = false) {
        await exigir(db);
        const periodo = C.texto(b.periodo, 7); C.fecha(periodo + '-01');
        if (periodo > hoy().slice(0, 7)) C.fallo('No se generan mensualidades futuras.');
        const idResidente = b.idResidente ? C.id(b.idResidente) : null;
        const candidatos = (await query(db, `SELECT h.id_residente,h.nombres,h.apellidos,h.estado,
            CONVERT(varchar(10),h.fecha_ingreso,23) ingreso,CONVERT(varchar(10),h.fecha_retiro,23) retiro,
            CASE WHEN c.id_cargo IS NOT NULL THEN c.monto ELSE cu.monto END monto,c.id_cargo
            FROM dbo.Huespedes h OUTER APPLY(SELECT TOP(1) monto FROM dbo.CuotasResidentes
                WHERE id_residente=h.id_residente AND desde<=CONVERT(date,@fecha) ORDER BY desde DESC,id_cuota DESC) cu
            LEFT JOIN dbo.CargosFamiliares c ON c.id_residente=h.id_residente AND c.periodo=@periodo
            WHERE (@automatico=1 OR @idResidente IS NOT NULL OR h.estado='Activo')
            AND (@idResidente IS NULL OR h.id_residente=@idResidente)
            ORDER BY h.id_residente`, { periodo, fecha: periodo + '-01', hoy: hoy(), idResidente, automatico: automatico ? 1 : 0 })).recordset;
        if (idResidente && !candidatos.length) C.fallo('Residente no encontrado.',404);
        const residentes = candidatos.map(r=>evaluar(r,periodo,hoy())), filas = residentes.filter(r=>r.elegible);
        const resumen = { generadas:0, elegibles:filas.length, existentes:residentes.filter(r=>r.estado_elegibilidad==='Existente').length, omitidas:residentes.filter(r=>r.estado_elegibilidad==='Omitida').length };
        return { periodo, residentes, filas, resumen, historico: periodo < hoy().slice(0, 7), huella: C.huella({ periodo, residentes }) };
    }
    async function generar(tx, vista, idUsuario = null) {
        for (const r of vista.filas) await cargoNuevo(tx, { idResidente: r.id_residente, idVisita: null, tipo: 'Mensualidad', periodo: vista.periodo,
            fecha: vista.periodo + '-01', concepto: `Mensualidad de ${F.periodo(vista.periodo)}`, monto: C.centavos(r.monto) / 100, idUsuario });
    }
    async function cuota(tx, idResidente, nuevo, idUsuario, alta = false) {
        if (!await disponible(tx)) return;
        const monto = C.centavos(nuevo, true) / 100;
        if (monto > 99999999.99) C.fallo('La cuota mensual excede el límite permitido.');
        const mes = hoy().slice(0, 7), siguiente = periodos(mes, `${Number(mes.slice(0, 4)) + 1}-12`)[1];
        const anterior = (await query(tx, 'SELECT cuota_mensual FROM dbo.Huespedes WHERE id_residente=@idResidente', { idResidente })).recordset[0];
        const cambia = alta || Number(anterior?.cuota_mensual) !== monto;
        if (cambia) {
            await query(tx, 'INSERT dbo.CuotasResidentes(id_residente,desde,monto,creado_por) VALUES(@idResidente,@desde,@monto,@idUsuario)', { idResidente, desde: (alta ? mes : siguiente) + '-01', monto, idUsuario });
        }
        if (alta) await query(tx, 'UPDATE dbo.Huespedes SET fecha_ingreso=@fecha WHERE id_residente=@idResidente AND fecha_ingreso IS NULL', { idResidente, fecha: hoy() });
        return cambia ? { desde: alta ? mes : siguiente } : null;
    }
    let ejecutando = false, timer;
    async function recuperar() {
        if (env.MENSUALIDADES_AUTOMATICAS !== 'true' || ejecutando) return { cantidad: 0, desactivado: true };
        ejecutando = true;
        try {
            const db = await pool(); await exigir(db);
            const config = (await query(db, 'SELECT inicio,preparado_el FROM dbo.ConfiguracionMensualidades WHERE id=1')).recordset[0];
            if (!config?.inicio) return { cantidad: 0, desactivado: true };
            const inicio = new Date(config.inicio).toISOString().slice(0, 7);
            if (inicio < new Date(config.preparado_el).toISOString().slice(0, 7)) C.fallo('El inicio automático no puede ser anterior a la preparación del sistema.');
            let cantidad = 0;
            for (const periodo of periodos(inicio, hoy().slice(0, 7))) {
                cantidad += await transaccion(async tx => {
                    const v = await vista(tx, { periodo }, true);
                    await generar(tx, v);
                    return v.filas.length;
                });
            }
            return { cantidad };
        } finally { ejecutando = false; }
    }
    function iniciar() {
        if (env.MENSUALIDADES_AUTOMATICAS !== 'true' || timer) return;
        const ejecutar = () => recuperar().catch(error => console.error('Mensualidades automáticas:', error));
        ejecutar(); timer = setInterval(ejecutar, 60 * 60 * 1000); timer.unref();
    }
    return { disponible, exigir, vista, generar, cuota, recuperar, iniciar };
};
module.exports.periodos = periodos;
module.exports.evaluar = evaluar;
