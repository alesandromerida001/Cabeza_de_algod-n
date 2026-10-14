const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const F = require('../frontend/compartido/formatos');
const source = fs.readFileSync('frontend/residentes/residentes.js', 'utf8');

function pagina() {
    function elemento(tag = 'div') {
        return { tag, textContent: '', value: '', children: [], dataset: {}, listeners: {}, classList: { add() {}, remove() {}, contains() { return true; } },
            set innerHTML(_) { throw Error('HTML dinámico prohibido'); },
            setAttribute(k,v) { this[k]=v; }, appendChild(e) { this.children.push(e); }, replaceChildren() { this.children=[]; },
            addEventListener(t,f,op) { (this.listeners[t] ||= []).push({f,once:op?.once}); },
            emit(t) { const ls=this.listeners[t]||[];this.listeners[t]=ls.filter(x=>!x.once);for(const x of ls)x.f({}); },
            querySelectorAll() { return []; }, focus() {}, reset() {} };
    }
    const html=fs.readFileSync('frontend/residentes/residentes.html','utf8');
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
    assert.equal(new Set(ids).size,ids.length);
    const elementos=Object.fromEntries(ids.map(id=>[id,elemento()]));
    const modales=new Map();let responder=async()=>({status:200,ok:true,json:async()=>({success:true,visitas:[]})});
    const ctx=vm.createContext({Formatos:F,Intl,Date,AbortController,console,
        MutationObserver:class{observe(){}},window:{location:{},addEventListener(){}},
        Cyberdeck:{mensaje(e,t,tipo){e.textContent=t;e.tipo=tipo;}},mostrarToast(){},
        document:{getElementById(id){assert.ok(elementos[id],id);return elementos[id];},createElement:elemento,querySelectorAll(){return[];}},
        bootstrap:{Modal:class{constructor(e){this.e=e;modales.set(e,this);}show(){this.abierto=true;}hide(){this.abierto=false;this.e.emit('hide.bs.modal');this.e.emit('hidden.bs.modal');}}},
        fetch:(url,opts)=>url==='/api/huespedes'?Promise.resolve({status:200,json:async()=>({success:true,huespedes:[]})}):responder(url,opts)
    });
    vm.runInContext(fs.readFileSync('frontend/fundacion/detalle_visita.js','utf8'),ctx);
    vm.runInContext(source,ctx);
    return {ctx,elementos,modales,responder(f){responder=f;}};
}
const respuesta=visitas=>({status:200,ok:true,json:async()=>({success:true,visitas})});
test('residentes: datos HTML se muestran literalmente, acciones y filtros/contadores permanecen',async()=>{
    const p=pagina();await new Promise(setImmediate);
    const ataque='<img src=x onerror=alert(1)>';
    const datos=[{id_residente:1,nombres:ataque,apellidos:'Prueba',dpi:ataque,nombre_responsable:ataque,estado:'Activo',cuota_mensual:100}, {id_residente:2,nombres:'Otra',apellidos:'Persona',estado:'Inactivo',cuota_mensual:200}];
    p.ctx.datos=datos;vm.runInContext('listaResidentes=datos;actualizarEstadisticas(listaResidentes);aplicarFiltrosResidentes()',p.ctx);
    const fila=p.elementos.cuerpoTablaResidentes.children[0];assert.equal(fila.children.length,7);
    assert.equal(fila.children[0].textContent,ataque+' Prueba');assert.equal(fila.children[1].textContent,ataque);assert.equal(fila.children[3].textContent,ataque);
    assert.deepEqual(fila.children[6].children.map(b=>b.textContent),['👁','Ficha médica','Modificar','Retirar']);
    let accion;p.ctx.abrirDetalle=id=>{accion=id;};p.ctx.renderizarTabla(datos);p.elementos.cuerpoTablaResidentes.children[0].children[6].children[0].emit('click');assert.equal(accion,1);
    p.elementos.buscarResidente.value='Otra';vm.runInContext("estadoFiltrado='Inactivo';aplicarFiltrosResidentes()",p.ctx);
    assert.equal(p.elementos.cuerpoTablaResidentes.children.length,1);assert.equal(p.elementos.statTotal.textContent,2);assert.equal(p.elementos.statActivos.textContent,1);assert.equal(p.elementos.statInactivos.textContent,1);
});
test('historial: carga, vacío real, error, permiso y sesión distinguidos; no conserva filas anteriores',async()=>{
    const p=pagina();let resolver;p.responder(()=>new Promise(r=>resolver=r));
    const carga=p.ctx.cargarHistorialMedico(7);assert.match(p.elementos.mensajeHistorialMedico.textContent,/Cargando/);resolver(respuesta([]));await carga;
    assert.match(p.elementos.mensajeHistorialMedico.textContent,/No existen visitas/);
    for(const status of [403,500]){p.responder(async()=>({status,ok:false,json:async()=>({success:false})}));await p.ctx.cargarHistorialMedico(7);assert.equal(p.elementos.mensajeHistorialMedico.tipo,'error');assert.equal(p.elementos.historialMedico.children.length,0);}
    p.responder(async()=>{throw Error('Sin conexión');});await p.ctx.cargarHistorialMedico(7);assert.equal(p.elementos.mensajeHistorialMedico.tipo,'error');
    p.responder(async()=>({status:401}));await p.ctx.cargarHistorialMedico(7);assert.equal(p.ctx.window.location.href,'/');
});
test('historial: respuestas tardías no mezclan residentes; detalle compartido y regreso a ficha',async()=>{
    const p=pagina();let resolver;p.responder(()=>new Promise(r=>resolver=r));const anterior=p.ctx.cargarHistorialMedico(1);
    const v={id_visita:8,nombres:'Ana',especialidad:'General',medico:'Médico',fecha_visita:'2026-10-13',diagnostico:'<svg onload=alert(1)>',examenes:'Texto libre',total:80};
    p.responder(async url=>{assert.equal(url,'/api/visitas?id_residente=2');return respuesta([v]);});await p.ctx.cargarHistorialMedico(2);resolver(respuesta([]));await anterior;
    const tabla=p.elementos.historialMedico.children[0],fila=tabla.children[1].children[0];assert.equal(fila.children[3].textContent,v.diagnostico);
    assert.equal(fila.children[4].children[0].textContent,'Exámenes: Texto libre');
    p.modales.get(p.elementos.modalFichaMedica).show();fila.children[5].children[0].emit('click');
    assert.equal(p.modales.get(p.elementos.modalFichaMedica).abierto,false);assert.equal(p.modales.get(p.elementos.modalVisita).abierto,true);assert.equal(p.elementos.detalle_diagnostico.textContent,v.diagnostico);
    p.modales.get(p.elementos.modalVisita).hide();assert.equal(p.modales.get(p.elementos.modalFichaMedica).abierto,true);
});
test('POST/PUT residentes: SQL privado nunca sale, duplicados409, cuota400 y conexión503',async()=>{
    for(const fallo of [Object.assign(Error('SQL servidor privado SELECT datos'),{}),Object.assign(Error('SQL privado'),{number:2627}),Object.assign(Error('Ingrese un importe válido con hasta dos decimales.'),{status:400}),Object.assign(Error('SQL privado'),{code:'ETIMEOUT'})]){
        const rutas=new Map(),app={use(){},listen(){}};for(const m of ['get','post','put','delete'])app[m]=(r,...h)=>rutas.set(m+' '+r,h);
        const sql={connect:async()=>({}),Transaction:class{async begin(){}async rollback(){}},Request:class{input(){return this;}async query(){throw fallo;}}};
        const ctx={__dirname:path.resolve('backend'),console:{log(){},error(){}},process:{env:{}},require(n){if(n==='express')return Object.assign(()=>app,{json(){},static(){}});if(n==='mssql')return sql;if(n==='./config/db')return{};if(n==='dotenv')return{config(){}};if(n==='./finanzas')return()=>({prepararTransaccion:async()=>{throw fallo;}});if(n==='./reportes')return()=>{};if(n==='./config/errores-db')return require('../backend/config/errores-db');return require(n);}};
        vm.runInNewContext(fs.readFileSync('backend/server.js','utf8'),ctx);
        for(const ruta of ['post /api/huespedes','put /api/huespedes/:id']){
            let status=200,body;await rutas.get(ruta).at(-1)({body:{},params:{id:'1'},usuario:{id_usuario:13}},{status(n){status=n;return this;},json(b){body=b;}});
            assert.equal(status,fallo.number?409:fallo.status|| (fallo.code?503:500));assert.equal(body.error,undefined);assert.doesNotMatch(JSON.stringify(body),/SQL privado|servidor privado|SELECT datos/);
        }
    }
});
