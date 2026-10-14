// El navegador solo presenta previsualizaciones; SQL/backend son la fuente oficial.
const $ = id => document.getElementById(id);
const vista = document.body.dataset.vista;
const modal = new bootstrap.Modal($('modalFinanzas'), { backdrop: 'static', keyboard: false });
const dinero = Formatos.dinero;
const fecha = f => Formatos.fecha(f);
const hoy = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Guatemala' }).format(new Date());
let cuenta, seleccion = 0, version = 0, datosFormulario, configuracionFormulario, huellaPreview, enProceso = false, soloFundacion = false;
if (vista === 'fundacion' && new URLSearchParams(window.location.search).get('origen') === 'fundacion') {
    $('navegacion').hidden = true;
    $('volver').href = '../fundacion/fundacion_dashboard.html';
}
function el(tag, texto, clase) { const e = document.createElement(tag); if (texto != null) e.textContent = texto; if (clase) e.className = clase; return e; }
function boton(texto, accion, clase = 'btn btn-primary') { const b = el('button', texto, clase); b.type = 'button'; b.addEventListener('click', accion); return b; }
async function api(url, body, metodo = 'POST') {
    const r = await fetch(url, body === undefined ? { cache: 'no-store' } : { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 401) { window.location.href = '/'; throw new Error('Sesión expirada.'); }
    const d = await r.json(); if (!r.ok || !d.success) throw Object.assign(new Error(d.message || 'No se pudo completar la consulta.'), { status: r.status }); return d;
}
function mensaje(t) { $('mensaje').className = 'mensaje-finanzas'; $('mensaje').textContent = t; }
function avisoPago(destino, tipo, texto) { destino.className = 'mensaje-operacion mensaje-' + tipo; destino.textContent = ({ error: 'ERROR // OPERACIÓN RECHAZADA', atencion: 'ATENCIÓN // CONFIRMACIÓN REQUERIDA', exito: 'OPERACIÓN COMPLETADA' }[tipo]) + ' — ' + texto; }
function tarjetas(items) { $('tarjetas').replaceChildren(...items.map(([label, n, formato = dinero]) => { const a = el('article'); a.append(el('strong', formato(n)), el('span', label)); return a; })); }
function seccion(titulo) { const s = el('section'); s.append(el('h2', titulo)); $('contenido').append(s); return s; }
function tabla(destino, filas, columnas, acciones) {
    const wrapper = el('div', null, 'table-responsive'), t = el('table', null, 'finanzas-tabla'), head = el('thead'), tr = el('tr');
    columnas.forEach(c => { const th = el('th', c[0]); th.scope = 'col'; tr.append(th); }); if (acciones) tr.append(el('th', 'Acciones')); head.append(tr); t.append(head);
    const body = el('tbody');
    if (!filas.length) { const td = el('td', 'No hay registros para esta consulta.'); td.colSpan = columnas.length + (acciones ? 1 : 0); const r = el('tr'); r.append(td); body.append(r); }
    filas.forEach(f => { const row = el('tr'); columnas.forEach(([, key, fmt]) => row.append(el('td', fmt ? fmt(f[key], f) : f[key] ?? 'No registrado'))); if (acciones) { const td = el('td'); acciones(f).forEach(b => td.append(b)); row.append(td); } body.append(row); }); t.append(body); wrapper.append(t); destino.append(wrapper);
}
const etiquetas = { modalidad: 'Modalidad', id_ajuste: 'Ajuste', importe_anterior: 'Importe anterior', importe_nuevo: 'Importe corregido', motivo: 'Motivo', id_cargo: 'Cargo', id_pago: 'Comprobante', id_pago_fundacion: 'Comprobante Fundación', id_donacion: 'Donación', id_gasto: 'Gasto', id_visita: 'Visita', id_obligacion: 'Obligación', fecha: 'Fecha', fecha_visita: 'Fecha de visita', tipo: 'Tipo', concepto: 'Concepto', monto: 'Importe', saldo: 'Saldo', pagado: 'Pagado', metodo: 'Método de pago', referencia: 'Referencia', observaciones: 'Observaciones', donante: 'Donante', tipo_donante: 'Tipo de donante', descripcion: 'Descripción', categoria: 'Categoría', beneficiario: 'Beneficiario/proveedor', estado: 'Estado', motivo_anulacion: 'Motivo de anulación', anulado_en: 'Fecha de anulación', creado_en: 'Registrado el', creado_por: 'Registrado por (ID)', regla: 'Regla aplicada', costo_consulta: 'Costo consulta', costo_examenes: 'Costo exámenes', costo_medicamentos: 'Costo medicamentos', descuento: 'Descuento monetario', descuento_consulta_porcentaje: 'Descuento consulta %', descuento_examenes_porcentaje: 'Descuento exámenes %', descuento_medicamentos_porcentaje: 'Descuento medicamentos %', periodo: 'Período' };
function detalle(registro, titulo, extras) {
    abrirFormulario({ titulo, campos: [], lectura: true });
    const dl = el('dl', null, 'detalle-financiero');
    for (const [k, v] of Object.entries(registro)) if (etiquetas[k]) { const div = el('div'); div.append(el('dt', etiquetas[k]), el('dd', ['importe_anterior', 'importe_nuevo', 'monto', 'saldo', 'pagado', 'costo_consulta', 'costo_examenes', 'costo_medicamentos', 'descuento'].includes(k) ? dinero(v) : k.endsWith('_en') ? Formatos.fecha(v, true) : k.includes('fecha') ? fecha(v) : k === 'periodo' ? Formatos.periodo(v) : v ?? 'No registrado')); dl.append(div); }
    $('previewModal').append(dl); if (extras) extras($('previewModal'));
}
function campo(nombre, label, tipo = 'text', opciones) { return { nombre, label, tipo, opciones }; }
const comunesPago = [campo('monto', 'Monto recibido/desembolsado (Q)', 'number'), campo('fecha', 'Fecha', 'date'), campo('metodo', 'Método', 'select', ['Efectivo', 'Transferencia', 'Depósito', 'Cheque', 'Otro']), campo('referencia', 'Referencia opcional'), campo('observaciones', 'Observaciones opcionales', 'textarea')];
function abrirFormulario(config) {
    configuracionFormulario = config; huellaPreview = null; enProceso = false; datosFormulario = null;
    $('tituloModal').textContent = config.titulo; $('camposModal').replaceChildren(); $('previewModal').replaceChildren(); $('errorModal').textContent = ''; $('errorModal').className = ''; $('editarPreview').hidden = true;
    $('guardarModal').hidden = Boolean(config.lectura); $('guardarModal').disabled = false; $('guardarModal').textContent = config.preview ? 'Revisar distribución' : 'Confirmar';
    config.campos.forEach(c => {
        const col = el('div', null, 'col-12 col-md-6'), label = el('label', c.label, 'form-label'); const input = el(c.tipo === 'select' ? 'select' : c.tipo === 'textarea' ? 'textarea' : 'input', null, 'form-control'); input.id = 'fin_' + c.nombre; input.name = c.nombre; label.htmlFor = input.id;
        if (c.tipo === 'residente') {
            input.type = 'hidden'; input.value = '';
            const buscar = el('input', null, 'form-control'), resultados = el('div', null, 'list-group');
            buscar.type = 'search'; buscar.placeholder = 'Nombre, apellido o DPI; vacío: lote'; buscar.maxLength = 100;
            buscar.id = 'buscarMensualidad'; label.htmlFor = buscar.id; let timer, secuencia = 0;
            buscar.addEventListener('input', () => {
                clearTimeout(timer); input.value = ''; resultados.replaceChildren(); const seq = ++secuencia, q = buscar.value.trim();
                buscar.setCustomValidity(q ? 'Seleccione un residente de los resultados o borre la búsqueda para generar por lote.' : '');
                if (q.length < 2) return;
                timer = setTimeout(async () => {
                    try {
                        const d = await api('/api/finanzas/residentes?q=' + encodeURIComponent(q)); if (seq !== secuencia || !buscar.isConnected) return;
                        if (!d.residentes.length) resultados.append(el('p', 'No hay coincidencias.'));
                        d.residentes.forEach(r => resultados.append(boton(`${r.nombres} ${r.apellidos} · ${r.dpi}`, () => {
                            input.value = r.id_residente; buscar.value = `${r.nombres} ${r.apellidos}`; buscar.setCustomValidity(''); resultados.replaceChildren(); datosFormulario = null;
                        }, 'list-group-item list-group-item-action')));
                    } catch (e) { if (seq === secuencia) resultados.append(el('p', e.message)); }
                }, 300);
            });
            col.append(label, buscar, input, resultados); $('camposModal').append(col); return;
        }
        if (c.tipo === 'select') c.opciones.forEach(x => { const o = el('option', typeof x === 'object' ? x.texto : x); o.value = typeof x === 'object' ? x.valor : x; input.append(o); }); else if (c.tipo !== 'textarea') input.type = c.tipo;
        if (c.tipo === 'number') { input.min = c.min ?? '0.01'; input.step = '0.01'; input.max = '9999999999.99'; input.placeholder = '0.00'; }
        if (c.tipo === 'text') input.maxLength = c.nombre === 'correo' ? 254 : c.nombre === 'concepto' ? 300 : 150;
        if (c.tipo === 'textarea') input.maxLength = 1000;
        input.required = !c.label.toLowerCase().includes('opcional'); input.value = config.valores?.[c.nombre] ?? (c.tipo === 'date' ? hoy() : c.tipo === 'month' ? hoy().slice(0, 7) : c.tipo === 'select' ? (c.opciones[0]?.valor ?? c.opciones[0]) : '');
        col.append(label, input); $('camposModal').append(col);
    });
    if (config.descripcion) $('previewModal').append(el('p', config.descripcion));
    modal.show();
}
$('editarPreview').addEventListener('click', () => { huellaPreview = null; datosFormulario = null; $('previewModal').replaceChildren(); $('camposModal').querySelectorAll('input,select,textarea').forEach(e => e.disabled = false); $('guardarModal').textContent = 'Revisar distribución'; $('guardarModal').hidden = false; $('editarPreview').hidden = true; });
$('formFinanzas').addEventListener('input', () => { if (!huellaPreview) datosFormulario = null; });
$('formFinanzas').addEventListener('submit', async e => {
    e.preventDefault(); if (enProceso) return; const config = configuracionFormulario;
    if (!datosFormulario) datosFormulario = { ...config.base, ...Object.fromEntries(new FormData($('formFinanzas'))), claveOperacion: crypto.randomUUID() };
    enProceso = true; for (const id of ['guardarModal', 'cancelarModal', 'cerrarX', 'editarPreview']) $(id).disabled = true;
    $('camposModal').querySelectorAll('input,select,textarea,button').forEach(e => e.disabled = true);
    $('errorModal').textContent = '';
    try {
        if (config.preview && !huellaPreview) { const d = await config.preview(datosFormulario); huellaPreview = d.huella; datosFormulario = { ...datosFormulario, huella: d.huella }; $('previewModal').replaceChildren(); config.renderPreview(d, $('previewModal')); $('camposModal').querySelectorAll('input,select,textarea').forEach(e => e.disabled = true); $('editarPreview').hidden = false; $('guardarModal').textContent = 'Confirmar operación'; }
        else { const d = await config.guardar(datosFormulario); modal.hide(); try { await config.despues?.(d); if (config.pagoFamiliar) avisoPago($('mensaje'), 'exito', d.message || 'Pago registrado.'); else mensaje(d.message || 'Operación registrada.'); } catch (_) { mensaje('Operación confirmada. No se pudo actualizar la pantalla; recargue para consultar el comprobante.'); } }
    } catch (error) { if (config.pagoFamiliar) avisoPago($('errorModal'), 'error', error.message); else { $('errorModal').className = 'alert alert-danger'; $('errorModal').textContent = error.message; } if (error.status === 409 && config.preview) { huellaPreview = null; datosFormulario = null; $('guardarModal').textContent = 'Revisar distribución'; $('camposModal').querySelectorAll('input,select,textarea').forEach(e => e.disabled = false); $('previewModal').replaceChildren(); $('editarPreview').hidden = true; } }
    finally { enProceso = false; for (const id of ['guardarModal', 'cancelarModal', 'cerrarX', 'editarPreview']) $(id).disabled = false; if (!huellaPreview) $('camposModal').querySelectorAll('input,select,textarea,button').forEach(e => e.disabled = false); }
});
function filtrosFechas(recargar) {
    for (const [id, label] of [['desde', 'Desde'], ['hasta', 'Hasta']]) { const l = el('label', label), i = el('input', null, 'form-control'); i.type = 'date'; i.id = id; l.append(i); $('filtros').append(l); }
    $('filtros').append(boton('Aplicar fechas', () => recargar().catch(e => mensaje(e.message))));
}
const queryFechas = () => new URLSearchParams({ desde: $('desde')?.value || '', hasta: $('hasta')?.value || '' }).toString();
async function cargarCuenta(id = seleccion) {
    const v = ++version; seleccion = Number(id); mensaje('Cargando cuenta…'); $('contenido').replaceChildren(); $('tarjetas').replaceChildren(); $('acciones').replaceChildren();
    const d = await api(`/api/finanzas/cuentas/${seleccion}`); if (v !== version) return; cuenta = d; mensaje('');
    tarjetas([['Cargos totales', d.totales.cargos], ['Pagos realizados', d.totales.pagos], ['Saldo pendiente', d.totales.saldo]]);
    const r = d.residente, s = seccion(`${r.nombres} ${r.apellidos}`);
    for (const [label, value] of [['Responsable', r.nombre_responsable], ['Parentesco', r.parentesco], ['Teléfono', r.telefono_emergencia], ['Correo familiar', r.correo_responsable], ['Cuota mensual configurada', dinero(r.cuota_mensual)]]) s.append(el('p', `${label}: ${value || 'No registrado'}`));
    $('acciones').append(boton('Registrar pago', () => abrirPagoFamiliar(d)),
        boton('Agregar cargo adicional', () => abrirFormulario({ titulo: 'Agregar cargo adicional', descripcion: 'Cargo extraordinario que aumenta la deuda del familiar. No sustituye una mensualidad ni registra un pago.', campos: [campo('concepto', 'Concepto'), campo('monto', 'Importe (Q)', 'number'), campo('fecha', 'Fecha', 'date')], base: { idResidente: seleccion }, guardar: b => api('/api/finanzas/cargos', b), despues: () => cargarCuenta() })),
        boton('Correo del responsable', () => abrirFormulario({ titulo: 'Correo del familiar responsable', campos: [campo('correo', 'Correo opcional', 'email')], valores: { correo: r.correo_responsable || '' }, guardar: b => api(`/api/finanzas/cuentas/${seleccion}/correo`, b, 'PUT'), despues: () => cargarCuenta() }), 'btn btn-secondary'));
    tabla(seccion('Movimientos cronológicos'), d.movimientos, [['Fecha', 'fecha', (v, m) => Formatos.fecha(v, m.tipo === 'Ajuste')], ['Concepto', 'concepto'], ['Tipo', 'tipo', v => v === 'Abono' ? 'Pago' : v], ['Importe', 'monto', dinero], ['Saldo acumulado', 'saldo', dinero]], m => [boton('Ver', () => m.tipo === 'Cargo' ? verCargo(d.cargos.find(c => c.id_cargo === m.id)) : m.tipo === 'Ajuste' ? detalle(d.ajustes.find(a => a.id_ajuste === m.id), 'Ajuste auditado') : verPago(d.pagos.find(p => p.id_pago === m.id)), 'btn btn-primary btn-sm')]);
    function verCargo(c) { detalle(c, 'Detalle del cargo', e => { if (c.tipo === 'Mensualidad') e.append(boton('Corregir mensualidad', () => abrirFormulario({ titulo: 'Ajustar mensualidad con trazabilidad', descripcion: 'Se conserva el importe original y el motivo en la auditoría. El nuevo importe no puede ser menor que lo abonado: ' + dinero(c.pagado), campos: [{ ...campo('monto', 'Importe corregido (Q)', 'number'), min: '0' }, campo('motivo', 'Motivo del ajuste', 'textarea')], valores: { monto: c.monto }, base: { importeAnterior: c.monto }, guardar: b => api('/api/finanzas/mensualidades/' + c.id_cargo + '/ajustar', b), despues: () => cargarCuenta() }), 'btn btn-secondary')); }); }
    function verPago(p) { detalle(p, `Comprobante de pago ${p.id_pago}`, e => tabla(e, p.detalle_aplicaciones || d.aplicaciones.filter(a => a.id_pago === p.id_pago), [['Cargo', 'id_cargo'], ['Aplicado', 'monto', dinero], ['Saldo anterior', 'saldoAnterior', dinero], ['Saldo resultante', 'saldoResultante', dinero]])); }
}
function abrirPagoFamiliar(d) {
    const mensuales = d.cargos.filter(c => c.tipo === 'Mensualidad' && Number(c.saldo) > 0);
    abrirFormulario({
        titulo: 'Registrar pago familiar', pagoFamiliar: true,
        campos: [campo('modalidad', 'Modalidad', 'select', [{ valor: 'General', texto: 'Pago general' }, { valor: 'Mensualidad', texto: 'Mensualidad específica' }]), campo('idCargo', 'Mensualidad pendiente', 'select', [{ valor: '', texto: mensuales.length ? 'Seleccione una mensualidad' : 'No hay mensualidades pendientes' }, ...mensuales.map(c => ({ valor: String(c.id_cargo), texto: Formatos.periodo(c.periodo) + ' · saldo ' + dinero(c.saldo) }))]), ...comunesPago],
        base: { idResidente: d.residente.id_residente }, preview: b => api('/api/finanzas/pagos/previsualizar', b), renderPreview: (v, e) => {
            const aviso = el('p'); avisoPago(aviso, 'atencion', 'Revise los cargos y saldos antes de confirmar.'); e.append(aviso);
            for (const texto of ['Residente: ' + v.residente, 'Responsable: ' + v.responsable, 'Modalidad: ' + (v.modalidad === 'General' ? 'Pago general' : 'Mensualidad específica'), 'Importe: ' + dinero(v.importe), v.concepto]) e.append(el('p', texto));
            tabla(e, v.aplicaciones, [['Cargo', 'id_cargo'], ['Concepto', 'concepto'], ['Período', 'periodo', v => v ? Formatos.periodo(v) : 'No aplica'], ['Saldo anterior', 'saldoAnterior', dinero], ['Aplicar', 'monto', dinero], ['Saldo resultante', 'saldoResultante', dinero], ['Pago', 'clasificacion']]);
        }, guardar: b => api('/api/finanzas/pagos', b), despues: () => cargarCuenta(d.residente.id_residente)
    });
    const modalidad = $('fin_modalidad'), cargo = $('fin_idCargo');
    const mostrar = () => { const especifica = modalidad.value === 'Mensualidad'; cargo.parentElement.hidden = !especifica; cargo.required = especifica; if (!especifica) cargo.value = ''; datosFormulario = null; };
    modalidad.addEventListener('change', mostrar); mostrar();
}
function iniciarBusqueda() {
    const label = el('label', 'Buscar residente por nombre, apellido o DPI'), input = el('input', null, 'form-control'); input.type = 'search'; input.maxLength = 100; input.id = 'buscarResidente'; label.append(input); $('filtros').append(label); const resultados = el('div', null, 'list-group'); resultados.id = 'resultadosResidentes'; $('contenido').append(resultados); let timer, seq = 0;
    input.addEventListener('input', () => { clearTimeout(timer); const v = ++seq; ++version; seleccion = 0; cuenta = null; $('tarjetas').replaceChildren(); $('acciones').replaceChildren(); $('contenido').replaceChildren(resultados); resultados.replaceChildren(); const q = input.value.trim(); if (q.length < 2) { mensaje('Escriba al menos dos caracteres.'); return; } mensaje('Buscando…'); timer = setTimeout(async () => { try { const d = await api('/api/finanzas/residentes?q=' + encodeURIComponent(q)); if (v !== seq) return; mensaje(d.residentes.length ? 'Seleccione un residente.' : 'No hay coincidencias.'); d.residentes.forEach(r => resultados.append(boton(`${r.nombres} ${r.apellidos} · DPI ${r.dpi}`, () => { ++seq; input.value = `${r.nombres} ${r.apellidos}`; cargarCuenta(r.id_residente).catch(e => mensaje(e.message)); }, 'list-group-item list-group-item-action'))); } catch (e) { if (v === seq) mensaje(e.message); } }, 300); });
}
async function resumen() {
    const d = await api('/api/finanzas/resumen?' + queryFechas()); tarjetas([['Ingresos recibidos · período', d.resumen.ingresos], ['Gastos pagados · período', d.resumen.egresos], ['Disponible estimado · acumulado', d.resumen.disponible], ['Cuentas familiares por cobrar · actual', d.resumen.porCobrar], ['Deuda con Fundación · actual', d.resumen.deudaFundacion], ['Donaciones recibidas · período', d.resumen.donaciones]]); $('contenido').replaceChildren(); mensaje('El disponible parte de saldo inicial cero. Los saldos por cobrar/pagar son actuales; las fechas filtran movimientos de efectivo.');
    for (const tipo of ['Ingreso', 'Egreso']) { const s = seccion(tipo === 'Ingreso' ? 'Ingresos por origen' : 'Egresos por categoría'); const grupos = {}; d.movimientos.filter(m => m.tipo === tipo).forEach(m => grupos[m.origen] = (grupos[m.origen] || 0) + Number(m.monto)); const max = Math.max(1, ...Object.values(grupos)); for (const [k, v] of Object.entries(grupos)) { const div = el('div', `${k}: ${dinero(v)}`, 'grafica-financiera'), bar = el('meter'); bar.min = 0; bar.max = max; bar.value = v; bar.setAttribute('aria-label', `${k}: ${dinero(v)}`); div.append(bar); s.append(div); } if (!Object.keys(grupos).length) s.append(el('p', 'Sin movimientos en el período.')); }
    tabla(seccion('Movimientos de efectivo'), d.movimientos, [['Fecha', 'fecha', fecha], ['Tipo', 'tipo'], ['Origen/categoría', 'origen'], ['Comprobante', 'id'], ['Importe', 'monto', dinero]]);
}
async function fundacion() {
    const d = await api('/api/finanzas/fundacion'); soloFundacion = !d.puedePagar;
    const total = key => d.obligaciones.reduce((n, o) => n + Math.round(Number(o[key]) * 100), 0) / 100;
    if (soloFundacion) {
        $('navegacion').hidden = true; $('volver').href = '../fundacion/fundacion_dashboard.html';
        document.querySelector('h1').textContent = 'Cobros pendientes del Asilo';
        document.querySelector('.user-info span').textContent = 'Cobros del Asilo';
        document.title = 'Cobros pendientes del Asilo | Cabeza de Algodón';
        tarjetas([['Total que nos debe el Asilo', total('saldo')], ['Pagos recibidos del Asilo', total('pagado')], ['Obligaciones pendientes', d.obligaciones.filter(o => Number(o.saldo) > 0).length, String], ['Obligaciones pagadas', d.obligaciones.filter(o => Number(o.saldo) === 0).length, String]]);
    } else tarjetas([['Total original de obligaciones', total('monto')], ['Abonos realizados por Asilo', total('pagado')], ['Saldo pendiente', total('saldo')]]);
    $('contenido').replaceChildren(); mensaje(soloFundacion ? 'El Asilo nos debe ' + dinero(total('saldo')) + '. Consulta de atenciones y pagos recibidos.' : 'Los pagos familiares no liquidan esta deuda. Cada obligación conserva el total neto de su visita.');
    tabla(seccion(soloFundacion ? 'Atenciones por cobrar al Asilo' : 'Obligaciones con Fundación'), d.obligaciones, [['Residente relacionado', 'nombres', (v, o) => v + ' ' + o.apellidos], ['Visita', 'id_visita'], ['Fecha de atención', 'fecha_visita', fecha], [soloFundacion ? 'Importe de la visita' : 'Total original de obligación', 'monto', dinero], [soloFundacion ? 'Pagos recibidos' : 'Abonos realizados por Asilo', 'pagado', dinero], ['Saldo pendiente', 'saldo', dinero], ['Estado', 'estado']], o => {
        const a = [boton('Ver', () => detalle(o, soloFundacion ? 'Atención y pagos recibidos' : 'Detalle de obligación', e => tabla(e, d.pagos.filter(p => p.id_obligacion === o.id_obligacion), [['Comprobante', 'id_pago_fundacion'], ['Fecha', 'fecha', fecha], ['Monto', 'monto', dinero], ['Método', 'metodo'], ['Referencia', 'referencia']])), 'btn btn-secondary btn-sm')];
        if (d.puedePagar && Number(o.saldo) > 0) a.push(boton('Pagar', () => abrirFormulario({ titulo: 'Pago a Fundación · saldo ' + dinero(o.saldo), campos: comunesPago, base: { idObligacion: o.id_obligacion }, guardar: b => api('/api/finanzas/fundacion/pagos', b), despues: fundacion }), 'btn btn-primary btn-sm')); return a;
    });
    tabla(seccion(soloFundacion ? 'Historial de pagos recibidos del Asilo' : 'Historial de pagos a Fundación'), d.pagos, [['Comprobante', 'id_pago_fundacion'], ['Obligación', 'id_obligacion'], ['Fecha', 'fecha', fecha], ['Importe', 'monto', dinero], ['Método', 'metodo'], ['Referencia', 'referencia']]);
}
const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function abrirMensualidad() {
    const anio = Number(hoy().slice(0, 4)), anios = Array.from({ length: anio - 1899 }, (_, i) => String(anio - i));
    const convertir = b => ({ ...b, periodo: b.anio + '-' + String(meses.indexOf(b.mes) + 1).padStart(2, '0'), idResidente: b.aplicar === 'Un residente específico' ? b.idResidente : '' });
    const validar = b => { if (b.aplicar === 'Un residente específico' && !b.idResidente) throw new Error('Seleccione un residente de los resultados.'); const convertido=convertir(b); if(convertido.periodo>hoy().slice(0,7))throw new Error('Seleccione el mes actual o uno anterior. Las mensualidades futuras todavía no pueden generarse.'); return convertido; };
    abrirFormulario({ titulo: 'Generar mensualidades', campos: [campo('mes', 'Mes', 'select', meses), campo('anio', 'Año', 'select', anios), campo('aplicar', 'Aplicar a', 'select', ['Todos los residentes activos', 'Un residente específico']), campo('idResidente', 'Buscar residente', 'residente')], valores: { mes: meses[Number(hoy().slice(5, 7)) - 1], anio: String(anio) }, preview: b => api('/api/finanzas/mensualidades/previsualizar', validar(b)), renderPreview: (d, e) => { e.append(el('p', 'Período: ' + Formatos.periodo(d.periodo) + '. ' + d.resumen.elegibles + ' elegibles, ' + d.resumen.existentes + ' existentes y ' + d.resumen.omitidas + ' omitidas.')); if (!d.filas.length) e.append(el('p', 'No hay mensualidades elegibles en este período. No se generarán cargos. Consulte el motivo de cada residente en la lista.', 'alert alert-warning')); tabla(e, d.residentes, [['Residente', 'nombres', (v, r) => v + ' ' + r.apellidos], ['Período', 'periodo', Formatos.periodo], ['Importe', 'monto', dinero], ['Elegibilidad', 'estado_elegibilidad'], ['Detalle', 'motivo']]); $('guardarModal').hidden = !d.filas.length; }, guardar: b => api('/api/finanzas/mensualidades', validar(b)) });
    const buscar = $('buscarMensualidad'), contenedor = buscar.parentElement, aplicar = $('fin_aplicar');
    buscar.placeholder = 'Nombre, apellido o DPI';
    const mostrar = () => { contenedor.hidden = aplicar.value !== 'Un residente específico'; buscar.required = !contenedor.hidden; if (contenedor.hidden) { buscar.value = ''; buscar.setCustomValidity(''); $('fin_idResidente').value = ''; } };
    aplicar.addEventListener('change', mostrar); mostrar();
}
function mensualidades() {
    mensaje('Mensualidad completa, sin prorrateo. Solo residentes con fechas de estancia verificadas; no se genera antes del ingreso ni después del retiro. Los meses anteriores se revisan en la previsualización.');
    $('acciones').append(boton('Generar mensualidades', abrirMensualidad));
    if (new URLSearchParams(window.location.search).get('revision') === 'visitas') {
        $('acciones').append(boton('Revisar visitas anteriores', () => abrirFormulario({ titulo: 'Revisar visitas pendientes de cargo', campos: [], preview: () => api('/api/finanzas/historicos'), renderPreview: (d, e) => { e.append(el('p', 'Confirme únicamente después de revisar esta lista completa. Se conservará el total neto de cada visita. Se crearán avisos; mantenga el correo desactivado durante las pruebas.')); tabla(e, d.filas, [['Visita', 'id_visita'], ['Residente', 'nombres', (v, r) => v + ' ' + r.apellidos], ['Total guardado', 'total', dinero]]); }, guardar: b => api('/api/finanzas/historicos', b) }), 'btn btn-secondary'));
    }
}
const tiposDonante = ['Empresa internacional', 'Empresa nacional', 'Gobierno', 'Particular'], categorias = ['Agua', 'Energía eléctrica', 'Alimentación', 'Mantenimiento', 'Transporte', 'Servicios', 'Otros'];
async function registros() {
    const donacion = vista === 'donaciones', d = await api(`/api/finanzas/${vista}?` + queryFechas()); const activos = d.registros.filter(r => !r.estado.startsWith('Anulad')); tarjetas([['Confirmado · período', activos.reduce((n, r) => n + Number(r.monto), 0)], ['Registros', d.registros.length, String], ['Anulados', d.registros.length - activos.length, String]]); $('contenido').replaceChildren(); const busqueda = $('buscarRegistro')?.value.toLowerCase() || '', tipo = $('tipoRegistro')?.value || ''; const filas = d.registros.filter(r => [r.donante, r.descripcion, r.concepto, r.beneficiario, r.referencia].join(' ').toLowerCase().includes(busqueda) && (!tipo || (donacion ? r.tipo_donante : r.categoria) === tipo));
    tabla(seccion('Registros recibidos/pagados'), filas, [['Fecha', 'fecha', fecha], [donacion ? 'Donante' : 'Concepto', donacion ? 'donante' : 'concepto'], [donacion ? 'Tipo' : 'Categoría', donacion ? 'tipo_donante' : 'categoria'], ['Monto', 'monto', dinero], ['Estado', 'estado']], r => { const a = [boton('Ver', () => detalle(r, donacion ? 'Detalle de donación' : 'Detalle de gasto'), 'btn btn-primary btn-sm')]; if (!r.estado.startsWith('Anulad')) a.push(boton('Anular', () => abrirFormulario({ titulo: 'Anular conservando el historial', campos: [campo('motivo', 'Motivo de anulación', 'textarea')], guardar: b => api(`/api/finanzas/${vista}/${r[donacion ? 'id_donacion' : 'id_gasto']}/anular`, b), despues: registros }), 'btn btn-danger btn-sm')); return a; });
}
function iniciarRegistros() {
    filtrosFechas(registros); const l = el('label', 'Buscar'), b = el('input', null, 'form-control'); b.type = 'search'; b.id = 'buscarRegistro'; l.append(b); const lt = el('label', 'Tipo/categoría'), t = el('select', null, 'form-select'); t.id = 'tipoRegistro'; for (const v of ['', ...(vista === 'donaciones' ? tiposDonante : categorias)]) { const o = el('option', v || 'Todos'); o.value = v; t.append(o); } lt.append(t); $('filtros').append(l, lt, boton('Buscar', () => registros().catch(e => mensaje(e.message))));
    const campos = vista === 'donaciones' ? [campo('donante', 'Donante'), campo('tipo_donante', 'Tipo de donante', 'select', tiposDonante), campo('descripcion', 'Descripción', 'textarea')] : [campo('categoria', 'Categoría', 'select', categorias), campo('concepto', 'Concepto'), campo('beneficiario', 'Beneficiario/proveedor opcional'), campo('observaciones', 'Observaciones opcionales', 'textarea')];
    $('acciones').append(boton(vista === 'donaciones' ? 'Registrar donación recibida' : 'Registrar gasto pagado', () => abrirFormulario({ titulo: vista === 'donaciones' ? 'Donación efectivamente recibida' : 'Gasto efectivamente pagado', campos: [...campos, campo('fecha', 'Fecha', 'date'), campo('monto', 'Importe (Q)', 'number'), campo('referencia', 'Referencia opcional')], guardar: b => api(`/api/finanzas/${vista}`, b), despues: registros }))); return registros();
}
async function notificaciones() { const d = await api('/api/finanzas/notificaciones'); tarjetas([['SMTP', d.configurado ? 'Configurado' : 'Configuración pendiente', String], ['Avisos recientes', d.notificaciones.length, String]]); mensaje('Pendiente no significa enviado. Los estados Incierta requieren comprobar la entrega con el proveedor; no se reenvían automáticamente.'); $('contenido').replaceChildren(); tabla(seccion('Últimos 200 avisos'), d.notificaciones, [['Aviso (ID)', 'id_notificacion'], ['Evento', 'evento'], ['Referencia', 'id_evento'], ['Destinatario', 'destinatario'], ['Estado', 'estado'], ['Intentos', 'intentos'], ['Último intento', 'ultimo_intento', v => Formatos.fecha(v, true)], ['Enviado', 'enviado_en', v => Formatos.fecha(v, true)], ['Observación', 'error']]); }
$('salir').addEventListener('click', async () => { try { await api('/api/logout', {}); window.location.href = '/'; } catch (e) { mensaje(e.message); } });
(async () => { try { if (vista === 'cuentas') iniciarBusqueda(); else if (vista === 'finanzas') { filtrosFechas(resumen); await resumen(); } else if (vista === 'fundacion') await fundacion(); else if (vista === 'mensualidades') mensualidades(); else if (vista === 'notificaciones') { $('acciones').append(boton('Actualizar', () => notificaciones().catch(e => mensaje(e.message)))); await notificaciones(); } else await iniciarRegistros(); } catch (e) { mensaje(e.message); } })();
