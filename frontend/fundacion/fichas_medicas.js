// Fundación consulta un residente por vez. No se descargan fichas para buscar.
const buscador = document.getElementById('buscarResidente');
const resultadosBusqueda = document.getElementById('resultadosBusqueda');
const ayudaBusqueda = document.getElementById('ayudaBusqueda');
const fichaResidente = document.getElementById('fichaResidente');
const historialResidente = document.getElementById('historialResidente');
const mensajeFicha = document.getElementById('mensajeFicha');
const mensajeHistorial = document.getElementById('mensajeHistorial');
const tablaHistorial = document.getElementById('tablaHistorial');
let temporizador;
let versionBusqueda = 0;
let versionFicha = 0;
let busquedaActiva;

async function consultar(url, signal) {
    const respuesta = await fetch(url, { cache: 'no-store', signal });
    if (respuesta.status === 401) {
        window.location.href = '/';
        throw new Error('Su sesión expiró. Inicie sesión nuevamente.');
    }
    if (respuesta.status === 403) throw new Error('No tiene permisos para consultar esta información.');
    const datos = await respuesta.json();
    if (!respuesta.ok || !datos.success) throw new Error(datos.message || 'No se pudo consultar la información. Intente nuevamente.');
    return datos;
}

function limpiarSeleccion() {
    versionFicha++;
    fichaResidente.hidden = true;
    historialResidente.hidden = true;
    mensajeFicha.textContent = '';
    mensajeHistorial.textContent = '';
    tablaHistorial.replaceChildren();
    document.querySelectorAll('[id^="ficha_"]').forEach(e => { e.textContent = 'No registrado'; });
    document.querySelectorAll('#modalVisita dd').forEach(e => { e.textContent = 'No registrado'; });
    modalVisita.hide();
}

async function buscarResidentes(consulta, version) {
    busquedaActiva = new AbortController();
    try {
        const datos = await consultar(`/api/huespedes/buscar?q=${encodeURIComponent(consulta)}`, busquedaActiva.signal);
        if (version !== versionBusqueda) return;
        resultadosBusqueda.replaceChildren();
        const residentes = datos.residentes;
        ayudaBusqueda.textContent = residentes.length
            ? `${residentes.length} coincidencias. Seleccione un residente.${residentes.length === 20 ? ' Refine la búsqueda si no aparece.' : ''}`
            : 'No se encontraron residentes con esa búsqueda.';
        for (const r of residentes) {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'list-group-item list-group-item-action';
            boton.textContent = `${residente(r)} · DPI: ${texto(r.dpi)}`;
            boton.addEventListener('click', () => seleccionarResidente(r));
            resultadosBusqueda.appendChild(boton);
        }
    } catch (error) {
        if (version === versionBusqueda && error.name !== 'AbortError') ayudaBusqueda.textContent = error.message || 'No se pudo buscar residentes.';
    }
}

buscador.addEventListener('input', () => {
    clearTimeout(temporizador);
    busquedaActiva?.abort();
    versionBusqueda++;
    limpiarSeleccion();
    resultadosBusqueda.replaceChildren();
    const consulta = buscador.value.trim();
    if (consulta.length < 2) { ayudaBusqueda.textContent = 'Escriba al menos 2 caracteres.'; return; }
    ayudaBusqueda.textContent = 'Buscando residentes…';
    const version = versionBusqueda;
    temporizador = setTimeout(() => buscarResidentes(consulta, version), 300);
});

function edadResidente(fecha, ahora = new Date()) {
    const nacimiento = diaVisita(fecha);
    if (!nacimiento) return 'No registrado';
    const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora);
    const hoy = ['year', 'month', 'day'].map(tipo => partes.find(p => p.type === tipo).value).join('-');
    if (nacimiento > hoy) return 'No registrado';
    const edad = Number(hoy.slice(0, 4)) - Number(nacimiento.slice(0, 4)) - (hoy.slice(5) < nacimiento.slice(5) ? 1 : 0);
    return `${edad} años`;
}

function mostrarFicha(ficha) {
    const valores = { nombre: residente(ficha), dpi: texto(ficha.dpi), fecha_nacimiento: fechaVisible(ficha.fecha_nacimiento), edad: edadResidente(ficha.fecha_nacimiento) };
    for (const campo of ['genero', 'tipo_sangre', 'alergias', 'padecimientos', 'psicopatologias', 'medicamentos_habituales', 'antecedentes', 'descripcion_asistencia', 'observaciones']) valores[campo] = texto(ficha[campo]);
    const asistencia = ficha.requiere_asistencia_especial;
    const requiere = asistencia === true || asistencia === 1 || asistencia === '1';
    valores.requiere_asistencia_especial = asistencia == null ? 'No registrado' : requiere ? 'Sí' : 'No';
    for (const [campo, valor] of Object.entries(valores)) document.getElementById(`ficha_${campo}`).textContent = valor;
    const alergias = texto(ficha.alergias).trim();
    document.getElementById('grupo_alergias').classList.toggle('dato-importante', !/^(no registrado|no|ningun[ao]s?|sin alergias)$/i.test(alergias));
    document.getElementById('grupo_requiere_asistencia_especial').classList.toggle('dato-importante', requiere);
    document.getElementById('grupo_descripcion_asistencia').classList.toggle('dato-importante', requiere);
    const aviso = document.getElementById('avisoSinFicha');
    aviso.hidden = Boolean(ficha.ficha_existe);
    aviso.textContent = ficha.ficha_existe ? '' : 'Este residente no tiene una ficha médica asociada. Se muestran únicamente los datos disponibles del residente; no se ha creado ninguna ficha.';
    fichaResidente.hidden = false;
}

function mostrarHistorial(visitas) {
    tablaHistorial.replaceChildren();
    mensajeHistorial.textContent = visitas.length ? `${visitas.length} visitas registradas` : 'Este residente no tiene visitas médicas registradas.';
    const ordenadas = visitas.slice().sort((a, b) => String(b.fecha_visita || '').localeCompare(String(a.fecha_visita || '')) || Number(b.id_visita) - Number(a.id_visita));
    for (const visita of ordenadas) {
        const fila = document.createElement('tr');
        const diagnostico = texto(visita.diagnostico);
        for (const valor of [fechaVisible(visita.fecha_visita), texto(visita.especialidad), texto(visita.medico), diagnostico.length > 140 ? diagnostico.slice(0, 140) + '…' : diagnostico]) {
            const celda = document.createElement('td');
            celda.textContent = valor;
            fila.appendChild(celda);
        }
        const acciones = document.createElement('td');
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn btn-primary btn-sm';
        boton.textContent = 'Ver detalle';
        boton.addEventListener('click', () => verVisita(visita));
        acciones.appendChild(boton);
        fila.appendChild(acciones);
        tablaHistorial.appendChild(fila);
    }
}

async function seleccionarResidente(residenteElegido) {
    clearTimeout(temporizador);
    busquedaActiva?.abort();
    versionBusqueda++;
    limpiarSeleccion();
    const version = versionFicha;
    const id = residenteElegido.id_residente;
    buscador.value = residente(residenteElegido);
    resultadosBusqueda.replaceChildren();
    ayudaBusqueda.textContent = `Seleccionado: ${residente(residenteElegido)} · DPI: ${texto(residenteElegido.dpi)}. Escriba para cambiar de residente.`;
    mensajeFicha.textContent = 'Cargando ficha…';
    historialResidente.hidden = false;
    mensajeHistorial.textContent = 'Cargando historial…';
    await Promise.all([
        (async () => {
            try {
                const datos = await consultar(`/api/huespedes/${encodeURIComponent(id)}/ficha-medica`);
                if (version !== versionFicha) return;
                mostrarFicha(datos.ficha);
                mensajeFicha.textContent = '';
            } catch (error) { if (version === versionFicha) mensajeFicha.textContent = error.message || 'No se pudo consultar la ficha.'; }
        })(),
        (async () => {
            try {
                const datos = await consultar(`/api/visitas?id_residente=${encodeURIComponent(id)}`);
                if (version !== versionFicha) return;
                mostrarHistorial(datos.visitas);
            } catch (error) { if (version === versionFicha) mensajeHistorial.textContent = error.message || 'No se pudo consultar el historial.'; }
        })()
    ]);
}

document.getElementById('cambiarResidente').addEventListener('click', () => {
    buscador.value = '';
    buscador.dispatchEvent(new Event('input'));
    buscador.focus();
});
document.getElementById('btnCerrarSesion').addEventListener('click', async () => {
    try {
        const respuesta = await fetch('/api/logout', { method: 'POST' });
        if (!respuesta.ok) throw new Error();
        versionBusqueda++;
        busquedaActiva?.abort();
        clearTimeout(temporizador);
        resultadosBusqueda.replaceChildren();
        limpiarSeleccion();
        window.location.href = '/';
    } catch (error) { mensajeFicha.textContent = 'No se pudo cerrar la sesión. Intente nuevamente.'; }
});
