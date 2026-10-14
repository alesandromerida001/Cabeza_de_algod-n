const crypto = require('node:crypto');
function fallo(mensaje, status = 400) { throw Object.assign(new Error(mensaje), { status }); }
function centavos(valor, permitirCero = false) {
    if (!['string', 'number'].includes(typeof valor) || !/^\d{1,10}(\.\d{1,2})?$/.test(String(valor))) fallo('Ingrese un importe válido con hasta dos decimales.');
    const n = Math.round(Number(valor) * 100);
    if (!Number.isSafeInteger(n) || n > 999999999999 || n < (permitirCero ? 0 : 1)) fallo('El importe está fuera del rango permitido.');
    return n;
}
function id(valor) {
    if (!['string', 'number'].includes(typeof valor) || !/^[1-9]\d*$/.test(String(valor)) || Number(valor) > 2147483647) fallo('Identificador inválido.');
    return Number(valor);
}
function fecha(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor < '1900-01-01' || !Number.isFinite(Date.parse(valor + 'T00:00:00Z')) || new Date(valor + 'T00:00:00Z').toISOString().slice(0, 10) !== valor) fallo('Fecha inválida.');
    return valor;
}
function texto(valor, max, obligatorio = true) {
    if (valor == null && !obligatorio) return null;
    if (typeof valor !== 'string' || valor.trim().length > max || (obligatorio && !valor.trim())) fallo('Revise los campos de texto obligatorios y sus longitudes.');
    return valor.trim() || null;
}
function distribuir(cargos, monto) {
    let restante = centavos(monto);
    const total = cargos.reduce((s, c) => s + centavos(c.saldo, true), 0);
    if (restante > total) fallo('El pago excede el saldo pendiente. No se registró ningún abono.');
    const aplicaciones = [];
    for (const cargo of cargos) {
        const n = Math.min(restante, centavos(cargo.saldo, true));
        if (n) aplicaciones.push({ id_cargo: cargo.id_cargo, concepto: cargo.concepto, monto: n / 100 });
        restante -= n;
        if (!restante) break;
    }
    return aplicaciones;
}
function planPago(cargos, monto, modalidad = 'General', idCargo) {
    if (!['General','Mensualidad'].includes(modalidad)) fallo('Seleccione una modalidad de pago válida.');
    let seleccion = cargos;
    if (modalidad === 'Mensualidad') {
        const cargo = cargos.find(c=>c.id_cargo===id(idCargo));
        if (!cargo || cargo.tipo !== 'Mensualidad') fallo('La mensualidad no está pendiente, no pertenece al residente o es posterior a la fecha del pago.');
        if (centavos(monto)>centavos(cargo.saldo,true)) fallo('El importe supera el saldo de la mensualidad seleccionada. No se distribuirá el excedente a otros cargos.');
        seleccion = [cargo];
    } else if (idCargo != null && idCargo !== '') fallo('Un pago general no debe seleccionar una mensualidad específica.');
    return distribuir(seleccion,monto).map(a=>{
        const c = seleccion.find(c=>c.id_cargo===a.id_cargo), antes=centavos(c.saldo,true), despues=antes-centavos(a.monto);
        return {...a, tipo:c.tipo, periodo:c.periodo, saldoAnterior:antes/100,saldoResultante:despues/100,clasificacion:despues===0?'Completo':'Parcial'};
    });
}
function conceptoPago(aplicaciones, cargos) {
    if (aplicaciones.length>1) return 'Pago general aplicado a varios cargos';
    const a=aplicaciones[0], c=cargos.find(c=>c.id_cargo===a?.id_cargo);
    if (!a || !c) return 'Pago familiar recibido';
    const prefijo=a.clasificacion==='Completo'?'Pago completo de ':'Abono a ';
    if(c.tipo==='Mensualidad')return prefijo+'mensualidad de '+require('../frontend/compartido/formatos').periodo(c.periodo);
    return prefijo+c.concepto;
}
function huella(valor) { return crypto.createHash('sha256').update(JSON.stringify(valor)).digest('hex'); }
// Lectura compartida por estado de cuenta y reportes; no altera aplicaciones.
function describirPago(p, cargos, aplicaciones, ajustes, comprobante) {
    if (comprobante?.concepto) return comprobante.concepto;
    const detalle = aplicaciones.filter(a => a.id_pago === p.id_pago).map(a => {
        const c = cargos.find(c => c.id_cargo === a.id_cargo);
        const revisiones = ajustes.filter(x => x.id_cargo === a.id_cargo).sort((a,b) => a.id_ajuste-b.id_ajuste);
        let monto = revisiones[0]?.importe_anterior ?? c?.monto;
        for (const ajuste of revisiones) if (p.creado_en && new Date(ajuste.creado_en) <= new Date(p.creado_en)) monto = ajuste.importe_nuevo;
        const previo = aplicaciones.filter(x => x.id_cargo === a.id_cargo && x.id_pago < p.id_pago).reduce((n,x) => n + centavos(x.monto), 0);
        return {...a, clasificacion: centavos(monto,true)-previo === centavos(a.monto) ? 'Completo' : 'Parcial'};
    });
    return conceptoPago(detalle,cargos);
}
function clave(valor) {
    if (typeof valor !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(valor)) fallo('Falta la clave de operación. Recargue el formulario.');
    return valor;
}
module.exports = { fallo, centavos, id, fecha, texto, distribuir, planPago, conceptoPago, describirPago, huella, clave };
