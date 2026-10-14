const C = require('./finanzas-calculos');
const F = require('../frontend/compartido/formatos');
const catalogo = {
    R01: 'Costos de citas médicas por paciente', R02: 'Análisis médicos y ficha del paciente',
    R03: 'Cobros por paciente y período', R04: 'Pagos a la Fundación',
    R05: 'Entradas: donaciones y cobros', R06: 'Exámenes registrados por paciente',
    R07: 'Medicamentos registrados por paciente'
};
function permitido(tipo, codigo) { return !!catalogo[codigo] && (tipo === 'Asilo' || (tipo === 'Fundacion' && !['R03','R05'].includes(codigo))); }
function filtros(q, codigo = 'R01') {
    if(codigo==='R05' && q.id_residente != null) C.fallo('El reporte de entradas no admite filtro de residente.');
    const idResidente=q.id_residente ? C.id(q.id_residente) : null;
    if(['R02','R03'].includes(codigo) && !idResidente) C.fallo('Seleccione un residente para este reporte.');
    const desde=codigo==='R02'&&!q.desde?null:C.fecha(q.desde);
    const hasta=codigo==='R02'&&!q.hasta?null:C.fecha(q.hasta);
    if (desde && hasta && desde > hasta) C.fallo('La fecha inicial no puede ser posterior a la final.');
    return { desde, hasta, idResidente };
}
const col = (key,label,type='texto') => ({key,label,type});
const paciente = col('paciente','Paciente'), fecha = col('fecha','Fecha','fecha');
const visita = col('id_visita','Visita','numero');
const dinero = (key,label) => col(key,label,'moneda');
const suma = (rows,key) => rows.reduce((n,r) => n+Math.round(Number(r[key] || 0)*100),0)/100;
const diaUTC = v => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guatemala'}).format(new Date(v));
const enPeriodo = (d,f) => d >= f.desde && d <= f.hasta;
function crear(codigo, datos, filtros, ahora = new Date()) {
    const secciones = [], avisos = [], totales = [];
    const tabla = (titulo,columnas,filas) => secciones.push({titulo,columnas,filas});
    const total = (label,value,type='moneda') => totales.push({label,value,type});
    const pacientes = datos.pacientes || [], vs = datos.visitas || [];
    const identidad = id => pacientes.find(p => p.id_residente === id)?.paciente || 'No registrado';
    const costos = [dinero('costo_consulta','Consulta'),dinero('costo_examenes','Exámenes'),dinero('costo_medicamentos','Medicamentos'),dinero('subtotal','Subtotal'),dinero('descuento','Descuento total'),dinero('total','Total neto')];
    const porcentajes = ['consulta','examenes','medicamentos'].map(k=>col('descuento_'+k+'_porcentaje','Descuento '+k+' %','porcentaje'));
    if (codigo === 'R01') {
        tabla('Visitas del período',[paciente,visita,fecha,col('fecha_cita','Cita','fecha'),col('especialidad','Especialidad'),col('medico','Médico'),col('examenes','Exámenes registrados'),col('medicamentos','Medicamentos registrados'),...costos,...porcentajes],vs);
        const grupos = new Map();
        for (const v of vs) { const g=grupos.get(v.id_residente)||{paciente:v.paciente,visitas:0,total:0,descuento:0};g.visitas++;g.total+=Math.round(v.total*100);g.descuento+=Math.round(v.descuento*100);grupos.set(v.id_residente,g); }
        tabla('Totales por paciente',[paciente,col('visitas','Visitas','numero'),dinero('descuento','Descuentos'),dinero('total','Total neto')],[...grupos.values()].map(g=>({...g,total:g.total/100,descuento:g.descuento/100})));
        total('Visitas',vs.length,'numero');total('Pacientes atendidos',grupos.size,'numero');total('Descuentos',suma(vs,'descuento'));total('Total neto',suma(vs,'total'));
        avisos.push('Se muestran importes históricos almacenados. Los porcentajes no se utilizan para recalcular las visitas.');
    }
    if (codigo === 'R02') {
        avisos.push('La ficha muestra el estado actual; el rango de fechas filtra únicamente el historial de visitas. El esquema no registra motivo de ingreso/reclusión. El diagnóstico no lo sustituye.');
        tabla('Ficha actual',[paciente,col('dpi','DPI'),col('fecha_nacimiento','Nacimiento','fecha'),col('genero','Género'),col('fecha_ingreso','Ingreso','fecha'),col('motivo_ingreso','Motivo de ingreso'),col('diagnostico','Diagnóstico registrado'),col('tipo_sangre','Tipo de sangre'),col('alergias','Alergias'),col('antecedentes','Antecedentes'),col('psicopatologias','Psicopatologías'),col('padecimientos','Padecimientos'),col('medicamentos_habituales','Medicamentos habituales'),col('asistencia','Asistencia especial'),col('observaciones','Observaciones de ficha')],pacientes);
        tabla('Historial de visitas del período',[paciente,visita,fecha,col('especialidad','Especialidad'),col('medico','Médico'),col('diagnostico','Diagnóstico'),col('examenes','Exámenes registrados'),col('resultados_examenes','Resultados'),col('medicamentos','Medicamentos registrados'),col('cantidad_medicamentos','Cantidad registrada'),col('indicaciones','Indicaciones'),col('observaciones','Observaciones')],vs);
        total('Pacientes',pacientes.length,'numero');total('Visitas en el período',vs.length,'numero');
    }
    if (codigo === 'R06' || codigo === 'R07') {
        const examen = codigo === 'R06';
        const filas = vs.filter(v=>String(v[examen?'examenes':'medicamentos']||'').trim()).map(v=>({...v,estado:examen?'Realización no verificada':'Administración y dispensación no registradas',dosis:null}));
        avisos.push(examen ? 'Los exámenes y resultados son textos registrados por visita. No existe estado de realización ni costo individual por examen. El costo mostrado corresponde al conjunto de exámenes de la visita.' : 'Estos datos son medicamentos registrados en la visita, no constancias de aplicación. No existen campos de dosis ni estados de prescripción, dispensación o administración verificados. Las indicaciones se conservan literalmente.');
        tabla(examen?'Exámenes registrados en visitas':'Medicamentos registrados en visitas',[paciente,visita,fecha,...(examen?[col('examenes','Exámenes'),col('resultados_examenes','Resultados'),dinero('costo_examenes','Costo conjunto de exámenes')]:[col('medicamentos','Medicamentos'),col('dosis','Dosis verificada'),col('cantidad_medicamentos','Cantidad registrada'),col('indicaciones','Indicaciones'),dinero('costo_medicamentos','Costo conjunto de medicamentos')]),col('estado','Evidencia disponible')],filas);
        total('Visitas con registros',filas.length,'numero');
    }
    if (codigo === 'R03') {
        const cs=datos.cargos||[], ps=datos.pagos||[], apps=datos.aplicaciones||[], ajustes=(datos.ajustes||[]).sort((a,b)=>a.id_ajuste-b.id_ajuste);
        const comprobantes=new Map((datos.operaciones||[]).map(o=>{const v=JSON.parse(o.resultado);return [v.pago.id_pago,v];}));
        const movimientos=[...cs.map(c=>({id_residente:c.id_residente,id:c.id_cargo,fecha:F.dia(c.fecha),tipo:c.tipo,concepto:c.concepto,cargo:ajustes.find(a=>a.id_cargo===c.id_cargo)?.importe_anterior??c.monto,pago:0})),...ajustes.map(a=>({id_residente:a.id_residente,id:a.id_ajuste,fecha:a.fecha||diaUTC(a.creado_en),tipo:'Ajuste',concepto:a.motivo,cargo:Math.round((a.importe_nuevo-a.importe_anterior)*100)/100,pago:0})),...ps.map(p=>({id_residente:p.id_residente,id:p.id_pago,fecha:F.dia(p.fecha),tipo:'Pago',concepto:C.describirPago(p,cs,apps,ajustes,comprobantes.get(p.id_pago)),cargo:0,pago:p.monto}))].sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.tipo==='Pago')-(b.tipo==='Pago')||a.id-b.id||a.tipo.localeCompare(b.tipo));
        const saldos=new Map();let inicial=0;
        for(const m of movimientos){const cambio=Math.round(m.cargo*100)-Math.round(m.pago*100);saldos.set(m.id_residente,(saldos.get(m.id_residente)||0)+cambio);m.saldo=saldos.get(m.id_residente)/100;m.paciente=identidad(m.id_residente);if(m.fecha<filtros.desde)inicial+=cambio;}
        const filas=movimientos.filter(m=>enPeriodo(m.fecha,filtros));
        for(const m of filas)if(m.tipo==='Pago')m.modalidad=comprobantes.get(m.id)?.modalidad||null;
        tabla('Movimientos (saldo por paciente)',[paciente,fecha,col('tipo','Tipo'),col('id','ID del movimiento','numero'),col('modalidad','Modalidad registrada'),col('concepto','Concepto'),dinero('cargo','Cargo / ajuste'),dinero('pago','Pago recibido'),dinero('saldo','Saldo del paciente')],filas);
        tabla('Desglose médico informativo de cargos del período',[paciente,col('id_cargo','Cargo','numero'),visita,fecha,...costos],cs.filter(c=>c.id_visita&&enPeriodo(F.dia(c.fecha),filtros)).map(c=>({...c,paciente:identidad(c.id_residente)})));
        tabla('Aplicaciones de pagos del período',[col('id_pago','Pago','numero'),col('id_cargo','Cargo','numero'),dinero('monto','Aplicado')],apps.filter(a=>ps.some(p=>p.id_pago===a.id_pago&&enPeriodo(F.dia(p.fecha),filtros))));
        total('Saldo inicial',inicial/100);total('Cargos y ajustes del período',suma(filas,'cargo'));total('Pagos del período',suma(filas,'pago'));total('Saldo final',Math.round(inicial+suma(filas,'cargo')*100-suma(filas,'pago')*100)/100);
        avisos.push('El desglose médico es informativo: no vuelve a sumarse a los cargos. Los ajustes se reflejan en su fecha de auditoría en Guatemala; los pagos usan su fecha contable. El saldo de cada fila corresponde a su paciente.');
    }
    if (codigo === 'R04') {
        const pagos=datos.pagosFundacion||[], obligaciones=(datos.obligaciones||[]).map(o=>{const pagado=suma(pagos.filter(p=>p.id_obligacion===o.id_obligacion),'monto');const saldo=Math.round(o.monto*100-pagado*100)/100;return {...o,pagado,saldo,estado:saldo===0?'Pagada':pagado?'Parcial':'Pendiente'};});
        const nuevos=obligaciones.filter(o=>enPeriodo(o.fecha,filtros)), recibidos=pagos.filter(p=>enPeriodo(p.fecha,filtros));
        tabla('Obligaciones y saldo al cierre',[paciente,visita,col('fecha_visita','Fecha de atención','fecha'),col('id_obligacion','Obligación','numero'),fecha,dinero('monto','Obligación original'),dinero('pagado','Pagado hasta cierre'),dinero('saldo','Saldo al cierre'),col('estado','Estado al cierre')],obligaciones);
        tabla('Pagos efectivos del período',[paciente,col('id_pago_fundacion','Pago','numero'),col('id_obligacion','Obligación','numero'),visita,fecha,dinero('monto','Pago recibido'),col('metodo','Método'),col('referencia','Referencia')],recibidos);
        total('Obligaciones generadas en período',suma(nuevos,'monto'));total('Pagos efectivos en período',suma(recibidos,'monto'));total('Saldo pendiente al cierre',suma(obligaciones,'saldo'));
        avisos.push('Las obligaciones se fechan por su creación, convertida a Guatemala. Se incluyen obligaciones anteriores para presentar el saldo al cierre. Los pagos familiares no liquidan esta deuda.');
        if(recibidos.some(p=>!obligaciones.some(o=>o.id_obligacion===p.id_obligacion)))avisos.push('Existen pagos fechados antes de la creación de su obligación. Se muestran como efectivo recibido en el período; esa obligación posterior queda fuera del saldo al cierre. Revise las fechas contables de estos registros.');
    }
    if (codigo === 'R05') {
        const filas=datos.entradas||[];
        const columnas=[fecha,col('id','ID de origen','numero'),col('origen','Origen'),col('concepto','Concepto'),dinero('monto','Importe')];
        tabla('Donaciones confirmadas',columnas,filas.filter(r=>r.categoria==='Donación'));
        tabla('Pagos familiares efectivamente recibidos',columnas,filas.filter(r=>r.categoria==='Pago familiar'));
        total('Donaciones confirmadas',suma(filas.filter(r=>r.categoria==='Donación'),'monto'));total('Pagos familiares',suma(filas.filter(r=>r.categoria==='Pago familiar'),'monto'));total('Entradas del período',suma(filas,'monto'));
        avisos.push('Solo efectivo registrado: pagos familiares y donaciones actualmente confirmadas. Las donaciones anuladas no se incluyen. Este reporte reúne todas las entradas del período, sin filtro de residente.');
    }
    return {codigo,titulo:catalogo[codigo],generado:ahora.toISOString(),filtros:{...filtros,paciente:filtros.idResidente?identidad(filtros.idResidente):'Todos'},avisos,totales,secciones};
}
module.exports={catalogo,permitido,filtros,crear};
