// Consulta exclusivamente de lectura. Los importes son los guardados por el backend.
let visitas = [];
let cargaCompleta = false;
const tablaVisitas = document.getElementById('tablaVisitas');
const mensajeVisitas = document.getElementById('mensajeVisitas');
const buscarVisita = document.getElementById('buscarVisita');
const fechaDesde = document.getElementById('fechaDesde');
const fechaHasta = document.getElementById('fechaHasta');

// Este parámetro solo decide el enlace de regreso; el servidor autoriza la consulta.
if (new URLSearchParams(window.location.search).get('origen') === 'asilo') {
    document.getElementById('volverMenu').href = '/principal/admin_dashboard.html';
}

function normalizar(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function actualizarResumen(ahora = new Date()) {
    const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit' }).formatToParts(ahora);
    const mes = `${partes.find(p => p.type === 'year').value}-${partes.find(p => p.type === 'month').value}`;
    document.getElementById('statVisitas').textContent = visitas.length;
    document.getElementById('statResidentes').textContent = new Set(visitas
        .filter(v => v.id_residente != null && String(v.id_residente).trim() !== '')
        .map(v => String(v.id_residente))).size;
    document.getElementById('statMes').textContent = visitas.filter(v => diaVisita(v.fecha_visita).startsWith(mes)).length;
}

function filaVacia(mensaje) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 6;
    celda.textContent = mensaje;
    fila.appendChild(celda);
    tablaVisitas.appendChild(fila);
}

function mostrarVisitas() {
    if (!cargaCompleta) return;
    tablaVisitas.replaceChildren();
    if (fechaDesde.value && fechaHasta.value && fechaDesde.value > fechaHasta.value) {
        mensajeVisitas.textContent = 'La fecha Desde no puede ser posterior a Hasta.';
        filaVacia('Corrija el rango de fechas para consultar las visitas.');
        return;
    }
    const busqueda = normalizar(buscarVisita.value.trim());
    const filtradas = visitas.filter(v => {
        const dia = diaVisita(v.fecha_visita);
        return normalizar([v.nombres, v.apellidos, v.medico, v.especialidad].join(' ')).includes(busqueda)
            && (!fechaDesde.value || (dia && dia >= fechaDesde.value))
            && (!fechaHasta.value || (dia && dia <= fechaHasta.value));
    });
    mensajeVisitas.textContent = `${filtradas.length} de ${visitas.length} visitas`;
    if (!filtradas.length) {
        filaVacia(visitas.length ? 'No hay visitas que coincidan con la búsqueda y las fechas.' : 'Todavía no hay visitas médicas registradas.');
        return;
    }
    for (const visita of filtradas) {
        const fila = document.createElement('tr');
        for (const valor of [residente(visita), texto(visita.especialidad), texto(visita.medico), fechaVisible(visita.fecha_visita), moneda(visita.total)]) {
            const celda = document.createElement('td');
            celda.textContent = valor;
            fila.appendChild(celda);
        }
        const acciones = document.createElement('td');
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn btn-primary btn-sm';
        boton.textContent = 'Ver';
        boton.setAttribute('aria-label', `Ver visita de ${residente(visita)}`);
        boton.addEventListener('click', () => verVisita(visita));
        acciones.appendChild(boton);
        fila.appendChild(acciones);
        tablaVisitas.appendChild(fila);
    }
}

async function cargarVisitas() {
    try {
        const respuesta = await fetch('/api/visitas', { cache: 'no-store' });
        if (respuesta.status === 401) { window.location.href = '/'; return; }
        if (respuesta.status === 403) throw new Error('No tiene permisos para consultar visitas médicas.');
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.success || !Array.isArray(datos.visitas)) throw new Error('No se pudieron cargar las visitas. Recargue la página para intentar nuevamente.');
        visitas = datos.visitas.slice().sort((a, b) => {
            const fechaA = diaVisita(a.fecha_visita) ? String(a.fecha_visita) : '';
            const fechaB = diaVisita(b.fecha_visita) ? String(b.fecha_visita) : '';
            return fechaB.localeCompare(fechaA) || Number(b.id_visita) - Number(a.id_visita);
        });
        cargaCompleta = true;
        actualizarResumen();
        mostrarVisitas();
    } catch (error) {
        mensajeVisitas.textContent = error.message || 'Error de conexión. Recargue la página para intentar nuevamente.';
    }
}

buscarVisita.addEventListener('input', mostrarVisitas);
fechaDesde.addEventListener('change', mostrarVisitas);
fechaHasta.addEventListener('change', mostrarVisitas);
document.getElementById('limpiarFiltros').addEventListener('click', () => {
    buscarVisita.value = fechaDesde.value = fechaHasta.value = '';
    mostrarVisitas();
});
document.getElementById('btnCerrarSesion').addEventListener('click', async () => {
    try {
        const respuesta = await fetch('/api/logout', { method: 'POST' });
        if (!respuesta.ok) throw new Error('No se pudo cerrar la sesión. Intente nuevamente.');
        window.location.href = '/';
    } catch (error) {
        mensajeVisitas.textContent = 'No se pudo cerrar la sesión. Intente nuevamente.';
    }
});
cargarVisitas();
