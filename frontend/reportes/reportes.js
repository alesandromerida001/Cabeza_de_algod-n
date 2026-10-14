'use strict';
const $ = id => document.getElementById(id);
let idPaciente=null, token=null, version=0, buscando=0, temporizador, ocupado=false, tipoPersonal=null;
function mensaje(texto,tipo='exito') { $('mensaje').hidden=!texto;$('mensaje').className=tipo;$('mensaje').textContent=texto?(tipo==='error'?'ERROR // OPERACIÓN RECHAZADA':tipo==='aviso'?'ATENCIÓN // CONFIRMACIÓN REQUERIDA':'OPERACIÓN COMPLETADA')+'\n'+texto:''; }
function invalidar() {version++;token=null;$('pdf').disabled=true;$('resultado').replaceChildren();}
function adaptarFiltros(){
    const codigo=$('reporte').value, obligatorio=['R02','R03'].includes(codigo), sinPaciente=codigo==='R05';
    $('filtroPaciente').hidden=sinPaciente;$('paciente').disabled=sinPaciente;$('paciente').required=obligatorio;
    $('etiquetaPaciente').textContent='Residente'+(obligatorio?' *':' (opcional)')+' · nombre, apellido o DPI';
    $('paciente').placeholder=obligatorio?'Busque y seleccione un residente':'Todos los residentes';
    $('desde').required=$('hasta').required=codigo!=='R02';
    $('etiquetaDesde').textContent=codigo==='R02'?'Historial desde (opcional)':'Desde *';
    $('etiquetaHasta').textContent=codigo==='R02'?'Historial hasta (opcional)':'Hasta *';
    if(codigo==='R02'){$('desde').value='';$('hasta').value='';}
    else {const hoy=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guatemala'}).format(new Date());if(!$('desde').value)$('desde').value=hoy.slice(0,7)+'-01';if(!$('hasta').value)$('hasta').value=hoy;}
    clearTimeout(temporizador);buscando++;$('sugerencias').hidden=true;
    if(sinPaciente){idPaciente=null;$('paciente').value='';$('seleccion').textContent='Todos los residentes';}
}
async function api(url,opciones) {const r=await fetch(url,opciones);if(r.status===401){window.location.href='/';throw new Error('La sesión expiró.');}if(!r.ok){let datos;try{datos=await r.json();}catch{}throw new Error(datos?.message||'No se pudo completar la consulta.');}return r;}
function textoNodo(tag,texto){const el=document.createElement(tag);el.textContent=texto;return el;}
function visible(v,t){if(v==null||v==='')return 'No registrado';if(t==='fecha')return Formatos.fecha(v);if(t==='moneda')return Formatos.dinero(v);if(t==='porcentaje')return Number.isFinite(Number(v))?Number(v).toFixed(2)+' %':'No registrado';return String(v);}
function mostrar(r){
    const cont=$('resultado');cont.replaceChildren(textoNodo('h2',r.codigo+' · '+r.titulo));
    const meta=textoNodo('p',[r.codigo==='R05'?null:`Residente: ${r.filtros.paciente}`,r.filtros.desde?`Desde: ${Formatos.fecha(r.filtros.desde)}`:null,r.filtros.hasta?`Hasta: ${Formatos.fecha(r.filtros.hasta)}`:null,!r.filtros.desde&&!r.filtros.hasta?'Historial completo':null,`Generado: ${Formatos.fecha(r.generado,true)}`].filter(Boolean).join(' · '));meta.className='metadatos';cont.appendChild(meta);
    if(r.avisos.length){const notas=document.createElement('div');notas.className='avisos';for(const a of r.avisos)notas.appendChild(textoNodo('p',a));cont.appendChild(notas);}
    const resumen=document.createElement('div');resumen.className='totales';
    for(const t of r.totales){const tarjeta=document.createElement('div');tarjeta.className='total';tarjeta.appendChild(textoNodo('span',t.label));tarjeta.appendChild(textoNodo('strong',visible(t.value,t.type)));resumen.appendChild(tarjeta);}cont.appendChild(resumen);
    for(const s of r.secciones){
        cont.appendChild(textoNodo('h3',s.titulo));
        if(!s.filas.length){const vacio=textoNodo('p','Sin registros para los filtros seleccionados.');vacio.className='vacio';cont.appendChild(vacio);continue;}
        const caja=document.createElement('div');caja.className='tabla-contenedor';caja.tabIndex=0;caja.setAttribute('aria-label',s.titulo);
        const tabla=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');
        for(const c of s.columnas){const th=textoNodo('th',c.label);th.scope='col';tr.appendChild(th);}head.appendChild(tr);tabla.appendChild(head);
        const body=document.createElement('tbody');for(const fila of s.filas){const row=document.createElement('tr');for(const c of s.columnas){const td=textoNodo('td',visible(fila[c.key],c.type));if(/diagnostico|examenes|medicamentos|indicaciones|observaciones|antecedentes|concepto/.test(c.key)&&c.type==='texto')td.className='texto-largo';row.appendChild(td);}body.appendChild(row);}tabla.appendChild(body);caja.appendChild(tabla);cont.appendChild(caja);
    }
}
$('formReporte').addEventListener('submit',async e=>{
    e.preventDefault();if(ocupado)return;
    if(!$('filtroPaciente').hidden && $('paciente').value.trim()&&!idPaciente)return mensaje('Seleccione un paciente de las sugerencias o quite el texto para consultar todos.','aviso');
    if(['R02','R03'].includes($('reporte').value)&&!idPaciente)return mensaje('Seleccione un residente para este reporte.','aviso');
    if(($('reporte').value!=='R02'&&(!$('desde').value||!$('hasta').value))||($('desde').value&&$('hasta').value&&$('desde').value>$('hasta').value))return mensaje('Revise el rango de fechas.','error');
    invalidar();const actual=version;ocupado=true;$('consultar').disabled=true;mensaje('Consultando registros…','aviso');
    try{const q=new URLSearchParams();if($('desde').value)q.set('desde',$('desde').value);if($('hasta').value)q.set('hasta',$('hasta').value);if(!$('filtroPaciente').hidden&&idPaciente)q.set('id_residente',idPaciente);
        const data=await(await api('/api/reportes/'+$('reporte').value+'?'+q)).json();if(actual!==version)return;
        mostrar(data.informe);token=data.token;$('pdf').disabled=false;mensaje('Reporte disponible. Las exportaciones conservan este resultado durante diez minutos.');
    }catch(e){if(actual===version)mensaje(e.message,'error');}finally{ocupado=false;$('consultar').disabled=false;}
});
$('reporte').addEventListener('change',()=>{adaptarFiltros();invalidar();mensaje('Filtros modificados. Pulse Consultar.','aviso');});
for(const id of ['desde','hasta'])$(id).addEventListener('change',()=>{invalidar();mensaje('Filtros modificados. Pulse Consultar.','aviso');});
$('paciente').addEventListener('input',()=>{
    clearTimeout(temporizador);idPaciente=null;invalidar();$('seleccion').textContent='Todos los pacientes';$('sugerencias').hidden=true;
    const q=$('paciente').value.trim(),actual=++buscando;if(q.length<2)return;
    temporizador=setTimeout(async()=>{try{
        const ruta=tipoPersonal==='Fundacion'?'/api/huespedes/buscar':'/api/finanzas/residentes';
        const data=await(await api(ruta+'?q='+encodeURIComponent(q))).json();if(actual!==buscando)return;
        const lista=$('sugerencias');lista.replaceChildren();
        for(const r of data.residentes||[]){const b=textoNodo('button',`${r.nombres} ${r.apellidos} · ${r.dpi}`);b.type='button';b.addEventListener('click',()=>{invalidar();idPaciente=r.id_residente;$('paciente').value=r.nombres+' '+r.apellidos;$('seleccion').textContent='Paciente seleccionado · ID '+r.id_residente;lista.hidden=true;buscando++;});lista.appendChild(b);}
        if(!lista.children.length)lista.appendChild(textoNodo('p','No se encontraron pacientes.'));lista.hidden=false;
    }catch(e){if(actual===buscando)mensaje(e.message,'error');}},250);
});
$('limpiarPaciente').addEventListener('click',()=>{clearTimeout(temporizador);buscando++;idPaciente=null;$('paciente').value='';$('seleccion').textContent='Todos los pacientes';$('sugerencias').hidden=true;invalidar();});
$('paciente').addEventListener('keydown',e=>{if(e.key==='Escape')$('sugerencias').hidden=true;});
async function exportar(){
    if(!token)return;const copia=token;$('pdf').disabled=true;
    try{const r=await api(`/api/reportes/exportar/${copia}/pdf`),blob=await r.blob(),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Reporte.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);mensaje('Archivo descargado con los datos de la consulta.');}
    catch(e){mensaje(e.message,'error');}finally{if(token===copia)$('pdf').disabled=false;}
}
$('pdf').addEventListener('click',()=>exportar());
$('salir').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});window.location.href='/';}catch(e){mensaje(e.message,'error');}});
async function iniciar(){
    const hoy=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guatemala'}).format(new Date());$('hasta').value=hoy;$('desde').value=hoy.slice(0,7)+'-01';
    try{const data=await(await api('/api/reportes')).json();$('reporte').replaceChildren();for(const r of data.reportes){const o=textoNodo('option',r.id+' · '+r.nombre);o.value=r.id;$('reporte').appendChild(o);}
        tipoPersonal=data.tipo_personal;adaptarFiltros();$('reporte').disabled=$('consultar').disabled=false;$('volver').href=tipoPersonal==='Fundacion'?'/fundacion/fundacion_dashboard.html':'/principal/admin_dashboard.html';
    }catch(e){mensaje(e.message,'error');}
}
iniciar();
