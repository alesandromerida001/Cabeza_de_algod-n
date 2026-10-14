// ==========================================================
// SOLICITUDES MÉDICAS
// ==========================================================


// Guardamos las solicitudes cargadas para poder consultarlas
// sin pedirlas nuevamente al servidor.
let listaSolicitudes = [];
let listaResidentes = [];
const catalogoEspecialidades = configurarCatalogo({ ruta: '/api/especialidades', clave: 'especialidades', singular: 'especialidad',
    selectId: 'especialidad', botonId: 'btnNuevaEspecialidad', padreId: 'modalSolicitud', modalId: 'modalNuevaEspecialidad', porNombre: true });

let estadoFiltrado = '';
document.getElementById('filtrosEstado').addEventListener('click', evento => {
    const boton = evento.target.closest('button[data-estado]');
    if (!boton) return;
    estadoFiltrado = boton.dataset.estado;
    document.querySelectorAll('#filtrosEstado button').forEach(b => b.setAttribute('aria-pressed', String(b === boton)));
    mostrarSolicitudes();
});

document.getElementById('buscarSolicitud').addEventListener('input', mostrarSolicitudes);


// ==========================================================
// ELEMENTOS PRINCIPALES
// ==========================================================

const cuerpoTabla =
    document.getElementById('cuerpoTablaSolicitudes');

const formSolicitud =
    document.getElementById('formSolicitud');

const selectResidente =
    document.getElementById('idResidente');

const modalSolicitud =
    new bootstrap.Modal(
        document.getElementById('modalSolicitud')
    );

const modalDetalle =
    new bootstrap.Modal(
        document.getElementById('modalDetalleSolicitud')
    );


// ==========================================================
// 1. CARGAR SOLICITUDES
// ==========================================================

async function cargarSolicitudes() {

    try {

        const respuesta =
            await fetch('/api/solicitudes');


        // Sesión vencida
        if (respuesta.status === 401) {

            window.location.href = '/';
            return;
        }


        // Usuario sin permisos
        if (respuesta.status === 403) {

            mostrarMensaje(
                'No tiene permisos para consultar solicitudes.',
                'error'
            );

            return;
        }


        const resultado =
            await respuesta.json();


        if (!resultado.success) {

            mostrarMensaje(
                resultado.message ||
                'No se pudieron cargar las solicitudes.',
                'error'
            );

            return;
        }


        listaSolicitudes =
            resultado.solicitudes;


        mostrarSolicitudes();

        actualizarEstadisticas();


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            'Error de conexión con el servidor.',
            'error'
        );
    }
}


// ==========================================================
// 2. MOSTRAR SOLICITUDES EN LA TABLA
// ==========================================================
//
// Aquí NO utilizamos innerHTML con datos de SQL.
// Usamos textContent para evitar inyección de HTML.
// ==========================================================

function mostrarSolicitudes() {

    cuerpoTabla.textContent = '';


    const texto = document.getElementById('buscarSolicitud').value.trim().toLowerCase();
    const filtradas = listaSolicitudes.filter(solicitud =>
        (!estadoFiltrado || solicitud.estado === estadoFiltrado) &&
        [solicitud.nombres, solicitud.apellidos, solicitud.especialidad, solicitud.motivo, solicitud.enfermero].join(' ').toLowerCase().includes(texto)
    );
    if (filtradas.length === 0) {

        const fila =
            document.createElement('tr');

        const celda =
            document.createElement('td');

        celda.colSpan = 7;

        celda.textContent =
            'No hay solicitudes que coincidan con la búsqueda y el filtro.';

        fila.appendChild(celda);

        cuerpoTabla.appendChild(fila);

        return;
    }


    filtradas.forEach(solicitud => {

        const fila =
            document.createElement('tr');


        // --------------------------------------------------
        // RESIDENTE
        // --------------------------------------------------

        const tdResidente =
            document.createElement('td');

        tdResidente.textContent =
            `${solicitud.nombres} ${solicitud.apellidos}`;


        // --------------------------------------------------
        // ESPECIALIDAD
        // --------------------------------------------------

        const tdEspecialidad =
            document.createElement('td');

        tdEspecialidad.textContent =
            solicitud.especialidad;


        // --------------------------------------------------
        // MOTIVO
        // --------------------------------------------------

        const tdMotivo =
            document.createElement('td');

        tdMotivo.textContent =
            solicitud.motivo;


        // --------------------------------------------------
        // ENFERMERO
        // --------------------------------------------------

        const tdEnfermero =
            document.createElement('td');

        tdEnfermero.textContent =
            solicitud.enfermero;


        // --------------------------------------------------
        // FECHA
        // --------------------------------------------------

        const tdFecha =
            document.createElement('td');

        tdFecha.textContent =
            formatearFecha(
                solicitud.fecha_solicitud
            );


        // --------------------------------------------------
        // ESTADO
        // --------------------------------------------------

        const tdEstado =
            document.createElement('td');

        const badge =
            document.createElement('span');

        badge.className =
            `badge-estado ${solicitud.estado}`;

        badge.textContent =
            solicitud.estado;

        tdEstado.appendChild(badge);


        // --------------------------------------------------
        // ACCIONES
        // --------------------------------------------------

        const tdAcciones =
            document.createElement('td');


        const btnVer =
            document.createElement('button');

        btnVer.type = 'button';

        btnVer.className =
            'btn-icono btn-ver';

        btnVer.textContent =
            'Ver';

        btnVer.addEventListener(
            'click',
            () => verSolicitud(solicitud)
        );


        tdAcciones.appendChild(btnVer);


        // El administrador únicamente puede cancelar
        // solicitudes que siguen pendientes.

        if (solicitud.estado === 'Pendiente') {

            const btnCancelar =
                document.createElement('button');

            btnCancelar.type = 'button';

            btnCancelar.className =
                'btn-icono btn-baja';

            btnCancelar.textContent =
                'Cancelar';

            btnCancelar.addEventListener(
                'click',
                () => cancelarSolicitud(
                    solicitud.id_solicitud
                )
            );

            tdAcciones.appendChild(
                btnCancelar
            );
        }


        // --------------------------------------------------
        // ARMAMOS LA FILA
        // --------------------------------------------------

        fila.appendChild(tdResidente);
        fila.appendChild(tdEspecialidad);
        fila.appendChild(tdMotivo);
        fila.appendChild(tdEnfermero);
        fila.appendChild(tdFecha);
        fila.appendChild(tdEstado);
        fila.appendChild(tdAcciones);


        cuerpoTabla.appendChild(fila);
    });
}


// ==========================================================
// 3. ESTADÍSTICAS
// ==========================================================

function actualizarEstadisticas() {

    const pendientes =
        listaSolicitudes.filter(
            s => s.estado === 'Pendiente'
        ).length;


    const programadas =
        listaSolicitudes.filter(
            s => s.estado === 'Programada'
        ).length;


    const finalizadas =
        listaSolicitudes.filter(
            s => s.estado === 'Finalizada'
        ).length;


    document.getElementById(
        'statPendientes'
    ).textContent = pendientes;


    document.getElementById(
        'statProgramadas'
    ).textContent = programadas;


    document.getElementById(
        'statFinalizadas'
    ).textContent = finalizadas;
}


// ==========================================================
// 4. CARGAR RESIDENTES ACTIVOS EN EL SELECT
// ==========================================================

async function cargarResidentes() {

    try {

        const respuesta =
            await fetch('/api/huespedes');


        if (respuesta.status === 401) {

            window.location.href = '/';
            return;
        }


        if (respuesta.status === 403) {

            mostrarMensaje(
                'No tiene permisos para consultar residentes.',
                'error'
            );

            return;
        }


        const resultado =
            await respuesta.json();


        if (!resultado.success) {

            mostrarMensaje(
                'No se pudieron cargar los residentes.',
                'error'
            );

            return;
        }


        // Limpiamos opciones anteriores
        selectResidente.textContent = '';


        const opcionInicial =
            document.createElement('option');

        opcionInicial.value = '';

        opcionInicial.textContent =
            'Seleccione un residente';

        selectResidente.appendChild(
            opcionInicial
        );


        // Solamente residentes activos
        listaResidentes =
            resultado.huespedes.filter(
                residente =>
                    residente.estado === 'Activo'
            );

        mostrarResidentesEnSelect(listaResidentes);


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            'Error al cargar los residentes.',
            'error'
        );
    }
}

// ==========================================================
// BUSCADOR RÁPIDO DE RESIDENTES
// ==========================================================

function mostrarResidentesEnSelect(residentes) {

    selectResidente.textContent = '';

    const opcionInicial =
        document.createElement('option');

    opcionInicial.value = '';

    opcionInicial.textContent =
        residentes.length > 0
            ? 'Seleccione un residente'
            : 'No se encontraron residentes';

    selectResidente.appendChild(opcionInicial);


    residentes.forEach(residente => {

        const opcion =
            document.createElement('option');

        opcion.value =
            residente.id_residente;

        opcion.textContent =
            `${residente.nombres} ${residente.apellidos} - DPI: ${residente.dpi}`;

        selectResidente.appendChild(opcion);
    });
}

const buscarResidenteSolicitud =
    document.getElementById('buscarResidenteSolicitud');


buscarResidenteSolicitud.addEventListener('input', () => {

    const texto =
        buscarResidenteSolicitud.value
            .trim()
            .toLowerCase();


    const filtrados =
        listaResidentes.filter(residente => {

            const nombreCompleto =
                `${residente.nombres} ${residente.apellidos}`
                    .toLowerCase();

            const dpi =
                String(residente.dpi || '')
                    .toLowerCase();

            return (
                nombreCompleto.includes(texto) ||
                dpi.includes(texto)
            );
        });


    mostrarResidentesEnSelect(filtrados);
});


// ==========================================================
// 5. ABRIR NUEVA SOLICITUD
// ==========================================================

document
    .getElementById('btnNuevaSolicitud')
    .addEventListener('click', async () => {

        formSolicitud.reset();
        await catalogoEspecialidades.cargar();
        mostrarResidentesEnSelect(listaResidentes);

        modalSolicitud.show();
    });


// ==========================================================
// 6. GUARDAR SOLICITUD
// ==========================================================

document
    .getElementById('btnGuardarSolicitud')
    .addEventListener(
        'click',
        guardarSolicitud
    );


async function guardarSolicitud() {

    const idResidente =
        selectResidente.value;

    const motivo =
        document
            .getElementById('motivo')
            .value
            .trim();

    const especialidad =
        document
            .getElementById('especialidad')
            .value;

    const enfermero =
        document
            .getElementById('enfermero')
            .value
            .trim();


    // ------------------------------------------------------
    // VALIDACIÓN FRONTEND
    // ------------------------------------------------------

    if (
        !idResidente ||
        !motivo ||
        !especialidad ||
        !enfermero
    ) {

        mostrarMensaje(
            'Complete todos los campos de la solicitud.',
            'error'
        );

        return;
    }


    if (motivo.length > 500) {

        mostrarMensaje(
            'El motivo no puede superar los 500 caracteres.',
            'error'
        );

        return;
    }


    if (enfermero.length > 150) {

        mostrarMensaje(
            'El nombre del enfermero es demasiado largo.',
            'error'
        );

        return;
    }


    const datos = {

        idResidente:
            Number(idResidente),

        motivo,

        especialidad,

        enfermero
    };


    try {

        const respuesta =
            await fetch(
                '/api/solicitudes',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(datos)
                }
            );


        if (respuesta.status === 401) {

            window.location.href = '/';
            return;
        }


        const resultado =
            await respuesta.json();


        if (!resultado.success) {

            mostrarMensaje(
                resultado.message ||
                'No se pudo crear la solicitud.',
                'error'
            );

            return;
        }


        mostrarMensaje(
            resultado.message,
            'exito'
        );


        modalSolicitud.hide();

        formSolicitud.reset();


        // Recargamos la tabla para mostrar
        // inmediatamente la nueva solicitud.
        await cargarSolicitudes();


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            'Error de conexión con el servidor.',
            'error'
        );
    }
}


// ==========================================================
// 7. VER DETALLE
// ==========================================================

function verSolicitud(solicitud) {

    document.getElementById(
        'detalleResidente'
    ).textContent =
        `${solicitud.nombres} ${solicitud.apellidos}`;


    document.getElementById(
        'detalleEspecialidad'
    ).textContent =
        solicitud.especialidad;


    document.getElementById(
        'detalleMotivo'
    ).textContent =
        solicitud.motivo;


    document.getElementById(
        'detalleEnfermero'
    ).textContent =
        solicitud.enfermero;


    document.getElementById(
        'detalleFechaSolicitud'
    ).textContent =
        formatearFecha(
            solicitud.fecha_solicitud
        );


    document.getElementById(
        'detalleEstado'
    ).textContent =
        solicitud.estado;


    document.getElementById(
        'detalleMedico'
    ).textContent =
        solicitud.medico ||
        'Aún no asignado';


    document.getElementById(
        'detalleFechaCita'
    ).textContent =
        solicitud.fecha_cita
            ? formatearFecha(
                solicitud.fecha_cita
            )
            : 'Aún no programada';


    document.getElementById(
        'detalleHoraCita'
    ).textContent =
        solicitud.hora_cita
            ? formatearHora(
                solicitud.hora_cita
            )
            : 'Aún no programada';


    modalDetalle.show();
}


// ==========================================================
// 8. CANCELAR SOLICITUD
// ==========================================================

async function cancelarSolicitud(id) {

    const confirmar =
        await Cyberdeck.confirmar(
            '¿Confirma que desea cancelar esta solicitud médica?'
        );


    if (!confirmar) {
        return;
    }


    try {

        const respuesta =
            await fetch(
                `/api/solicitudes/${id}/cancelar`,
                {
                    method: 'PUT'
                }
            );


        if (respuesta.status === 401) {

            window.location.href = '/';
            return;
        }


        const resultado =
            await respuesta.json();


        if (!resultado.success) {

            mostrarMensaje(
                resultado.message ||
                'No se pudo cancelar la solicitud.',
                'error'
            );

            return;
        }


        mostrarMensaje(
            resultado.message,
            'exito'
        );


        await cargarSolicitudes();


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            'Error de conexión con el servidor.',
            'error'
        );
    }
}


// ==========================================================
// 9. FUNCIONES AUXILIARES
// ==========================================================

function formatearFecha(fecha) {

    if (!fecha) {
        return '—';
    }

    return Formatos.fecha(fecha);
}


function formatearHora(hora) {

    if (!hora) {
        return '—';
    }

    // SQL Server puede devolver algo similar a:
    // 10:30:00
    // Nos interesa únicamente HH:mm.

    return String(hora)
        .substring(0, 5);
}


// ==========================================================
// 10. MENSAJES
// ==========================================================

function mostrarMensaje(
    mensaje,
    tipo = 'exito'
) {

    const toast =
        document.getElementById('toast');


    toast.textContent = mensaje;

    toast.className =
        `toast-sistema ${tipo}`;


    setTimeout(() => {

        toast.classList.add('oculto');

    }, 3500);
}


// ==========================================================
// 11. NAVEGACIÓN
// ==========================================================

document
    .getElementById('btnVolver')
    .addEventListener('click', () => {

        window.location.href =
            '/principal/admin_dashboard.html';
    });


document
    .getElementById('btnCerrarSesion')
    .addEventListener(
        'click',
        async () => {

            try {

                await fetch(
                    '/api/logout',
                    {
                        method: 'POST'
                    }
                );

            } catch (error) {

                console.error(
                    'Error al cerrar sesión:',
                    error
                );

            } finally {

                window.location.href = '/';
            }
        }
    );


// ==========================================================
// 12. CARGA INICIAL
// ==========================================================

cargarSolicitudes();

cargarResidentes();
catalogoEspecialidades.cargar();
