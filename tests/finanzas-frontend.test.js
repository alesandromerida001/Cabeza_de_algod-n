const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function pagina(vista='mensualidades',respuesta){
    const html=fs.readFileSync(path.join(root,'frontend/finanzas/mensualidades.html'),'utf8');
    function element(tag='div') { return { tag,children:[],listeners:{},value:'',disabled:false,hidden:false,textContent:'',dataset:{},
        append(...e){e.forEach(x=>x.parentElement=this);this.children.push(...e);},replaceChildren(...e){this.children=e;},setAttribute(){},setCustomValidity(v){this.validationMessage=v;},
        addEventListener(t,f){(this.listeners[t]||=[]).push(f);},querySelectorAll(selector){return this.children.flatMap(c=>[...(selector.split(',').includes(c.tag)?[c]:[]),...c.querySelectorAll(selector)]);}
    };}
    const elementos=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element(m[1]==='formFinanzas'?'form':'div')]));
    elementos.formFinanzas.children.push(elementos.camposModal);
    const ctx=vm.createContext({ Formatos:require('../frontend/compartido/formatos'), Intl,Date,URLSearchParams,crypto,console,setTimeout,clearTimeout,
        window:{location:{search:''}},bootstrap:{Modal:class{show(){}hide(){}}},
        fetch:async()=>({ok:true,status:200,json:async()=>respuesta}),document:{querySelector:s=>elementos[s]||(elementos[s]=element()),body:{dataset:{vista}},createElement:element,getElementById(id){return elementos[id]||Object.values(elementos).flatMap(e=>e.querySelectorAll('input,select,textarea')).find(e=>e.id===id);}},
        FormData:class{constructor(form){this.entries=form.querySelectorAll('input,select,textarea').filter(e=>e.name&&!e.disabled).map(e=>[e.name,e.value]);} [Symbol.iterator](){return this.entries[Symbol.iterator]();}}
    });
    vm.runInContext(fs.readFileSync(path.join(root,'frontend/finanzas/finanzas.js'),'utf8'),ctx);
    return {ctx,elementos};
}
test('previsualizar y confirmar preserva campos deshabilitados y clave al reintentar',async()=>{
    const {ctx:c,elementos:e}=pagina();let previews=0,envios=[];
    c.abrirFormulario({titulo:'Pago',campos:[c.campo('monto','Monto','number')],base:{idResidente:1},
        preview:async b=>{previews++;assert.equal(b.monto,'50');return {huella:'abc'};},renderPreview(){},
        guardar:async b=>{envios.push({...b});if(envios.length===1)throw new Error('Conexión interrumpida');return {message:'Confirmado'};}});
    e.camposModal.querySelectorAll('input')[0].value='50';
    const submit=()=>e.formFinanzas.listeners.submit[0]({preventDefault(){}});
    await submit();assert.equal(previews,1);assert.equal(envios.length,0);assert.equal(e.camposModal.querySelectorAll('input')[0].disabled,true);
    await submit();assert.match(e.errorModal.textContent,/Conexión/);await submit();
    assert.equal(envios.length,2);assert.equal(envios[0].monto,'50');assert.equal(envios[1].huella,'abc');assert.equal(envios[0].claveOperacion,envios[1].claveOperacion);
});
test('doble clic no envía dos pagos y el modal conserva errores',async()=>{
    const {ctx:c,elementos:e}=pagina();let resolver,llamadas=0;
    c.abrirFormulario({titulo:'Gasto',campos:[],guardar:()=>{llamadas++;return new Promise(r=>resolver=r);}});
    const submit=()=>e.formFinanzas.listeners.submit[0]({preventDefault(){}});
    const pendiente=submit();await submit();assert.equal(llamadas,1);assert.equal(e.guardarModal.disabled,true);resolver({message:'Guardado'});await pendiente;assert.equal(e.guardarModal.disabled,false);
});

test('mes/año/aplicar e individual sin autorización antigua; buscador se oculta en lote',()=>{
    const {ctx:c,elementos:e}=pagina();c.abrirMensualidad();
    const inputs=e.camposModal.querySelectorAll('input,select,textarea');const get=id=>inputs.find(x=>x.id===id);
    assert.equal(get('fin_mes').children.length,12);assert.ok(get('fin_anio').children.length>10);
    assert.equal(get('fin_autorizarHistorico'),undefined);
    const buscar=get('buscarMensualidad'),aplicar=get('fin_aplicar');assert.equal(buscar.parentElement.hidden,true);
    aplicar.value='Un residente específico';aplicar.listeners.change[0]();assert.equal(buscar.parentElement.hidden,false);assert.equal(buscar.required,true);
    buscar.value='Algo';get('fin_idResidente').value='9';aplicar.value='Todos los residentes activos';aplicar.listeners.change[0]();assert.equal(get('fin_idResidente').value,'');assert.equal(buscar.required,false);
    assert.equal(e.acciones.children.some(b=>/históricas|anteriores|Conciliar/.test(b.textContent)),false);
});

test('mensualidades: no envía período futuro y libera botones tras validación',async()=>{
    const {ctx:c,elementos:e}=pagina();c.abrirMensualidad();
    const inputs=e.camposModal.querySelectorAll('input,select,textarea'),get=id=>inputs.find(x=>x.id===id);
    get('fin_anio').value=String(new Date().getUTCFullYear()+1);get('fin_mes').value='Enero';
    await e.formFinanzas.listeners.submit[0]({preventDefault(){}});
    assert.match(e.errorModal.textContent,/mes actual o uno anterior/);assert.equal(e.guardarModal.disabled,false);
});
test('Fundación muestra sus cobros e historial sin acciones administrativas',async()=>{
    const respuesta={success:true,puedePagar:false,obligaciones:[{id_visita:1,id_obligacion:1,nombres:'Persona',apellidos:'Ficticia',fecha_visita:'2026-01-01',monto:840,pagado:300,saldo:540,estado:'Parcial'}],pagos:[{id_pago_fundacion:1,id_obligacion:1,monto:300,fecha:'2026-01-02',metodo:'Efectivo'}]};
    const {ctx:c,elementos:e}=pagina('fundacion',respuesta);await c.fundacion();
    const textos=x=>[x.textContent,...x.children.flatMap(textos)].join(' ');
    assert.equal(e.h1.textContent,'Cobros pendientes del Asilo');assert.equal(e.navegacion.hidden,true);
    assert.match(textos(e.tarjetas),/Total que nos debe el Asilo/);assert.match(textos(e.tarjetas),/Q 540.00/);
    assert.match(textos(e.contenido),/Historial de pagos recibidos del Asilo/);
    assert.equal(e.contenido.querySelectorAll('button').some(x=>x.textContent==='Pagar'),false);
});
test('previsualización explica omisiones y existentes; solo ofrece confirmar con elegibles',async()=>{
    for(const elegibles of [0,1]){
        const respuesta={success:true,periodo:'2026-01',huella:'vista',resumen:{elegibles,existentes:1,omitidas:1},filas:elegibles?[{id_residente:1}]:[],residentes:[{nombres:'Ana',apellidos:'Prueba',periodo:'2026-01',monto:null,estado_elegibilidad:'Omitida',motivo:'Período anterior al ingreso (09/oct/2026).'},{nombres:'Luis',apellidos:'Prueba',periodo:'2026-01',monto:1000,estado_elegibilidad:'Existente',motivo:'La mensualidad ya existe.'}]};
        const {ctx:c,elementos:e}=pagina('mensualidades',respuesta);c.abrirMensualidad();
        await e.formFinanzas.listeners.submit[0]({preventDefault(){}});
        const textos=x=>[x.textContent,...x.children.flatMap(textos)].join(' ');
        assert.match(textos(e.previewModal),/Período anterior al ingreso/);assert.match(textos(e.previewModal),/ya existe/);assert.match(textos(e.previewModal),/enero 2026/);
        assert.equal(e.guardarModal.hidden,!elegibles);
        e.editarPreview.listeners.click[0]();assert.equal(e.guardarModal.hidden,false);
    }
});
test('pago familiar selecciona mensualidad pendiente y muestra saldos y confirmación',async()=>{
    const {ctx:c,elementos:e}=pagina();let body;
    c.fetch=async(url,op)=>{body=JSON.parse(op.body);return {ok:true,status:200,json:async()=>({success:true,huella:'pago',modalidad:'Mensualidad',residente:'Ana Prueba',responsable:'Familiar Prueba',importe:400,concepto:'Abono a mensualidad de octubre 2026',aplicaciones:[{id_cargo:1,concepto:'Mensualidad',periodo:'2026-10',monto:400,saldoAnterior:1000,saldoResultante:600,clasificacion:'Parcial'}]})};};
    c.abrirPagoFamiliar({residente:{id_residente:1},cargos:[{id_cargo:1,tipo:'Mensualidad',periodo:'2026-10',saldo:1000},{id_cargo:2,tipo:'Manual',saldo:500},{id_cargo:3,tipo:'Mensualidad',periodo:'2026-09',saldo:0}]});
    const get=id=>e.camposModal.querySelectorAll('input,select,textarea').find(x=>x.id===id),mod=get('fin_modalidad'),cargo=get('fin_idCargo');
    assert.equal(mod.value,'General');assert.equal(cargo.parentElement.hidden,true);assert.equal(cargo.children.length,2);
    mod.value='Mensualidad';mod.listeners.change[0]();assert.equal(cargo.required,true);assert.equal(cargo.parentElement.hidden,false);cargo.value='1';get('fin_monto').value='400';
    await e.formFinanzas.listeners.submit[0]({preventDefault(){}});
    assert.equal(body.modalidad,'Mensualidad');assert.equal(body.idCargo,'1');
    const textos=x=>[x.textContent,...x.children.flatMap(textos)].join(' '),texto=textos(e.previewModal);
    for(const t of ['ATENCIÓN // CONFIRMACIÓN REQUERIDA','Ana Prueba','Familiar Prueba','octubre 2026','Q 1,000.00','Q 600.00'])assert.ok(texto.includes(t));
    e.editarPreview.listeners.click[0]();mod.value='General';mod.listeners.change[0]();assert.equal(cargo.value,'');assert.equal(cargo.required,false);
});
test('error de pago usa mensaje magenta y conserva los datos introducidos',async()=>{
    const {ctx:c,elementos:e}=pagina();c.fetch=async()=>({ok:false,status:400,json:async()=>({message:'El importe supera el saldo de la mensualidad seleccionada.'})});
    c.abrirPagoFamiliar({residente:{id_residente:1},cargos:[]});
    const monto=e.camposModal.querySelectorAll('input').find(x=>x.id==='fin_monto');monto.value='900';
    await e.formFinanzas.listeners.submit[0]({preventDefault(){}});
    assert.match(e.errorModal.textContent,/ERROR \/\/ OPERACIÓN RECHAZADA/);assert.match(e.errorModal.className,/mensaje-error/);assert.equal(monto.value,'900');assert.equal(monto.disabled,false);
});
