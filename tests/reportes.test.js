// Datos en memoria únicamente. No abre SQL Server, SMTP ni el servidor del proyecto.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../backend/reportes-calculos'),E=require('../backend/reportes-exportar');
const montar=require('../backend/reportes');
const filtros={desde:'2026-10-01',hasta:'2026-10-31',idResidente:null};
const pacientes=[{id_residente:1,paciente:'Paciente de prueba',dpi:'PRUEBA',fecha_ingreso:null,diagnostico:'Diagnóstico clínico'}];
const visita={id_residente:1,id_visita:10,paciente:'Paciente de prueba',fecha:'2026-10-07',costo_consulta:100,costo_examenes:50,costo_medicamentos:25,subtotal:175,descuento:35,total:140,descuento_consulta_porcentaje:20,examenes:'Hemograma',resultados_examenes:'Resultado registrado',medicamentos:'Medicamento registrado',cantidad_medicamentos:'Una caja'};
const crear=(id,datos={})=>R.crear(id,{pacientes,...datos},filtros,new Date('2026-10-10T02:00:00Z'));
const totales=r=>Object.fromEntries(r.totales.map(t=>[t.label,t.value]));
test('R01 suma importes almacenados una vez, agrupa pacientes y no recalcula descuentos',()=>{
    const r=crear('R01',{visitas:[visita,{...visita,id_visita:11,total:133}]});
    assert.equal(totales(r)['Total neto'],273);assert.equal(r.secciones[1].filas.length,1);assert.equal(r.secciones[1].filas[0].visitas,2);
    assert.equal(r.secciones[0].filas[1].total,133);
});
test('R02 no convierte diagnóstico en motivo de ingreso; R06/R07 no afirman realización ni administración',()=>{
    const r=crear('R02',{visitas:[visita]});assert.equal(r.secciones[0].filas[0].motivo_ingreso,undefined);assert.equal(E.visible(null,'fecha'),'No registrado');assert.match(r.avisos[0],/no registra motivo/);
    for(const id of ['R06','R07']){const d=crear(id,{visitas:[visita,{id_visita:11,examenes:'',medicamentos:null}]});assert.equal(d.secciones[0].filas.length,1);assert.match(d.secciones[0].filas[0].estado,/no verificada|no registradas/);}
});
test('R03 apertura, ajustes, abonos parciales, cierre y desglose sin doble conteo',()=>{
    const cargos=[{id_cargo:1,id_residente:1,tipo:'Mensualidad',periodo:'2026-09',fecha:'2026-09-01',concepto:'Mensualidad septiembre',monto:80},{id_cargo:2,id_residente:1,tipo:'Medico',id_visita:10,fecha:'2026-10-07',concepto:'Atención médica',monto:140,...Object.fromEntries(['costo_consulta','costo_examenes','costo_medicamentos','subtotal','descuento','total'].map(k=>[k,visita[k]]))}];
    const pagos=[{id_pago:1,id_residente:1,fecha:'2026-09-10',monto:25,creado_en:'2026-09-10T12:00:00Z'},{id_pago:2,id_residente:1,fecha:'2026-10-08',monto:25,creado_en:'2026-10-08T12:00:00Z'},{id_pago:3,id_residente:1,fecha:'2026-10-09',monto:30,creado_en:'2026-10-09T12:00:00Z'}];
    const aplicaciones=pagos.map(p=>({id_pago:p.id_pago,id_cargo:1,monto:p.monto}));
    const ajustes=[{id_ajuste:1,id_residente:1,id_cargo:1,importe_anterior:100,importe_nuevo:80,motivo:'Corrección',creado_en:'2026-10-01T05:00:00Z'}];
    const r=crear('R03',{cargos,pagos,aplicaciones,ajustes});
    assert.deepEqual(totales(r),{'Saldo inicial':55,'Cargos y ajustes del período':140,'Pagos del período':55,'Saldo final':140});
    assert.match(r.secciones[0].filas[1].concepto,/Abono a mensualidad/);assert.match(r.secciones[0].filas[2].concepto,/Pago completo de mensualidad/);
    assert.equal(r.secciones[1].filas.length,1);assert.equal(r.secciones[2].filas.length,2);
});
test('R03 comprobante preserva modalidad/concepto y ajuste posterior no altera el cierre',()=>{
    const cargos=[{id_cargo:1,id_residente:1,fecha:'2026-09-01',tipo:'Manual',monto:60,concepto:'Cargo'}];
    const pagos=[{id_pago:1,id_residente:1,fecha:'2026-10-05',monto:20}];
    const ajustes=[{id_ajuste:1,id_residente:1,id_cargo:1,importe_anterior:100,importe_nuevo:60,creado_en:'2026-11-01T12:00:00Z'}];
    const operaciones=[{resultado:JSON.stringify({pago:pagos[0],modalidad:'General',concepto:'Pago general aplicado a varios cargos'})}];
    const r=crear('R03',{cargos,pagos,ajustes,operaciones});assert.equal(totales(r)['Saldo final'],80);assert.equal(r.secciones[0].filas[0].modalidad,'General');
});
test('R04 separa obligaciones previas, nuevas y pagos efectivos parciales del período',()=>{
    const r=crear('R04',{obligaciones:[{id_obligacion:1,fecha:'2026-09-01',monto:100},{id_obligacion:2,fecha:'2026-10-01',monto:200}],pagosFundacion:[{id_obligacion:1,fecha:'2026-09-10',monto:20},{id_obligacion:1,fecha:'2026-10-10',monto:30}]});
    assert.deepEqual(totales(r),{'Obligaciones generadas en período':200,'Pagos efectivos en período':30,'Saldo pendiente al cierre':250});assert.equal(r.secciones[0].filas[0].estado,'Parcial');assert.equal(r.secciones[1].filas.length,1);
});
test('R05 solo suma efectivo, categorías separadas y no cargos ni obligaciones',()=>{
    const r=crear('R05',{entradas:[{categoria:'Pago familiar',monto:25},{categoria:'Donación',monto:75}],cargos:[{monto:500}],obligaciones:[{monto:800}]});
    assert.deepEqual(totales(r),{'Donaciones confirmadas':75,'Pagos familiares':25,'Entradas del período':100});
});
test('R04 no oculta efectivo fechado antes de crear la obligación',()=>{
    const r=crear('R04',{obligaciones:[],pagosFundacion:[{id_obligacion:9,fecha:'2026-10-10',monto:30}]});
    assert.equal(totales(r)['Pagos efectivos en período'],30);assert.equal(r.secciones[1].filas.length,1);assert.match(r.avisos.at(-1),/antes de la creación/);
});
test('siete reportes vacíos, fechas inválidas y restricciones de paciente',()=>{
    for(const id of Object.keys(R.catalogo)){const r=R.crear(id,{},filtros);assert.ok(r.secciones.every(s=>s.filas.length===0));assert.ok(r.totales.every(t=>t.value===0));}
    assert.deepEqual(R.filtros({...filtros,id_residente:'17'}),{...filtros,idResidente:17});
    for(const q of [{...filtros,desde:'2026-02-30'},{...filtros,hasta:'2025-01-01'},{...filtros,id_residente:'1 OR 1=1'}])assert.throws(()=>R.filtros(q));
});
function entorno(recordsets=[pacientes,[visita]]){
    const rutas={},calls=[],estado={commit:0,rollback:0};
    const sql={Int:'Int',Date:'Date',ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},async connect(){calls.push('connect');return {};},
        Transaction:class {async begin(level){assert.equal(level,'SERIALIZABLE');}async commit(){estado.commit++;}async rollback(){estado.rollback++;}},
        Request:class{constructor(tx,overrides){this.params={};this.timeout=overrides.requestTimeout;}input(n,t,v){this.params[n]=v;return this;}async query(text){calls.push({text,params:this.params,timeout:this.timeout});return {recordsets};}}
    };
    montar({app:{get:(p,...h)=>rutas[p]=h},sql,dbConfig:{},verificarToken:(req,res,next)=>req.usuario?next():res.status(401).json({message:'Sin sesión'})});
    async function ejecutar(path,{tipo='Asilo',id=13,params={},query=filtros}={}){
        const req={usuario:tipo?{tipo_personal:tipo,id_usuario:id}:null,params,query};
        const res={statusCode:200,headers:{},status(s){this.statusCode=s;return this;},set(k,v){this.headers[k]=v;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;}};
        let i=0;async function next(){const h=rutas[path][i++];if(h)await h(req,res,next);}await next();return res;
    }
    return {ejecutar,calls,estado};
}
test('rutas: autenticación, permisos por tipo, filtros parametrizados y snapshot privado',async()=>{
    const e=entorno();assert.equal(e.calls.length,0);
    assert.equal((await e.ejecutar('/api/reportes',{tipo:null})).statusCode,401);
    assert.equal((await e.ejecutar('/api/reportes',{tipo:'Admin'})).statusCode,403);
    assert.equal((await e.ejecutar('/api/reportes',{tipo:'Asilo'})).body.reportes.length,7);
    assert.equal((await e.ejecutar('/api/reportes',{tipo:'Fundacion'})).body.reportes.length,5);
    for(const codigo of ['R03','R05'])assert.equal((await e.ejecutar('/api/reportes/:codigo',{tipo:'Fundacion',params:{codigo}})).statusCode,403);
    const r=await e.ejecutar('/api/reportes/:codigo',{params:{codigo:'R01'},query:{...filtros,id_residente:'1'}});
    assert.equal(r.statusCode,200);assert.equal(e.estado.commit,1);assert.deepEqual(e.calls[1].params,{id:1,desde:filtros.desde,hasta:filtros.hasta});assert.equal(e.calls[1].timeout,30000);
    const ruta='/api/reportes/exportar/:token/:formato',params={token:r.body.token,formato:'pdf'};
    assert.equal((await e.ejecutar(ruta,{id:14,params})).statusCode,410);
    assert.equal((await e.ejecutar(ruta,{params:{...params,formato:'html'}})).statusCode,400);
    const x=await e.ejecutar(ruta,{params});assert.equal(x.statusCode,200);assert.equal(x.body.subarray(0,5).toString(),'%PDF-');assert.equal(e.calls.length,2,'exportar no vuelve a consultar SQL');
    const privado=entorno([pacientes,[],[],[],[],[]]);const fin=await privado.ejecutar('/api/reportes/:codigo',{params:{codigo:'R03'},query:{...filtros,id_residente:'1'}});
    assert.equal((await privado.ejecutar(ruta,{tipo:'Fundacion',params:{token:fin.body.token,formato:'pdf'}})).statusCode,403);
});
test('consulta excesiva revierte lectura sin exportar datos truncados; consulta desconocida no toca SQL',async()=>{
    const e=entorno([pacientes,Array(5001).fill(visita)]);assert.equal((await e.ejecutar('/api/reportes/:codigo',{params:{codigo:'R01'}})).statusCode,413);assert.equal(e.estado.rollback,1);assert.equal(e.estado.commit,0);
    const otra=entorno();assert.equal((await otra.ejecutar('/api/reportes/:codigo',{params:{codigo:'x'}})).statusCode,403);assert.equal(otra.calls.length,0);
});
test('consultas de los siete reportes solo SELECT, rango inclusivo, paciente y entradas sin duplicación',()=>{
    for(const codigo of Object.keys(R.catalogo)){const q=montar.consulta(codigo);assert.doesNotMatch(q.sql,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/i);assert.match(q.sql,/@id IS NULL/);assert.match(q.sql,/@hasta/);}
    const q=montar.consulta('R05').sql;assert.match(q,/estado='Confirmada'/);assert.match(q,/@id IS NULL AND estado/);assert.match(q,/OUTER APPLY \(SELECT TOP\(1\)/);assert.doesNotMatch(q,/CargosFamiliares|ObligacionesFundacion/);
});
test('PDF reales de los siete reportes, fechas españolas y filtros pertinentes',async()=>{
    for(const codigo of Object.keys(R.catalogo)){
        const informe=crear(codigo,{visitas:[visita]});const pdf=await E.pdf(informe);
        assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);
        assert.match(E.filtros(informe),/01\/oct\/2026/);
        if(codigo==='R05')assert.doesNotMatch(E.filtros(informe),/Paciente/);
    }
    assert.match(E.filtros({codigo:'R02',filtros:{paciente:'Prueba',desde:null,hasta:null}}),/Historial completo/);
    assert.equal(E.xlsx,undefined);
});
test('frontend: IDs, listeners únicos, menú por tipo, render seguro y filtros invalidan exportación',async()=>{
    const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'frontend/reportes/reportes.html'),'utf8'),source=fs.readFileSync(path.join(root,'frontend/reportes/reportes.js'),'utf8');
    function el(){return {value:'',children:[],listeners:{},textContent:'',addEventListener(k,fn){assert.ok(!this.listeners[k],k+' duplicado');this.listeners[k]=fn;},appendChild(e){this.children.push(e);if(e.value&&!this.value)this.value=e.value;},replaceChildren(...es){this.children=es;},setAttribute(){}};}
    const ids=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],el()]));
    const context=vm.createContext({document:{getElementById(id){assert.ok(ids[id],id);return ids[id];},createElement:el},window:{location:{}},Formatos:require('../frontend/compartido/formatos'),Intl,Date,URLSearchParams,clearTimeout,setTimeout,fetch:async()=>({ok:true,json:async()=>({tipo_personal:'Fundacion',reportes:[{id:'R01',nombre:'Costos'}]})})});
    vm.runInContext(source,context);await new Promise(r=>setImmediate(r));assert.equal(ids.volver.href,'/fundacion/fundacion_dashboard.html');assert.equal(ids.reporte.children.length,1);
    context.mostrar(crear('R01',{visitas:[{...visita,paciente:'<script>no ejecutar</script>'}]}));assert.ok(ids.resultado.children.length>2);assert.doesNotMatch(source,/innerHTML|\balert\(|\bconfirm\(/);
    ids.desde.listeners.change();assert.equal(ids.pdf.disabled,true);assert.equal(ids.resultado.children.length,0);
});

test('contratos dinámicos: R02/R03 requieren residente, R02 admite límites opcionales, R05 rechaza residente',async()=>{
    for(const codigo of ['R02','R03'])assert.throws(()=>R.filtros(filtros,codigo),/Seleccione un residente/);
    assert.deepEqual(R.filtros({id_residente:'1'},'R02'),{idResidente:1,desde:null,hasta:null});
    assert.equal(R.filtros({id_residente:'1',desde:'2026-10-01'},'R02').hasta,null);
    assert.throws(()=>R.filtros({...filtros,id_residente:'1'},'R05'),/no admite/);
    assert.throws(()=>R.filtros({id_residente:'1'},'R03'),/Fecha/);
    const e=entorno();const r=await e.ejecutar('/api/reportes/:codigo',{params:{codigo:'R02'},query:{id_residente:'1'}});
    assert.equal(r.statusCode,200);assert.deepEqual(e.calls[1].params,{id:1,desde:null,hasta:null});
    for(const codigo of Object.keys(R.catalogo)){
        const sets=montar.consulta(codigo).nombres.map(n=>n==='pacientes'?pacientes:[]);
        const e=entorno(sets),r=await e.ejecutar('/api/reportes/:codigo',{params:{codigo},query:{...filtros,...(['R02','R03'].includes(codigo)?{id_residente:'1'}:{})}});
        assert.equal(r.statusCode,200,codigo);assert.equal(e.estado.commit,1);
        const d=await e.ejecutar('/api/reportes/exportar/:token/:formato',{params:{token:r.body.token,formato:'pdf'}});assert.equal(d.statusCode,200,codigo);assert.equal(d.body.subarray(0,5).toString(),'%PDF-');
        assert.equal((await e.ejecutar('/api/reportes/exportar/:token/:formato',{params:{token:r.body.token,formato:'xlsx'}})).statusCode,400);
    }
});
