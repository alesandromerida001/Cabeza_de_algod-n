const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {once}=require('node:events');
const errores=require('../backend/config/errores-db');
test('conexión rechazada y cancelación SQL responden 503 sin detalles internos',async()=>{
    for(const code of ['ETIMEOUT','ESOCKET','ECANCEL','ECONNREFUSED']){
        const res={status(n){this.code=n;return this;},json(b){this.body=b;}};
        assert.equal(errores.responder({code,message:'SQL secreto'},res),true);assert.equal(res.code,503);assert.doesNotMatch(res.body.message,/SQL secreto/);assert.match(res.body.message,/antes de reintentar/);
    }
    const express=require('express'),app=express();
    require('../backend/reportes')({app,sql:{connect:async()=>{throw Object.assign(new Error('datos internos'),{code:'ETIMEOUT'});}},dbConfig:{},verificarToken:(req,res,next)=>{req.usuario={id_usuario:13,tipo_personal:'Asilo'};next();}});
    const server=app.listen(0,'127.0.0.1');await once(server,'listening');
    try{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/reportes/R01?desde=2026-10-01&hasta=2026-10-09`);assert.equal(r.status,503);assert.match((await r.json()).message,/base de datos/);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('configuración conserva puerto predeterminado o admite puerto/instancia explícitos, sin credenciales en errores',()=>{
    const source=fs.readFileSync('backend/config/db.js','utf8');
    const cargar=env=>{const ctx={module:{exports:{}},process:{env},require:()=>({config(){}})};vm.runInNewContext(source,ctx);return ctx.module.exports;};
    assert.equal(cargar({DB_SERVER:'localhost'}).port,undefined);
    assert.equal(cargar({DB_PORT:'1444'}).port,1444);assert.equal(cargar({DB_INSTANCE:'SQLEXPRESS'}).options.instanceName,'SQLEXPRESS');
    assert.throws(()=>cargar({DB_PORT:'x'}),/puerto/);assert.throws(()=>cargar({DB_PORT:'1433',DB_INSTANCE:'otra'}),/no ambos/);
    const config=cargar({});assert.equal(config.connectionTimeout,15000);assert.equal(config.requestTimeout,15000);assert.equal(config.pool.max,10);
});
function navegador(fetchOriginal){
    const listeners={},timers=new Map();let siguiente=0;
    const elemento=()=>({dataset:{},textContent:'',classList:{add(){}},setAttribute(){},removeAttribute(){},appendChild(){},disabled:false});
    const document={readyState:'loading',body:elemento(),createElement:elemento,addEventListener:(e,f)=>listeners[e]=f};
    const context={document,window:{fetch:fetchOriginal},AbortController,WeakMap,Set,queueMicrotask,setTimeout(fn,ms){const id=++siguiente;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}};
    vm.runInNewContext(fs.readFileSync('frontend/compartido/cyberdeck.js','utf8'),context);
    return {context,listeners,timers,elemento};
}
test('peticiones: bloqueo del botón, doble envío rechazado y restauración finalmente',async()=>{
    let resolver,llamadas=0;const n=navegador(()=>{llamadas++;return new Promise(r=>resolver=r);}),b=n.elemento();
    n.listeners.click({target:{closest:()=>b}});
    const p=n.context.window.fetch('/api/pagos',{method:'POST',body:'mismo'});assert.equal(b.disabled,true);
    await assert.rejects(n.context.window.fetch('/api/pagos',{method:'POST',body:'mismo'}),/ya está en curso/);
    resolver(new Response('{"success":true}'));await p;assert.equal(b.disabled,false);assert.equal(llamadas,1);
});
test('peticiones: timeout no reintenta y distingue resultado de escritura desconocido',async()=>{
    let llamadas=0;const n=navegador((url,{signal})=>{llamadas++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort'))));});
    const p=n.context.window.fetch('/api/guardar',{method:'POST'});const rechazo=assert.rejects(p,/consulte el registro antes de reintentar/);
    [...n.timers.values()].find(t=>t.ms===90000).fn();await rechazo;assert.equal(llamadas,1);
});
test('todas las páginas incluyen componentes; fuentes usadas no contienen discrepancias de límites',()=>{
    const path=require('path'),walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
    for(const p of walk('frontend').filter(p=>p.endsWith('.html'))){const s=fs.readFileSync(p,'utf8');assert.equal(s.split('/css/cyberdeck.css').length,2,p);assert.equal(s.split('/compartido/cyberdeck.js').length,2,p);}
    const fontkit=require('fontkit');for(const name of ['IBMPlexSans-Regular.ttf','IBMPlexSans-SemiBold.ttf']){
        const f=fontkit.openSync('frontend/reportes/fuentes/'+name);
        for(let i=0;i<f.numGlyphs;i++){const g=f.getGlyph(i);if(!g.path.commands.length)continue;const a=g._getCBox(true),b=g.path.cbox;for(const k of ['minX','minY','maxX','maxY'])assert.ok(Math.abs(a[k]-b[k])<=1,`${name}: ${i} ${k}`);}
    }
    assert.doesNotMatch(fs.readFileSync('backend/reportes-exportar.js','utf8'),/Rajdhani-SemiBold/);
    assert.doesNotMatch(fs.readFileSync('frontend/reportes/reportes.css','utf8'),/Rajdhani-SemiBold/);
});
