// Comportamiento transversal de interfaz; no cambia payloads, permisos ni reintenta escrituras.
(function () {
    'use strict';
    const titulos={error:'ERROR // OPERACIÓN RECHAZADA',aviso:'ATENCIÓN // CONFIRMACIÓN REQUERIDA',exito:'OPERACIÓN COMPLETADA',info:'SISTEMA // INFORMACIÓN'};
    const iconos={error:'✕',aviso:'⚠',exito:'✓',info:'ⓘ'};
    let activo=null, pendientes=0, mensajeGlobal, estadoCarga;
    function decorar(el,tipo) {
        if(!el || !el.textContent.trim())return;
        el.classList.add('cyber-mensaje');el.dataset.cyberTipo=tipo;
        const explicito=Object.values(titulos).some(t=>el.textContent.includes(t));
        el.dataset.cyberTitulo=explicito?iconos[tipo]:iconos[tipo]+' '+titulos[tipo];
        el.setAttribute('role',tipo==='error'?'alert':'status');
    }
    function mensaje(el,texto,tipo='info') {
        el.textContent=texto;el.hidden=!texto;if(texto)decorar(el,tipo);
    }
    function avisar(texto,tipo='error') {
        if(!mensajeGlobal){mensajeGlobal=document.createElement('div');mensajeGlobal.id='cyberAviso';mensajeGlobal.tabIndex=0;document.body.appendChild(mensajeGlobal);}
        mensaje(mensajeGlobal,texto,tipo);clearTimeout(avisar.timer);avisar.timer=setTimeout(()=>{mensajeGlobal.hidden=true;},12000);
    }
    function carga() {
        if(!estadoCarga){estadoCarga=document.createElement('div');estadoCarga.id='cyberCarga';document.body.appendChild(estadoCarga);}
        mensaje(estadoCarga,pendientes?'Procesando solicitud…':'','info');
    }
    function confirmar(texto) {
        if(document.getElementById('cyberConfirmacion'))return Promise.resolve(false);
        return new Promise(resolve=>{
            const anterior=document.activeElement,dlg=document.createElement('dialog');dlg.id='cyberConfirmacion';dlg.className='cyber-dialogo';
            const aviso=document.createElement('div');mensaje(aviso,texto,'aviso');
            const acciones=document.createElement('div');acciones.className='cyber-acciones';
            const cancelar=document.createElement('button'),aceptar=document.createElement('button');cancelar.textContent='Cancelar';aceptar.textContent='Confirmar';aceptar.className='btn-primary';
            acciones.append(cancelar,aceptar);dlg.append(aviso,acciones);document.body.appendChild(dlg);
            const cerrar=valor=>{dlg.close();dlg.remove();anterior?.focus();resolve(valor);};
            cancelar.addEventListener('click',()=>cerrar(false));aceptar.addEventListener('click',()=>cerrar(true));
            dlg.addEventListener('cancel',e=>{e.preventDefault();cerrar(false);});dlg.showModal();cancelar.focus();
        });
    }
    window.Cyberdeck={mensaje,avisar,confirmar};
    // Captura el botón de la acción sin deshabilitar campos antes de construir FormData.
    for(const evento of ['click','submit'])document.addEventListener(evento,e=>{
        const boton=evento==='submit'?(e.submitter||e.target.querySelector('button[type="submit"]')):e.target.closest('button');
        if(!boton)return;activo=boton;queueMicrotask(()=>{if(activo===boton)activo=null;});
    },true);
    const fetchOriginal=window.fetch.bind(window),enCurso=new Set(), ocupados=new WeakMap();
    window.fetch=async function(url,opciones={}) {
        const metodo=(opciones.method||'GET').toUpperCase(),escritura=!['GET','HEAD'].includes(metodo);
        const clave=escritura?metodo+' '+String(url)+' '+String(opciones.body||''):null;
        if(clave&&enCurso.has(clave))throw new Error('Esta operación ya está en curso. Espere su resultado.');
        const boton=activo;if(boton){ocupados.set(boton,(ocupados.get(boton)||0)+1);boton.disabled=true;boton.setAttribute('aria-busy','true');}
        const control=new AbortController(),abortar=()=>control.abort();
        if(opciones.signal?.aborted)control.abort();else opciones.signal?.addEventListener('abort',abortar,{once:true});
        let vencido=false;const timer=setTimeout(()=>{vencido=true;control.abort();},escritura||String(url).includes('/exportar/')?90000:45000);
        if(clave)enCurso.add(clave);pendientes++;carga();
        try {
            const r=await fetchOriginal(url,{...opciones,signal:control.signal});
            // Mantener el plazo y bloqueo hasta recibir el cuerpo, no solo las cabeceras.
            await r.clone().arrayBuffer();
            if(r.status===503)avisar('La base de datos no está disponible o no respondió. Si estaba guardando, consulte el registro antes de reintentar.');
            return r;
        } catch(e) {
            if(opciones.signal?.aborted&&!vencido)throw e;
            const texto=vencido?'La solicitud superó el tiempo de espera.': 'No se pudo conectar con el servidor.';
            const error=new Error(texto+(escritura?' No se pudo confirmar el resultado; consulte el registro antes de reintentar.':' Intente consultar nuevamente.'));
            avisar(error.message);throw error;
        } finally {
            clearTimeout(timer);opciones.signal?.removeEventListener('abort',abortar);if(clave)enCurso.delete(clave);pendientes--;carga();
            if(boton){const n=ocupados.get(boton)-1;ocupados.set(boton,n);if(!n){boton.disabled=false;boton.removeAttribute('aria-busy');}}
        }
    };
    function observarMensajes() {
        const modulo=window.location.pathname.split('/').filter(Boolean)[0]||'login';
        document.body.dataset.cyberSeccion=modulo==='index.html'?'LOGIN':modulo.toUpperCase();
        const main=document.querySelector('main');if(main)main.dataset.cyberSeccion='CCA // '+document.body.dataset.cyberSeccion;
        const selector='.alert,.avisos,.aviso-regla,.dato-importante,[role="alert"],[role="status"],#toast,#mensaje,#mensajeUsuario,#errorModal,.toast-sistema,.mensaje-operacion';
        function revisar(){document.querySelectorAll(selector).forEach(el=>{
            if(el.id==='cyberCarga'||el.id==='cyberAviso'||el.closest('#cyberConfirmacion')||el.querySelector(selector))return;
            const texto=el.textContent.trim();if(!texto)return;
            const clases=String(el.className);
            const tipo=/error|danger/.test(clases)||/error|no se pudo|no se pueden|no puede|no fue posible|fall[oó]|rechazada|inválid/i.test(texto)?'error':/warning|atencion|aviso/.test(clases)||/confirma|advertencia|seleccione|revise|futura/i.test(texto)?'aviso':/exito|success/.test(clases)||/completada|registrad[oa] correctamente|guardad[oa]|operación registrada/i.test(texto)?'exito':'info';
            decorar(el,tipo);
        });}
        new MutationObserver(revisar).observe(document.body,{childList:true,subtree:true,characterData:true});revisar();
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observarMensajes);else observarMensajes();
})();
