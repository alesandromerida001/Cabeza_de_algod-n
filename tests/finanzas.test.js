// Motor SQL simulado: no conecta ni modifica la base real.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const C = require('../backend/finanzas-calculos');
const crear = require('../backend/finanzas');
function entorno(opciones = {}) {
    let estado = { cargos: [], pagos: [], aplicaciones: [], obligaciones: [], pagosFundacion: [], avisos: [], operaciones: [], donaciones: [], gastos: [], ajustes: [] };
    const consultas = [], rutas = new Map();
    const paciente = { id_residente: 1, nombres: 'Ana', apellidos: 'Pérez', cuota_mensual: 100, estado: 'Activo', correo_responsable: 'prueba@example.test' };
    const visita = { id_visita: 10, id_solicitud: 20, id_residente: 1, fecha: '2026-01-02', fecha_visita: '2026-01-02', total: 2387.5 };
    class Transaction {
        async begin() { this.datos = structuredClone(estado); }
        async commit() { estado = this.datos; }
        async rollback() { this.revertida = true; }
    }
    class Request {
        constructor(tx) { this.tx = tx; this.p = {}; }
        input(k,t,v) { this.p[k] = v; return this; }
        async query(q) {
            const p = this.p, s = this.tx?.datos || estado; consultas.push({ q, p, tx: this.tx });
            const out = recordset => ({ recordset, rowsAffected: [1] });
            const balance = () => s.cargos.filter(c=>c.id_residente===p.idResidente).map(c=>{const pagado=s.aplicaciones.filter(a=>a.id_cargo===c.id_cargo).reduce((n,a)=>n+a.monto,0);return {...c,pagado,saldo:c.monto-pagado};});
            const obl = () => s.obligaciones.map(o=>{const pagado=s.pagosFundacion.filter(a=>a.id_obligacion===o.id_obligacion).reduce((n,a)=>n+a.monto,0);return {...o,pagado,saldo:o.monto-pagado,fecha_visita:visita.fecha,nombres:'Ana',apellidos:'Pérez'};});
            if(q.includes("OBJECT_ID('dbo.FinanzasVersion'"))return out([{finanzas:opciones.sinMigrar?0:1,tablas:opciones.sinMigrar?0:11,correo:254}]);
            if(q.includes("OBJECT_ID('dbo.ConfiguracionMensualidades'"))return out(opciones.mensualidades?[{configuracion:1,cuotas:2,ajustes:3,ingreso:3,retiro:3}]:[]);
            if(q.includes('SELECT a.* FROM dbo.AjustesMensualidades'))return out(s.ajustes);
            if(q.startsWith('SELECT id_residente,tipo,monto FROM dbo.CargosFamiliares'))return out(s.cargos.filter(c=>c.id_cargo===p.idCargo));
            if(q.startsWith('INSERT dbo.AjustesMensualidades')){const c=s.cargos.find(c=>c.id_cargo===p.idCargo);s.ajustes.push({id_ajuste:s.ajustes.length+1,id_cargo:c.id_cargo,importe_anterior:p.anterior,importe_nuevo:p.nuevo,motivo:p.motivo,creado_en:'2026-10-08'});c.monto=p.nuevo;return out([]);}
            if(q.includes('SELECT version'))return out([{version:1}]);
            if(q.includes('sp_getapplock'))return out([]);
            if(q.startsWith('SELECT resultado FROM dbo.OperacionesFinancieras'))return out(s.operaciones.filter(o=>o.tipo==='pago-familiar'&&JSON.parse(o.resultado).pago.id_residente===p.idResidente));
            if(q.startsWith('SELECT * FROM dbo.OperacionesFinancieras'))return out(s.operaciones.filter(o=>o.clave===p.clave));
            if(q.startsWith('INSERT dbo.OperacionesFinancieras')){s.operaciones.push({...p,id_usuario:p.idUsuario});return out([]);}
            if(q.includes('FROM dbo.Huespedes WHERE id_residente'))return out(p.idResidente===1?[paciente]:[]);
            if(q.includes('SELECT c.*,COALESCE'))return out(balance());
            if(q.startsWith('INSERT dbo.CargosFamiliares')){const c={id_cargo:s.cargos.length+1,id_residente:p.idResidente,id_visita:p.idVisita,tipo:p.tipo,periodo:p.periodo,fecha:p.fecha,concepto:p.concepto,monto:p.monto};s.cargos.push(c);return out([c]);}
            if(q.includes('INSERT dbo.NotificacionesCorreo')){if(!s.avisos.some(a=>a.evento===p.evento&&a.idEvento===p.idEvento))s.avisos.push(p);return out([]);}
            if(q.includes('END monto,c.id_cargo'))return out([{id_residente:1,nombres:'Ana',apellidos:'Pérez',estado:'Activo',ingreso:'2026-01-01',retiro:null,monto:s.cargos.find(c=>c.periodo===p.periodo)?.monto??paciente.cuota_mensual,id_cargo:s.cargos.find(c=>c.periodo===p.periodo)?.id_cargo??null}]);
            if(q.includes('SELECT s.id_residente,s.especialidad,s.medico'))return out([{id_residente:1,nombres:'Ana',apellidos:'Pérez',especialidad:'Medicina Interna',medico:'Dato no enviado',fecha:'2026-10-09',hora:'14:00',diagnostico:'PRIVADO'}]);
            if(q.includes('SELECT v.id_visita,v.id_solicitud,v.total'))return out(s.cargos.some(c=>c.id_visita===10)&&s.obligaciones.length?[]:[visita]);
            if(q.includes('SELECT v.id_visita,v.total,'))return out([visita]);
            if(q.startsWith('SELECT id_cargo FROM'))return out(s.cargos.filter(c=>c.id_visita===p.idVisita));
            if(q.startsWith('INSERT dbo.ObligacionesFundacion')){if(opciones.fallaObligacion)throw new Error('Fallo SQL simulado');if(!s.obligaciones.some(o=>o.id_visita===p.idVisita))s.obligaciones.push({id_obligacion:1,id_visita:p.idVisita,monto:p.monto});return out([]);}
            if(q.startsWith('INSERT dbo.PagosFamiliares')){const pago={id_pago:s.pagos.length+1,id_residente:p.idResidente,...p};s.pagos.push(pago);return out([pago]);}
            if(q.startsWith('INSERT dbo.AplicacionesPagos')){if(opciones.fallaAplicacion)throw new Error('Fallo SQL simulado');s.aplicaciones.push({id_pago:p.idPago,id_cargo:p.idCargo,monto:p.monto});return out([]);}
            if(q.startsWith('SELECT * FROM dbo.PagosFamiliares'))return out(s.pagos.filter(pago=>pago.id_residente===p.idResidente));
            if(q.includes('SELECT a.* FROM dbo.AplicacionesPagos'))return out(s.aplicaciones);
            if(q.includes('SELECT o.*,v.fecha_visita'))return out(obl());
            if(q.startsWith('INSERT dbo.PagosFundacion')){const pago={id_pago_fundacion:s.pagosFundacion.length+1,id_obligacion:p.idObligacion,...p};s.pagosFundacion.push(pago);return out([pago]);}
            if(q.includes('SELECT id_pago_fundacion'))return out(s.pagosFundacion);
            if(q.startsWith('INSERT dbo.Donaciones')){const r={id_donacion:s.donaciones.length+1,...p,estado:'Confirmada'};s.donaciones.push(r);return out([r]);}
            if(q.startsWith('INSERT dbo.Gastos')){const r={id_gasto:s.gastos.length+1,...p,estado:'Confirmado'};s.gastos.push(r);return out([r]);}
            if(q.startsWith('UPDATE dbo.Donaciones')||q.startsWith('UPDATE dbo.Gastos')){const dona=q.includes('Donaciones'),r=s[dona?'donaciones':'gastos'].find(r=>r[dona?'id_donacion':'id_gasto']===p.id);if(!r||r.motivo_anulacion)return {recordset:[],rowsAffected:[0]};Object.assign(r,{estado:p.estado,motivo_anulacion:p.motivo});return out([]);}
            if(q.includes("SELECT fecha,'Ingreso'"))return out([
                ...s.pagos.map(r=>({...r,tipo:'Ingreso',origen:'Pagos familiares'})),...s.donaciones.filter(r=>r.estado==='Confirmada').map(r=>({...r,tipo:'Ingreso',origen:'Donaciones'})),
                ...s.gastos.filter(r=>r.estado==='Confirmado').map(r=>({...r,tipo:'Egreso',origen:r.categoria})),...s.pagosFundacion.map(r=>({...r,tipo:'Egreso',origen:'Fundación'}))]);
            if(q.includes('SELECT (SELECT COALESCE(SUM(monto),0)'))return out([{saldo:s.cargos.reduce((n,c)=>n+c.monto,0)-s.pagos.reduce((n,p)=>n+p.monto,0)}]);
            throw new Error('Consulta no simulada: '+q);
        }
    }
    const sql={Transaction,Request,Int:'Int',MAX:-1,NVarChar:n=>n,Decimal:()=> 'Decimal',connect:async()=>({request:()=>new Request()})};
    const app={};for(const m of ['get','post','put'])app[m]=(url,...handlers)=>rutas.set(`${m} ${url}`,handlers);
    const auth=(req,res,next)=>req.usuario?next():res.status(401).json({success:false});
    const admin=(req,res,next)=>req.usuario.tipo_personal==='Asilo'?next():res.status(403).json({success:false});
    const modulo=crear({app,sql,dbConfig:{},verificarToken:auth,soloAdmin:admin});
    return { get estado(){return estado;}, paciente, consultas, rutas, modulo, Transaction,
        async ejecutar(ruta, body={}, opciones={}) {let status=200,payload;const req={body,params:opciones.params||{id:'1'},query:opciones.query||{},usuario:opciones.anonimo?null:{id_usuario:13,tipo_personal:opciones.tipo||'Asilo'}};
            const res={status(n){status=n;return this;},json(v){payload=v;}};
            for(const f of rutas.get(ruta)){let next=false;await f(req,res,()=>{next=true;});if(!next)break;}return {status,payload};}
    };
}
const clave=()=>crypto.randomUUID();
const cargo=()=>({idResidente:1,fecha:'2026-01-01',concepto:'Cuota',monto:100,claveOperacion:clave()});
const pago=()=>({idResidente:1,fecha:'2026-01-03',metodo:'Efectivo',referencia:'',observaciones:'',monto:50,claveOperacion:clave()});
test('centavos exactos, distribución FIFO y validaciones',()=>{
    assert.equal(C.centavos('0.29'),29);assert.equal(C.centavos('9999999999.99'),999999999999);
    for(const v of [-1,0,NaN,Infinity,'Q 1.00','1.001',{},null,'1e3'])assert.throws(()=>C.centavos(v));
    assert.deepEqual(C.distribuir([{id_cargo:1,saldo:100,concepto:'A'},{id_cargo:2,saldo:50,concepto:'B'}],125).map(a=>a.monto),[100,25]);
    assert.throws(()=>C.distribuir([{id_cargo:1,saldo:100}],101));assert.throws(()=>C.fecha('2026-02-30'));
});
test('mensualidades: revisión, duplicados, período anterior y cuota histórica',async()=>{
    const e=entorno({mensualidades:true}),base={periodo:'2026-01',claveOperacion:clave()};
    const preview=(await e.ejecutar('post /api/finanzas/mensualidades/previsualizar',base)).payload;
    const b={...base,huella:preview.huella};
    assert.equal((await e.ejecutar('post /api/finanzas/mensualidades',b)).status,200);assert.equal((await e.ejecutar('post /api/finanzas/mensualidades',b)).status,200);assert.equal(e.estado.cargos.length,1);
    e.paciente.cuota_mensual=200;assert.equal(e.estado.cargos[0].monto,100);
    assert.equal((await e.ejecutar('post /api/finanzas/mensualidades',{...b,claveOperacion:clave()})).status,409);
});
test('abonos: vista previa, distribución, recibo, reintentos y sobrepago',async()=>{
    const e=entorno();await e.ejecutar('post /api/finanzas/cargos',cargo());await e.ejecutar('post /api/finanzas/cargos',{...cargo(),monto:200});
    const b=pago();b.monto=125;b.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',b)).payload.huella;
    assert.equal((await e.ejecutar('post /api/finanzas/pagos',b)).status,200);assert.equal((await e.ejecutar('post /api/finanzas/pagos',b)).status,200);
    assert.equal(e.estado.pagos.length,1);assert.deepEqual(e.estado.aplicaciones.map(a=>a.monto),[100,25]);assert.equal(e.estado.avisos.filter(a=>a.evento==='Pago').length,1);
    assert.equal((await e.ejecutar('post /api/finanzas/pagos',{...b,monto:50})).status,409);
    assert.equal((await e.ejecutar('post /api/finanzas/pagos/previsualizar',{...pago(),monto:176})).status,400);
    const cuenta=(await e.ejecutar('get /api/finanzas/cuentas/:id')).payload;assert.deepEqual(cuenta.totales,{cargos:300,pagos:125,saldo:175});assert.equal(cuenta.movimientos.at(-1).saldo,175);
});
test('fallo al aplicar revierte pago, recibo y evento',async()=>{
    const e=entorno({fallaAplicacion:true});await e.ejecutar('post /api/finanzas/cargos',cargo());const b=pago();b.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',b)).payload.huella;
    assert.equal((await e.ejecutar('post /api/finanzas/pagos',b)).status,500);assert.equal(e.estado.pagos.length,0);assert.equal(e.estado.aplicaciones.length,0);assert.equal(e.estado.avisos.filter(a=>a.evento==='Pago').length,0);
});
test('dos previsualizaciones del mismo saldo no permiten una doble aplicación',async()=>{
    const e=entorno();await e.ejecutar('post /api/finanzas/cargos',cargo());
    const a={...pago(),monto:80},b={...pago(),monto:30};
    a.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',a)).payload.huella;
    b.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',b)).payload.huella;
    assert.equal((await e.ejecutar('post /api/finanzas/pagos',a)).status,200);
    assert.equal((await e.ejecutar('post /api/finanzas/pagos',b)).status,400);
    assert.equal(e.estado.pagos.length,1);assert.equal(e.estado.aplicaciones.reduce((n,a)=>n+a.monto,0),80);
});
test('visitas históricas idempotentes, neto guardado y obligación parcial',async()=>{
    const e=entorno(),p=(await e.ejecutar('get /api/finanzas/historicos')).payload,b={huella:p.huella,claveOperacion:clave()};
    assert.equal((await e.ejecutar('post /api/finanzas/historicos',b)).status,200);assert.equal((await e.ejecutar('post /api/finanzas/historicos',b)).status,200);
    assert.equal(e.estado.cargos[0].monto,2387.5);assert.equal(e.estado.obligaciones[0].monto,2387.5);assert.equal(e.estado.cargos.length,1);
    const abono={idObligacion:1,fecha:'2026-01-03',monto:100,metodo:'Transferencia',claveOperacion:clave()};
    assert.equal((await e.ejecutar('post /api/finanzas/fundacion/pagos',abono)).status,200);await e.ejecutar('post /api/finanzas/fundacion/pagos',abono);assert.equal(e.estado.pagosFundacion.length,1);
    assert.equal((await e.ejecutar('post /api/finanzas/fundacion/pagos',{...abono,monto:3000,claveOperacion:clave()})).status,400);
    assert.equal(e.estado.pagos.length,0);
});
test('ingresos reales y egresos sin duplicar obligaciones; anulaciones trazables',async()=>{
    const e=entorno();await e.ejecutar('post /api/finanzas/cargos',cargo());
    const b=pago();b.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',b)).payload.huella;await e.ejecutar('post /api/finanzas/pagos',b);
    await e.ejecutar('post /api/finanzas/donaciones',{donante:'Prueba',tipo_donante:'Particular',descripcion:'Recibida',fecha:'2026-01-03',monto:30,claveOperacion:clave()});
    await e.ejecutar('post /api/finanzas/gastos',{categoria:'Agua',concepto:'Servicio',fecha:'2026-01-03',monto:10,claveOperacion:clave()});
    let r=(await e.ejecutar('get /api/finanzas/resumen')).payload.resumen;assert.equal(r.ingresos,80);assert.equal(r.egresos,10);assert.equal(r.disponible,70);assert.equal(r.porCobrar,50);
    assert.equal((await e.ejecutar('post /api/finanzas/donaciones/:id/anular',{motivo:'Error de registro',claveOperacion:clave()})).status,200);
    r=(await e.ejecutar('get /api/finanzas/resumen')).payload.resumen;assert.equal(r.ingresos,50);assert.equal(e.estado.donaciones.length,1);assert.equal(e.estado.donaciones[0].estado,'Anulada');
});
test('autorización de todos los endpoints y compatibilidad anterior a migración',async()=>{
    const e=entorno();for(const ruta of e.rutas.keys()){
        assert.equal((await e.ejecutar(ruta,{}, {anonimo:true})).status,401);
        if(ruta!=='get /api/finanzas/fundacion')assert.equal((await e.ejecutar(ruta,{}, {tipo:'Fundacion'})).status,403,ruta);
    }
    assert.equal((await e.ejecutar('get /api/finanzas/fundacion',{}, {tipo:'Fundacion'})).status,200);
    assert.equal((await entorno({sinMigrar:true}).ejecutar('get /api/finanzas/resumen')).status,503);
});
test('cargo médico y obligación comparten transacción; un fallo revierte ambos',async()=>{
    const e=entorno({fallaObligacion:true}),tx=new e.Transaction();await tx.begin();
    await assert.rejects(e.modulo.registrarVisita(tx,20,13));await tx.rollback();assert.equal(e.estado.cargos.length,0);assert.equal(e.estado.avisos.length,0);
    assert.ok(e.consultas.every(c=>c.tx===tx));
});

test('corregir mensualidad auditada no modifica pagos ni permite saldo negativo; reintento único',async()=>{
    const e=entorno({mensualidades:true});await e.ejecutar('post /api/finanzas/cargos',cargo());e.estado.cargos[0].tipo='Mensualidad';
    const b=pago();b.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',b)).payload.huella;
    await e.ejecutar('post /api/finanzas/pagos',b);
    const ajustar={monto:40,motivo:'Corrección autorizada',importeAnterior:100,claveOperacion:clave()};
    assert.equal((await e.ejecutar('post /api/finanzas/mensualidades/:id/ajustar',ajustar)).status,400);
    assert.equal(e.estado.ajustes.length,0);
    ajustar.monto=75;
    assert.equal((await e.ejecutar('post /api/finanzas/mensualidades/:id/ajustar',ajustar)).status,200);
    assert.equal((await e.ejecutar('post /api/finanzas/mensualidades/:id/ajustar',ajustar)).status,200);
    assert.equal(e.estado.ajustes.length,1);assert.equal(e.estado.pagos[0].monto,50);
    const cuenta=(await e.ejecutar('get /api/finanzas/cuentas/:id')).payload;
    assert.equal(cuenta.movimientos[0].monto,100);assert.equal(cuenta.movimientos.at(-1).tipo,'Ajuste');
    assert.equal(cuenta.movimientos.at(-1).monto,-25);assert.equal(cuenta.totales.saldo,25);
    const resumen=(await e.ejecutar('get /api/finanzas/resumen')).payload.resumen;
    assert.equal(resumen.ingresos,50);assert.equal(resumen.porCobrar,25);
});

test('cita en outbox comparte transacción: no existe antes del commit y no se duplica',async()=>{
    const e=entorno(),tx=new e.Transaction();await tx.begin();
    await e.modulo.notificarCita(tx,20);await e.modulo.notificarCita(tx,20);
    assert.equal(e.estado.avisos.length,0);await tx.commit();assert.equal(e.estado.avisos.length,1);
    const aviso=e.estado.avisos[0];assert.equal(aviso.evento,'Cita');assert.match(aviso.cuerpo,/Ana Pérez/);assert.match(aviso.cuerpo,/09\/oct\/2026/);assert.match(aviso.cuerpo,/02:00 PM/);assert.doesNotMatch(aviso.cuerpo,/PRIVADO|Dato no enviado/);
});
test('mensualidad y abono notifican datos permitidos; resumen y conceptos sin alterar importes',async()=>{
    const e=entorno({mensualidades:true}),base={periodo:'2026-01',idResidente:1,claveOperacion:clave()};
    const v=(await e.ejecutar('post /api/finanzas/mensualidades/previsualizar',base)).payload;assert.equal(e.estado.avisos.length,0);assert.equal(v.resumen.elegibles,1);
    const b={...base,huella:v.huella};const r=await e.ejecutar('post /api/finanzas/mensualidades',b);
    assert.deepEqual(r.payload.resumen,{generadas:1,elegibles:1,existentes:0,omitidas:0});assert.match(r.payload.message,/1 generadas/);
    await e.ejecutar('post /api/finanzas/mensualidades',b);assert.equal(e.estado.avisos.length,1);
    assert.match(e.estado.avisos[0].cuerpo,/Período: enero 2026/);assert.match(e.estado.avisos[0].cuerpo,/01\/ene\/2026/);
    const pa=pago();pa.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',pa)).payload.huella;
    await e.ejecutar('post /api/finanzas/pagos',pa);await e.ejecutar('post /api/finanzas/pagos',pa);
    assert.equal(e.estado.avisos.filter(a=>a.evento==='Pago').length,1);
    const aviso=e.estado.avisos.find(a=>a.evento==='Pago');assert.match(aviso.cuerpo,/Importe abonado: Q 50.00/);assert.match(aviso.cuerpo,/03\/ene\/2026/);assert.match(aviso.cuerpo,/Saldo pendiente: Q 50.00/);
    let cuenta=(await e.ejecutar('get /api/finanzas/cuentas/:id')).payload;
    assert.equal(cuenta.movimientos[0].concepto,'Mensualidad de enero 2026');assert.equal(cuenta.movimientos[1].concepto,'Abono a mensualidad de enero 2026');assert.equal(cuenta.totales.saldo,50);
    await e.ejecutar('post /api/finanzas/cargos',cargo());const varios={...pago(),monto:75};varios.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',varios)).payload.huella;await e.ejecutar('post /api/finanzas/pagos',varios);
    cuenta=(await e.ejecutar('get /api/finanzas/cuentas/:id')).payload;assert.equal(cuenta.movimientos.at(-1).concepto,'Pago general aplicado a varios cargos');
});

test('mensualidad específica: abono, segundo pago completo, saldos, historial y avisos únicos',async()=>{
    const e=entorno({mensualidades:true});await e.ejecutar('post /api/finanzas/cargos',{...cargo(),monto:1000});
    Object.assign(e.estado.cargos[0],{tipo:'Mensualidad',periodo:'2026-10'});
    await e.ejecutar('post /api/finanzas/cargos',{...cargo(),monto:500});
    for(const [monto,antes,despues,concepto] of [[400,1000,600,'Abono a mensualidad de octubre 2026'],[600,600,0,'Pago completo de mensualidad de octubre 2026']]){
        const b={...pago(),monto,modalidad:'Mensualidad',idCargo:1};
        const v=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',b)).payload;
        assert.equal(v.aplicaciones.length,1);assert.equal(v.aplicaciones[0].saldoAnterior,antes);assert.equal(v.aplicaciones[0].saldoResultante,despues);assert.equal(v.concepto,concepto);
        b.huella=v.huella;const r=await e.ejecutar('post /api/finanzas/pagos',b);assert.equal(r.status,200);assert.deepEqual(r.payload.aplicaciones,v.aplicaciones);
        await e.ejecutar('post /api/finanzas/pagos',b);
        const cuenta=(await e.ejecutar('get /api/finanzas/cuentas/:id')).payload;assert.equal(cuenta.movimientos.filter(m=>m.tipo==='Abono').at(-1).concepto,concepto);
        assert.match(e.estado.avisos.filter(a=>a.evento==='Pago').at(-1).cuerpo,new RegExp(concepto));
    }
    assert.equal(e.estado.pagos.length,2);assert.equal(e.estado.avisos.filter(a=>a.evento==='Pago').length,2);
    assert.ok(e.estado.aplicaciones.every(a=>a.id_cargo===1));
    const cuenta=(await e.ejecutar('get /api/finanzas/cuentas/:id')).payload;assert.equal(cuenta.totales.saldo,500);
    // Un cambio posterior auditado no cambia la clasificación guardada de esos recibos.
    const ajuste={monto:1200,importeAnterior:1000,motivo:'Corrección posterior',claveOperacion:clave()};await e.ejecutar('post /api/finanzas/mensualidades/:id/ajustar',ajuste);
    const despues=(await e.ejecutar('get /api/finanzas/cuentas/:id')).payload;assert.equal(despues.pagos.at(-1).concepto,'Pago completo de mensualidad de octubre 2026');
});
test('rechaza excedentes específicos, cargos ajenos/no mensuales, modalidad inválida y saldo concurrente',async()=>{
    const e=entorno();await e.ejecutar('post /api/finanzas/cargos',cargo());Object.assign(e.estado.cargos[0],{tipo:'Mensualidad',periodo:'2026-01'});
    await e.ejecutar('post /api/finanzas/cargos',{...cargo(),monto:500});
    const base={...pago(),modalidad:'Mensualidad',idCargo:1,monto:101};
    const exceso=await e.ejecutar('post /api/finanzas/pagos/previsualizar',base);assert.equal(exceso.status,400);assert.match(exceso.payload.message,/No se distribuirá/);
    for(const cambios of [{idCargo:2},{idCargo:99},{modalidad:'Otra'},{modalidad:'General'}])assert.equal((await e.ejecutar('post /api/finanzas/pagos/previsualizar',{...base,monto:50,...cambios})).status,400);
    const b={...base,monto:50};b.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',b)).payload.huella;
    const paralelo={...b,monto:25,claveOperacion:clave()};paralelo.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',paralelo)).payload.huella;await e.ejecutar('post /api/finanzas/pagos',paralelo);
    assert.equal((await e.ejecutar('post /api/finanzas/pagos',b)).status,409);assert.equal(e.estado.pagos.length,1);
});
test('pago general FIFO y pago único completo mantienen clasificación y sumas',async()=>{
    const e=entorno();await e.ejecutar('post /api/finanzas/cargos',cargo());await e.ejecutar('post /api/finanzas/cargos',cargo());
    const b={...pago(),modalidad:'General',monto:150};b.huella=(await e.ejecutar('post /api/finanzas/pagos/previsualizar',b)).payload.huella;
    const r=(await e.ejecutar('post /api/finanzas/pagos',b)).payload;assert.deepEqual(r.aplicaciones.map(a=>[a.id_cargo,a.monto,a.saldoResultante]),[[1,100,0],[2,50,50]]);assert.equal(r.concepto,'Pago general aplicado a varios cargos');
    assert.match(e.estado.avisos.at(-1).cuerpo,/Modalidad: Pago general/);
    const f=entorno();await f.ejecutar('post /api/finanzas/cargos',cargo());Object.assign(f.estado.cargos[0],{tipo:'Mensualidad',periodo:'2026-10'});
    const completo={...pago(),modalidad:'Mensualidad',idCargo:1,monto:100};completo.huella=(await f.ejecutar('post /api/finanzas/pagos/previsualizar',completo)).payload.huella;
    assert.equal((await f.ejecutar('post /api/finanzas/pagos',completo)).payload.concepto,'Pago completo de mensualidad de octubre 2026');
});
