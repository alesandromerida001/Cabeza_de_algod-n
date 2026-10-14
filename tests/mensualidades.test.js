// SQL simulado; no conecta a SQL Server ni ejecuta migraciones.
const test = require('node:test');
const assert = require('node:assert/strict');
const crear = require('../backend/mensualidades');
function entorno({ activo = true, inicio = '2026-08-01', hoy = '2026-10-08', parcial = false } = {}) {
    const residentes = [
        { id_residente:1, nombres:'A', apellidos:'DEMO', estado:'Activo', fecha_ingreso:'2026-08-10', fecha_retiro:null, cuota_mensual:4000 },
        { id_residente:2, nombres:'B', apellidos:'DEMO', estado:'Inactivo', fecha_ingreso:'2026-08-01', fecha_retiro:'2026-09-15', cuota_mensual:2000 },
        { id_residente:3, nombres:'C', apellidos:'DEMO', estado:'Activo', fecha_ingreso:'2026-10-15', fecha_retiro:null, cuota_mensual:3000 },
        { id_residente:4, nombres:'D', apellidos:'DEMO', estado:'Activo', fecha_ingreso:null, fecha_retiro:null, cuota_mensual:4000 },
        { id_residente:5, nombres:'E', apellidos:'DEMO', estado:'Inactivo', fecha_ingreso:'2026-01-01', fecha_retiro:null, cuota_mensual:5000 }
    ];
    let estado = { cargos:[], avisos:[], cuotas:residentes.map((h,i)=>({id_cuota:i+1,id_residente:h.id_residente,desde:'2026-08-01',monto:h.cuota_mensual})) };
    const consultas=[];
    async function query(db,q,p={}) {
        consultas.push({q,p}); const s=db?.estado||estado; const out=recordset=>({recordset});
        if(q.includes("OBJECT_ID('dbo.ConfiguracionMensualidades'"))return out([{configuracion:1,cuotas:2,ajustes:parcial?null:3,ingreso:3,retiro:3}]);
        if(q.startsWith('SELECT inicio'))return out([{inicio,preparado_el:'2026-08-05'}]);
        if(q.includes('END monto,c.id_cargo')) {
            assert.match(q,/c\.periodo=@periodo/);
            return out(residentes.filter(h=>(p.automatico||p.idResidente||h.estado==='Activo')&&(!p.idResidente||h.id_residente===p.idResidente))
                .map(h=>{const cu=s.cuotas.filter(c=>c.id_residente===h.id_residente&&c.desde<=p.fecha).sort((a,b)=>b.desde.localeCompare(a.desde)||b.id_cuota-a.id_cuota)[0];return {...h,ingreso:h.fecha_ingreso,retiro:h.fecha_retiro,monto:s.cargos.find(c=>c.idResidente===h.id_residente&&c.periodo===p.periodo)?.monto??cu?.monto??null,id_cargo:s.cargos.some(c=>c.idResidente===h.id_residente&&c.periodo===p.periodo)?1:null};}));
        }
        if(q.startsWith('SELECT cuota_mensual'))return out(residentes.filter(h=>h.id_residente===p.idResidente));
        if(q.startsWith('INSERT dbo.CuotasResidentes')){s.cuotas.push({id_cuota:s.cuotas.length+1,id_residente:p.idResidente,desde:p.desde,monto:p.monto});return out([]);}
        throw Error('SQL no simulado: '+q);
    }
    // Cola representa el bloqueo transaccional común entre procesos; rollback restaura estado.
    let cola=Promise.resolve();
    function transaccion(fn){const r=cola.then(async()=>{const tx={estado:structuredClone(estado)};const out=await fn(tx);estado=tx.estado;return out;});cola=r.catch(()=>{});return r;}
    const dependencias={query,pool:async()=>null,transaccion,hoy:()=>hoy,env:{MENSUALIDADES_AUTOMATICAS:activo?'true':'false'},cargoNuevo:async(tx,c)=>{assert.ok(tx);if(tx.estado.cargos.some(x=>x.periodo===c.periodo&&x.idResidente===c.idResidente))throw Error('UNIQUE');tx.estado.cargos.push(c);tx.estado.avisos.push(c.idResidente+':'+c.periodo);}};
    return { modulo:crear(dependencias), otro:()=>crear(dependencias), get estado(){return estado;}, residentes, consultas, setHoy:valor=>hoy=valor, tx:transaccion };
}
test('automatización apagada no consulta ni modifica datos',async()=>{
    const e=entorno({activo:false});assert.equal((await e.modulo.recuperar()).desactivado,true);assert.equal(e.consultas.length,0);
});
test('recuperación desde activación, ingreso, retiro, fechas ausentes y sin futuros',async()=>{
    const e=entorno();assert.equal((await e.modulo.recuperar()).cantidad,5);
    assert.deepEqual(e.estado.cargos.filter(c=>c.idResidente===1).map(c=>c.periodo),['2026-08','2026-09','2026-10']);
    assert.deepEqual(e.estado.cargos.filter(c=>c.idResidente===2).map(c=>c.periodo),['2026-08','2026-09']);
    assert.equal(e.estado.cargos.filter(c=>c.idResidente===3).length,0); // todavía no ingresó
    assert.equal(e.estado.cargos.some(c=>c.idResidente>=4),false);
    await assert.rejects(e.modulo.vista(null,{periodo:'2026-11'}),/futuras/);
});
test('reinicios y dos procesos no duplican cargos ni avisos',async()=>{
    const e=entorno();await Promise.all([e.modulo.recuperar(),e.modulo.recuperar(),e.otro().recuperar()]);
    assert.equal(e.estado.cargos.length,5);assert.equal(new Set(e.estado.avisos).size,5);
    assert.equal((await e.otro().recuperar()).cantidad,0);
});
test('inicio ausente no activa; período anterior a preparación y esquema parcial se rechazan',async()=>{
    assert.equal((await entorno({inicio:null}).modulo.recuperar()).desactivado,true);
    await assert.rejects(entorno({inicio:'2026-07-01'}).modulo.recuperar(),/anterior/);
    await assert.rejects(entorno({parcial:true}).modulo.recuperar(),/incompleta/);
    assert.deepEqual(crear.periodos('2026-12','2027-02'),['2026-12','2027-01','2027-02']);
});
test('cambio de cuota conserva meses anteriores y cargos emitidos; nueva cuota siguiente mes',async()=>{
    const e=entorno();await e.modulo.recuperar();await e.tx(tx=>e.modulo.cuota(tx,1,1000,13));
    const nueva=e.estado.cuotas.at(-1);assert.equal(nueva.desde,'2026-11-01');assert.equal(nueva.monto,1000);
    assert.ok(e.estado.cargos.filter(c=>c.idResidente===1).every(c=>c.monto===4000));
    e.residentes[0].cuota_mensual=1000;
    const previo=e.estado.cuotas.length;await e.tx(tx=>e.modulo.cuota(tx,1,1000,13));assert.equal(e.estado.cuotas.length,previo);
    e.setHoy('2026-11-08');await e.modulo.recuperar();assert.equal(e.estado.cargos.find(c=>c.idResidente===1&&c.periodo==='2026-11').monto,1000);
    assert.equal(e.estado.cargos.find(c=>c.idResidente===1&&c.periodo==='2026-10').monto,4000);
    await assert.rejects(e.tx(tx=>e.modulo.cuota(tx,1,-1,13)),/importe/);
});
test('individual permite revisar estancia pasada; lote manual solo activos y vista previa sin escrituras',async()=>{
    const e=entorno();const lote=await e.modulo.vista(null,{periodo:'2026-08'});
    assert.deepEqual(lote.filas.map(r=>r.id_residente),[1]);
    const individual=await e.modulo.vista(null,{periodo:'2026-08',idResidente:2});assert.equal(individual.filas[0].id_residente,2);
    assert.equal(e.estado.cargos.length,0);
});
test('previsualización explica ingreso, retiro, historia ausente y existentes sin cargos ni avisos',async()=>{
    const e=entorno();
    let v=await e.modulo.vista(null,{periodo:'2026-01',idResidente:1});
    assert.equal(v.resumen.omitidas,1);assert.match(v.residentes[0].motivo,/anterior al ingreso \(10\/ago\/2026\)/);assert.equal(v.filas.length,0);
    v=await e.modulo.vista(null,{periodo:'2026-10',idResidente:2});assert.match(v.residentes[0].motivo,/posterior al retiro/);
    e.residentes[0].fecha_ingreso='2026-01-01';
    v=await e.modulo.vista(null,{periodo:'2026-07',idResidente:1});assert.match(v.residentes[0].motivo,/cuota histórica verificable/);assert.equal(v.residentes[0].monto,null);
    assert.equal(e.estado.cargos.length,0);assert.equal(e.estado.avisos.length,0);
    v=await e.modulo.vista(null,{periodo:'2026-10',idResidente:1});assert.equal(v.resumen.elegibles,1);
    await e.tx(tx=>e.modulo.generar(tx,v,13));assert.equal(e.estado.cargos.length,1);assert.equal(e.estado.avisos.length,1);
    v=await e.modulo.vista(null,{periodo:'2026-10',idResidente:1});assert.equal(v.resumen.existentes,1);assert.match(v.residentes[0].motivo,/ya existe/);assert.equal(v.filas.length,0);
    await e.tx(tx=>e.modulo.generar(tx,v,13));assert.equal(e.estado.cargos.length,1);assert.equal(e.estado.avisos.length,1);
    const lote=await e.modulo.vista(null,{periodo:'2026-10'});assert.equal(lote.residentes.length,3);assert.equal(lote.resumen.existentes,1);assert.equal(lote.resumen.omitidas,2);
});
test('server integra cuota y alta en la transacción del residente; un fallo revierte todo',async()=>{
    const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
    const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
    for(const falla of [false,true]) {
        const rutas=new Map(),eventos=[];
        class Transaction {async begin(){eventos.push({tipo:'begin',tx:this});}async commit(){eventos.push({tipo:'commit',tx:this});}async rollback(){eventos.push({tipo:'rollback',tx:this});}}
        class Request {constructor(tx){this.tx=tx;}input(){return this;}async query(q){eventos.push({tipo:'query',q,tx:this.tx});return {recordset:[{id_residente:81}],rowsAffected:[1]};}}
        const sql={Transaction,Request,Int:'Int',Bit:'Bit',Date:'Date',VarChar:()=>'',Decimal:()=>'',connect:async()=>({request:()=>new Request()})};
        const app={use(){},listen(){}};for(const m of ['get','post','put','delete'])app[m]=(url,...handlers)=>rutas.set(m+' '+url,handlers);
        const express=Object.assign(()=>app,{json(){},static(){}});
        const finanzas={prepararTransaccion:async tx=>eventos.push({tipo:'lock',tx}),registrarCuota:async(tx,id,monto,actor,alta)=>{eventos.push({tipo:'cuota',tx,id,monto,actor,alta});if(falla)throw Error('Fallo cuota simulado');return {desde:'2026-11'};},retirarResidente:async id=>{eventos.push({tipo:'retiro',id});return {rowsAffected:[1]};}};
        vm.runInNewContext(source,{__dirname:path.join(root,'backend'),console:{log(){},error(){}},process:{env:{}},require:n=>n==='express'?express:n==='mssql'?sql:n==='./config/db'?{}:n==='dotenv'?{config(){}}:n==='./finanzas'?()=>finanzas:n==='./config/errores-db'?require('../backend/config/errores-db'):n==='./reportes'?require('../backend/reportes'):require(n)});
        for(const metodo of ['post','put']) {
            eventos.length=0;let respuesta,status=200;const req={body:{cuotaMensual:'1000'},params:{id:'81'},usuario:{id_usuario:13,tipo_personal:'Asilo'}};
            await rutas.get(metodo+' /api/huespedes'+(metodo==='put'?'/'+':id':'')).at(-1)(req,{json:x=>respuesta=x,status(n){status=n;return this;}});
            const cuota=eventos.find(e=>e.tipo==='cuota');assert.equal(cuota.id,81);assert.equal(cuota.actor,13);assert.equal(!!cuota.alta,metodo==='post');
            assert.equal(eventos[0].tipo,'begin');assert.equal(eventos[1].tipo,'lock');assert.ok(eventos.every(e=>e.tx===cuota.tx));
            assert.equal(eventos.at(-1).tipo,falla?'rollback':'commit');assert.equal(status,falla?500:200);
            if(!falla&&metodo==='put')assert.match(respuesta.message,/noviembre 2026/);
        }
        eventos.length=0;await rutas.get('delete /api/huespedes/:id').at(-1)({params:{id:'81'}},{json(){},status(){return this;}});
        assert.deepEqual(eventos,[{tipo:'retiro',id:'81'}]);
    }
});
