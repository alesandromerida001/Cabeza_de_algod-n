// Guardamos la última lista cargada, para no volver a pedirla al
// servidor cada vez que abrimos "Modificar" (rellenamos el formulario
// con estos datos que ya tenemos en el navegador).
let listaResidentes = [];

let estadoFiltrado = '';
document.getElementById('filtrosEstado').addEventListener('click', evento => {
    const boton = evento.target.closest('button[data-estado]');
    if (!boton) return;
    estadoFiltrado = boton.dataset.estado;
    document.querySelectorAll('#filtrosEstado button').forEach(b => b.setAttribute('aria-pressed', String(b === boton)));
    aplicarFiltrosResidentes();
});


const modalResidente = document.getElementById('modalResidente');
const formResidente = document.getElementById('formResidente');
const tituloModalResidente = document.getElementById('tituloModalResidente');
const idResidenteInput = document.getElementById('idResidente');
const cuerpoTabla = document.getElementById('cuerpoTablaResidentes');
const buscarInput = document.getElementById('buscarResidente');
const btnGuardarResidente = document.getElementById('btnGuardarResidente');

const fichaElemento = document.getElementById('modalFichaMedica');
const modalFicha = new bootstrap.Modal(fichaElemento);
const historialMedico = document.getElementById('historialMedico');
const mensajeHistorial = document.getElementById('mensajeHistorialMedico');
let versionHistorial = 0, peticionHistorial, detalleAbierto = false;
fichaElemento.addEventListener('hide.bs.modal', () => {
    versionHistorial++;
    peticionHistorial?.abort();
});
document.getElementById('modalVisita').addEventListener('hidden.bs.modal', () => {
    if (detalleAbierto) { detalleAbierto = false; modalFicha.show(); }
});

function abrirDetalleHistorial(visita) {
    if (detalleAbierto) return;
    detalleAbierto = true;
    // Bootstrap admite un modal a la vez: esperar a retirar el backdrop padre.
    fichaElemento.addEventListener('hidden.bs.modal', () => verVisita(visita), { once: true });
    modalFicha.hide();
}

async function cargarHistorialMedico(id) {
    peticionHistorial?.abort();
    const actual = ++versionHistorial;
    peticionHistorial = new AbortController();
    historialMedico.replaceChildren();
    Cyberdeck.mensaje(mensajeHistorial, 'Cargando historial médico…', 'info');
    try {
        const respuesta = await fetch('/api/visitas?id_residente=' + encodeURIComponent(id), { cache: 'no-store', signal: peticionHistorial.signal });
        if (actual !== versionHistorial) return;
        if (respuesta.status === 401) { window.location.href = '/'; return; }
        if (respuesta.status === 403) throw new Error('No tiene permisos para consultar el historial médico.');
        const datos = await respuesta.json();
        if (actual !== versionHistorial) return;
        if (!respuesta.ok || !datos.success || !Array.isArray(datos.visitas)) throw new Error('No se pudo cargar el historial médico. Cierre y vuelva a abrir la ficha para reintentar.');
        if (!datos.visitas.length) {
            Cyberdeck.mensaje(mensajeHistorial, 'No existen visitas médicas registradas para este residente.', 'info');
            return;
        }
        const tabla = document.createElement('table'); tabla.className = 'table align-middle';
        const cabecera = document.createElement('thead'), titulos = document.createElement('tr');
        for (const titulo of ['Fecha', 'Especialidad', 'Médico', 'Diagnóstico', 'Resumen clínico', 'Acciones']) {
            const th = document.createElement('th'); th.scope = 'col'; th.textContent = titulo; titulos.appendChild(th);
        }
        cabecera.appendChild(titulos); tabla.appendChild(cabecera);
        const cuerpo = document.createElement('tbody');
        for (const visita of datos.visitas) {
            const fila = document.createElement('tr');
            for (const dato of [Formatos.fecha(visita.fecha_visita), mostrarDato(visita.especialidad), mostrarDato(visita.medico), mostrarDato(visita.diagnostico)]) {
                const td = document.createElement('td'); td.textContent = dato; fila.appendChild(td);
            }
            const resumen = document.createElement('td');
            for (const [etiqueta, campo] of [['Exámenes', 'examenes'], ['Resultados', 'resultados_examenes'], ['Medicamentos', 'medicamentos'], ['Cantidad', 'cantidad_medicamentos'], ['Indicaciones', 'indicaciones'], ['Observaciones', 'observaciones']]) {
                if (visita[campo] == null || !String(visita[campo]).trim()) continue;
                const linea = document.createElement('p'); linea.textContent = etiqueta + ': ' + visita[campo]; resumen.appendChild(linea);
            }
            if (!resumen.children.length) resumen.textContent = 'Sin información clínica adicional registrada.';
            fila.appendChild(resumen);
            const acciones = document.createElement('td'), ver = document.createElement('button');
            ver.type = 'button'; ver.className = 'btn btn-primary btn-sm'; ver.textContent = 'Ver detalle';
            ver.addEventListener('click', () => abrirDetalleHistorial(visita)); acciones.appendChild(ver); fila.appendChild(acciones); cuerpo.appendChild(fila);
        }
        tabla.appendChild(cuerpo); historialMedico.appendChild(tabla);
        Cyberdeck.mensaje(mensajeHistorial, datos.visitas.length + ' visitas registradas.', 'info');
    } catch (error) {
        if (actual !== versionHistorial || error.name === 'AbortError') return;
        Cyberdeck.mensaje(mensajeHistorial, error.message || 'No se pudo cargar el historial médico. Vuelva a abrir la ficha para reintentar.', 'error');
    }
}

let focoAnteriorResidente;
new MutationObserver(() => {
    if (!modalResidente.classList.contains('oculto')) {
        focoAnteriorResidente = document.activeElement;
        modalResidente.querySelector('input:not([type="hidden"]):not([disabled])')?.focus();
    } else focoAnteriorResidente?.focus();
}).observe(modalResidente, { attributes: true, attributeFilter: ['class'] });
modalResidente.addEventListener('keydown', e => {
    if (e.key === 'Escape') { modalResidente.classList.add('oculto'); return; }
    if (e.key !== 'Tab') return;
    const controles = [...modalResidente.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(el => el.offsetParent !== null);
    const primero=controles[0],ultimo=controles.at(-1);
    if(e.shiftKey&&document.activeElement===primero){e.preventDefault();ultimo?.focus();}
    if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primero?.focus();}
});


// ==========================================
// ABRIR / CERRAR MODAL
// ==========================================
document.getElementById('btnRegistrar').addEventListener('click', () => {
    formResidente.reset();
    idResidenteInput.value = '';
    establecerModoSoloLectura(false);
    tituloModalResidente.textContent = 'Registrar Residente';
    document.getElementById('cajaAsistencia').classList.add('oculto');
    modalResidente.classList.remove('oculto');
});

document.getElementById('btnCerrarModalResidente').addEventListener('click', () => {
    modalResidente.classList.add('oculto');
});

window.addEventListener('click', (evento) => {
    if (evento.target === modalResidente) modalResidente.classList.add('oculto');
});

// ==========================================
// CARGAR LISTA DESDE EL BACKEND
// ==========================================
async function cargarResidentes() {

    try {

        const respuesta = await fetch('/api/huespedes');


        if (respuesta.status === 401) {

            window.location.href = '/';
            return;

        }


        if (respuesta.status === 403) {

            mostrarToast(
                'No tiene permisos para acceder a residentes.',
                'error'
            );

            return;
        }


        const resultado = await respuesta.json();


        if (resultado.success) {

            listaResidentes = resultado.huespedes;

            aplicarFiltrosResidentes();

            actualizarEstadisticas(listaResidentes);

        } else {

            mostrarToast(
                'No se pudo cargar la lista de residentes.',
                'error'
            );
        }

    } catch (error) {

        mostrarToast(
            'Error de conexión con el servidor.',
            'error'
        );

        console.error(error);
    }
}

function actualizarEstadisticas(datos) {
    const activos = datos.filter(r => r.estado === 'Activo').length;
    document.getElementById('statTotal').textContent = datos.length;
    document.getElementById('statActivos').textContent = activos;
    document.getElementById('statInactivos').textContent = datos.filter(r => r.estado === 'Inactivo').length;
}

// ==========================================
// DIBUJAR LA TABLA
// ==========================================
function renderizarTabla(datos) {
    cuerpoTabla.replaceChildren();
    if (!datos.length) {
        const fila = document.createElement('tr'), celda = document.createElement('td');
        celda.colSpan = 7; celda.textContent = 'No hay residentes que coincidan con la búsqueda y el filtro.';
        fila.appendChild(celda); cuerpoTabla.appendChild(fila); return;
    }
    for (const r of datos) {
        const fila = document.createElement('tr');
        for (const valor of [r.nombres + ' ' + r.apellidos, r.dpi, Formatos.fecha(r.fecha_nacimiento), r.nombre_responsable || '—', 'Q' + Number(r.cuota_mensual).toFixed(2)]) {
            const celda = document.createElement('td'); celda.textContent = valor ?? ''; fila.appendChild(celda);
        }
        const estado = document.createElement('td'), badge = document.createElement('span');
        badge.className = 'badge-estado';
        if (['Activo', 'Inactivo'].includes(r.estado)) badge.classList.add(r.estado);
        badge.textContent = r.estado ?? ''; estado.appendChild(badge); fila.appendChild(estado);
        const acciones = document.createElement('td');
        const opciones = [['👁', 'btn-ver', abrirDetalle, 'Ver detalle'], ['Ficha médica', 'btn-ficha', verFichaMedica], ['Modificar', 'btn-editar', abrirEdicion]];
        if (r.estado === 'Activo') opciones.push(['Retirar', 'btn-baja', retirarResidente]);
        for (const [etiqueta, clase, accion, titulo] of opciones) {
            const boton = document.createElement('button');
            boton.type = 'button'; boton.className = 'btn-icono ' + clase;
            boton.textContent = etiqueta; boton.dataset.id = r.id_residente;
            if (titulo) { boton.title = titulo; boton.setAttribute('aria-label', titulo); }
            boton.addEventListener('click', () => accion(r.id_residente)); acciones.appendChild(boton);
        }
        fila.appendChild(acciones); cuerpoTabla.appendChild(fila);
    }
}

function rellenarFormulario(r) {
    idResidenteInput.value = r.id_residente;

    document.getElementById('nombres').value = r.nombres;
    document.getElementById('apellidos').value = r.apellidos;
    document.getElementById('dpi').value = r.dpi;
    document.getElementById('fechaNacimiento').value = r.fecha_nacimiento.split('T')[0];
    document.getElementById('genero').value = r.genero;
    document.getElementById('tipoSangre').value = r.tipo_sangre || '';
    document.getElementById('alergias').value = r.alergias || '';
    document.getElementById('requiereAsistencia').checked = !!r.requiere_asistencia_especial;
    document.getElementById('descripcionAsistencia').value = r.descripcion_asistencia || '';
    document.getElementById('cajaAsistencia').classList.toggle('oculto', !r.requiere_asistencia_especial);
    document.getElementById('responsable').value = r.nombre_responsable || '';
    document.getElementById('parentesco').value = r.parentesco || '';
    document.getElementById('telefonoEmergencia').value = r.telefono_emergencia || '';
    document.getElementById('cuotaMensual').value = r.cuota_mensual;

    // Campos de Ficha Médica
    document.getElementById('psicopatologias').value = r.psicopatologias || '';
    document.getElementById('padecimientos').value = r.padecimientos || '';
    document.getElementById('medicamentosHabituales').value = r.medicamentos_habituales || '';
    document.getElementById('antecedentes').value = r.antecedentes || '';
    document.getElementById('observaciones').value = r.observaciones || '';
}

// ==========================================
// BLOQUEAR / DESBLOQUEAR EL FORMULARIO
// (activar = true -> modo "Ver detalle": todo deshabilitado, sin botón Guardar)
// ==========================================
function establecerModoSoloLectura(activar) {
    formResidente.querySelectorAll('input, select').forEach(campo => campo.disabled = activar);
    btnGuardarResidente.classList.toggle('oculto', activar);
}

// ==========================================
// ABRIR MODAL EN MODO "VER DETALLE" (solo lectura)
// ==========================================
function abrirDetalle(id) {
    const r = listaResidentes.find(x => x.id_residente == id);
    if (!r) return;

    rellenarFormulario(r);
    establecerModoSoloLectura(true);

    tituloModalResidente.textContent = 'Detalle de Residente';
    modalResidente.classList.remove('oculto');
}

// ==========================================
// ABRIR MODAL EN MODO "MODIFICAR", PRE-LLENADO
// ==========================================
function abrirEdicion(id) {
    const r = listaResidentes.find(x => x.id_residente == id);
    if (!r) return;

    rellenarFormulario(r);
    establecerModoSoloLectura(false);

    tituloModalResidente.textContent = 'Modificar Residente';
    modalResidente.classList.remove('oculto');
}

// Mostrar/ocultar el campo de descripción de asistencia especial
document.getElementById('requiereAsistencia').addEventListener('change', function () {
    document.getElementById('cajaAsistencia').classList.toggle('oculto', !this.checked);
});

// ==========================================
// VER FICHA MÉDICA
// ==========================================

function verFichaMedica(id) {

    const r = listaResidentes.find(
        residente => residente.id_residente == id
    );

    if (!r) {
        mostrarToast(
            'No se encontró la información del residente.',
            'error'
        );

        return;
    }


    // Nombre del residente
    document.getElementById('fichaNombreResidente').textContent =
        `${r.nombres} ${r.apellidos}`;


    // Información médica
    document.getElementById('fichaAlergias').textContent =
        mostrarDato(r.alergias);

    document.getElementById('fichaPsicopatologias').textContent =
        mostrarDato(r.psicopatologias);

    document.getElementById('fichaPadecimientos').textContent =
        mostrarDato(r.padecimientos);

    document.getElementById('fichaMedicamentos').textContent =
        mostrarDato(r.medicamentos_habituales);

    document.getElementById('fichaAntecedentes').textContent =
        mostrarDato(r.antecedentes);

    document.getElementById('fichaObservaciones').textContent =
        mostrarDato(r.observaciones);


    // Asistencia especial
    let asistencia = 'No requiere asistencia especial';

    if (r.requiere_asistencia_especial) {

        asistencia =
            mostrarDato(r.descripcion_asistencia);
    }

    document.getElementById('fichaAsistencia').textContent =
        asistencia;


    // Abrir modal Bootstrap
    modalFicha.show();
    cargarHistorialMedico(r.id_residente);
}

function mostrarDato(valor) {

    if (
        valor === null ||
        valor === undefined ||
        String(valor).trim() === ''
    ) {
        return 'No registrado';
    }

    return valor;
}


// ==========================================
// GUARDAR (crea si no hay ID, actualiza si sí lo hay)
// ==========================================
formResidente.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const datos = {
        nombres: document.getElementById('nombres').value,
        apellidos: document.getElementById('apellidos').value,
        dpi: document.getElementById('dpi').value,
        fechaNacimiento: document.getElementById('fechaNacimiento').value,
        genero: document.getElementById('genero').value,
        tipoSangre: document.getElementById('tipoSangre').value,
        alergias: document.getElementById('alergias').value,
        requiereAsistencia: document.getElementById('requiereAsistencia').checked,
        descripcionAsistencia: document.getElementById('descripcionAsistencia').value,
        responsable: document.getElementById('responsable').value,
        parentesco: document.getElementById('parentesco').value,
        telefonoEmergencia: document.getElementById('telefonoEmergencia').value,
        cuotaMensual: document.getElementById('cuotaMensual').value,
        // Ficha médica
        psicopatologias: document.getElementById('psicopatologias').value,
        padecimientos: document.getElementById('padecimientos').value,
        medicamentosHabituales: document.getElementById('medicamentosHabituales').value,
        antecedentes: document.getElementById('antecedentes').value,
        observaciones: document.getElementById('observaciones').value
    };

    const id = idResidenteInput.value;
    const esEdicion = id !== '';

    try {
        const respuesta = await fetch(
            esEdicion ? `/api/huespedes/${id}` : '/api/huespedes',
            {
                method: esEdicion ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            }
        );

        const resultado = await respuesta.json();

        if (resultado.success) {
            mostrarToast(resultado.message, 'exito');
            modalResidente.classList.add('oculto');
            cargarResidentes();
        } else {
            mostrarToast(resultado.message, 'error');
        }
    } catch (error) {
        mostrarToast('Error de conexión con el servidor.', 'error');
        console.error(error);
    }
});

// ==========================================
// RETIRAR (baja lógica)
// ==========================================
async function retirarResidente(id) {
    const confirmar = await Cyberdeck.confirmar('¿Confirma que desea retirar a este residente? Su historial y ficha médica se conservarán.');
    if (!confirmar) return;

    try {
        const respuesta = await fetch(`/api/huespedes/${id}`, { method: 'DELETE' });
        const resultado = await respuesta.json();

        if (resultado.success) {
            mostrarToast(resultado.message, 'exito');
            cargarResidentes();
        } else {
            mostrarToast(resultado.message, 'error');
        }
    } catch (error) {
        mostrarToast('Error de conexión con el servidor.', 'error');
        console.error(error);
    }
}

// ==========================================
// BUSCAR (en tiempo real, por nombre o DPI)
// ==========================================
function aplicarFiltrosResidentes() {
    const texto = buscarInput.value.trim().toLowerCase();
    const filtrados = listaResidentes.filter(r =>
        (!estadoFiltrado || r.estado === estadoFiltrado) &&
        ((r.nombres + ' ' + r.apellidos).toLowerCase().includes(texto) || String(r.dpi || '').toLowerCase().includes(texto))
    );
    renderizarTabla(filtrados);
}
buscarInput.addEventListener('input', aplicarFiltrosResidentes);

// ==========================================
// NAVEGACIÓN
// ==========================================
document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = '/principal/admin_dashboard.html';
});

document.getElementById('btnCerrarSesion').addEventListener('click', async () => {

    try {

        await fetch('/api/logout', {
            method: 'POST'
        });

    } catch (error) {

        console.error('Error al cerrar sesión:', error);

    } finally {

        window.location.href = '/';
    }

});

// Carga inicial al abrir la página
cargarResidentes();
