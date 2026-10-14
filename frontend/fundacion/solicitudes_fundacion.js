// ==========================================================
// SOLICITUDES MÉDICAS - FUNDACIÓN
// ==========================================================

let listaSolicitudes = [];


// Estado que estamos viendo actualmente
let estadoActual = 'Pendiente';


// ==========================================================
// ELEMENTOS
// ==========================================================

const cuerpoTabla =
    document.getElementById('cuerpoTablaSolicitudes');


const modalProgramar =
    new bootstrap.Modal(
        document.getElementById('modalProgramar')
    );


const modalDetalle =
    new bootstrap.Modal(
        document.getElementById('modalDetalle')
    );

const modalVisita =
    new bootstrap.Modal(
        document.getElementById('modalVisita')
    );


// ==========================================================
// FORMATO DE MONEDA
// ==========================================================

function obtenerValorMoneda(id) {

    const campo =
        document.getElementById(id);

    const texto = campo.value.trim().replace(/^Q\s*/, '');
    if (!texto) {
        return campo.value.trim() === '' ? 0 : NaN;
    }

    // Acepta decimales y miles agrupados; no convierte texto inválido en cero.
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(texto) &&
        !/^\.\d{1,2}$/.test(texto)) {
        return NaN;
    }
    return Number(texto.replace(/,/g, ''));
}

function validarCampoMoneda(campo) {
    const valor = obtenerValorMoneda(campo.id);
    const valido = Number.isFinite(valor) && valor >= 0 && valor <= 99999999.99;
    campo.setCustomValidity(valido ? '' : 'Ingrese un costo entre 0 y 99,999,999.99, con hasta dos decimales.');
    return valido;
}

function formatearQuetzales(numero) {

    return Number(numero).toLocaleString(
        'es-GT',
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}

document
    .querySelectorAll('.campo-moneda')
    .forEach(campo => {

        campo.addEventListener('focus', () => {

            const valor =
                obtenerValorMoneda(campo.id);

            if (campo.value.trim() && Number.isFinite(valor)) {
                campo.value = valor.toFixed(2);
            }
        });


        campo.addEventListener('blur', () => {

            const valor =
                obtenerValorMoneda(campo.id);

            if (validarCampoMoneda(campo) && campo.value.trim()) {
                campo.value = `Q ${formatearQuetzales(valor)}`;
            }

            actualizarPreviewCostos();
        });


        campo.addEventListener('input', () => {
            validarCampoMoneda(campo);
            actualizarPreviewCostos();
        });
    });
// ==========================================================
// VISITA MÉDICA
// ==========================================================


// ----------------------------------------------------------
// ABRIR VISITA
// ----------------------------------------------------------

function abrirVisita(solicitud) {

    document.getElementById(
        'idSolicitudVisita'
    ).value =
        solicitud.id_solicitud;


    document.getElementById(
        'visitaResidente'
    ).textContent =
        `${solicitud.nombres} ${solicitud.apellidos}`;


    document.getElementById(
        'visitaEspecialidad'
    ).textContent =
        solicitud.especialidad;


    document.getElementById(
        'visitaMedico'
    ).textContent =
        solicitud.medico || 'No asignado';


    // Limpiamos formulario

    document.getElementById(
        'diagnostico'
    ).value = '';

    document.getElementById(
        'examenes'
    ).value = '';

    document.getElementById(
        'resultadosExamenes'
    ).value = '';

    document.getElementById(
        'costoExamenes'
    ).value = '';

    document.getElementById(
        'medicamentos'
    ).value = '';

    document.getElementById(
        'cantidadMedicamentos'
    ).value = '';

    document.getElementById(
        'indicaciones'
    ).value = '';

    document.getElementById(
        'costoMedicamentos'
    ).value = '';

    document.getElementById(
        'costoConsulta'
    ).value = '';

    document.getElementById(
        'observacionesVisita'
    ).value = '';

    document.querySelectorAll('.campo-moneda').forEach(campo => campo.setCustomValidity(''));
    ['descuentoConsulta', 'descuentoExamenes', 'descuentoMedicamentos'].forEach(id => {
        document.getElementById(id).value = '20';
    });

    actualizarPreviewCostos();

    modalVisita.show();
}


// ----------------------------------------------------------
// PREVISUALIZAR COSTOS
// ----------------------------------------------------------

function actualizarPreviewCostos() {
    const costos = ['costoConsulta', 'costoExamenes', 'costoMedicamentos'].map(obtenerValorMoneda);
    const camposDescuento = ['descuentoConsulta', 'descuentoExamenes', 'descuentoMedicamentos']
        .map(id => document.getElementById(id));
    const previews = ['previewSubtotal', 'previewDescuentoConsulta', 'previewDescuentoExamenes',
        'previewDescuentoMedicamentos', 'previewDescuento', 'previewTotal'];

    if (costos.some(valor => !Number.isFinite(valor) || valor < 0 || valor > 99999999.99) ||
        camposDescuento.some(campo => !campo.validity.valid)) {
        previews.forEach(id => { document.getElementById(id).textContent = '—'; });
        return;
    }

    // Solo previsualización. El servidor vuelve a calcular y guarda los valores oficiales.
    const costosCentavos = costos.map(valor => Math.round((valor + Number.EPSILON) * 100));
    const porcentajesCentesimas = camposDescuento.map(campo =>
        Math.round((Number(campo.value) + Number.EPSILON) * 100));
    const descuentosCentavos = costosCentavos.map((costo, indice) =>
        Math.round(costo * porcentajesCentesimas[indice] / 10000));
    const subtotal = costosCentavos.reduce((suma, valor) => suma + valor, 0);
    const descuento = descuentosCentavos.reduce((suma, valor) => suma + valor, 0);
    const valores = [subtotal, ...descuentosCentavos, descuento, subtotal - descuento];

    previews.forEach((id, indice) => {
        document.getElementById(id).textContent = `Q ${formatearQuetzales(valores[indice] / 100)}`;
    });
}


// Los costos ya tienen su listener; aquí escuchamos los porcentajes.

[
    'descuentoConsulta',
    'descuentoExamenes',
    'descuentoMedicamentos'

].forEach(id => {

    document
        .getElementById(id)
        .addEventListener(
            'input',
            actualizarPreviewCostos
        );
});


// ----------------------------------------------------------
// REGISTRAR VISITA
// ----------------------------------------------------------

document
    .getElementById('btnRegistrarVisita')
    .addEventListener(
        'click',
        registrarVisita
    );


async function registrarVisita() {

    const boton = document.getElementById('btnRegistrarVisita');
    if (boton.disabled) return;

    const idSolicitud =
        document.getElementById(
            'idSolicitudVisita'
        ).value;


    const diagnostico =
        document.getElementById(
            'diagnostico'
        ).value.trim();


    if (!diagnostico) {

        mostrarMensaje(
            'Debe ingresar el diagnóstico.',
            'error'
        );

        return;
    }


    for (const campo of document.querySelectorAll('.campo-moneda')) {
        if (!validarCampoMoneda(campo)) {
            campo.reportValidity();
            return;
        }
    }
    for (const id of ['descuentoConsulta', 'descuentoExamenes', 'descuentoMedicamentos']) {
        if (!document.getElementById(id).reportValidity()) return;
    }

    const datos = {

        idSolicitud:
            Number(idSolicitud),

        diagnostico,

        examenes:
            document.getElementById(
                'examenes'
            ).value.trim(),

        resultadosExamenes:
            document.getElementById(
                'resultadosExamenes'
            ).value.trim(),

        costoExamenes:
            obtenerValorMoneda(
                'costoExamenes'
            ),

        medicamentos:
            document.getElementById(
                'medicamentos'
            ).value.trim(),

        cantidadMedicamentos:
            document.getElementById(
                'cantidadMedicamentos'
            ).value.trim(),

        indicaciones:
            document.getElementById(
                'indicaciones'
            ).value.trim(),

        costoMedicamentos:
             obtenerValorMoneda(
                'costoMedicamentos'
            ),

        costoConsulta:
            obtenerValorMoneda(
                'costoConsulta'
            ),

        descuentoConsulta: Number(document.getElementById('descuentoConsulta').value),
        descuentoExamenes: Number(document.getElementById('descuentoExamenes').value),
        descuentoMedicamentos: Number(document.getElementById('descuentoMedicamentos').value),
        observaciones:
            document.getElementById(
                'observacionesVisita'
            ).value.trim()
    };


    boton.disabled = true;
    try {

        const respuesta =
            await fetch(
                '/api/visitas',
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
                'No se pudo registrar la visita.',
                'error'
            );

            return;
        }


        modalVisita.hide();


        mostrarMensaje(
            `Visita registrada. Total: Q ${formatearQuetzales(resultado.calculo.total)}`,
            'exito'
        );


        // La solicitud acaba de cambiar
        // Programada -> Finalizada
        await cargarSolicitudes();


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            'Error de conexión con el servidor.',
            'error'
        );
    } finally {
        boton.disabled = false;
    }
}
// ==========================================================
// 1. LEER ESTADO DESDE LA URL
// ==========================================================
//
// Ejemplo:
// solicitudes_fundacion.html?estado=Pendiente
//

function obtenerEstadoInicial() {

    const parametros =
        new URLSearchParams(
            window.location.search
        );

    const estado =
        parametros.get('estado');


    if (
        estado === 'Pendiente' ||
        estado === 'Programada'
    ) {

        estadoActual = estado;
    }
}


// ==========================================================
// 2. CARGAR SOLICITUDES
// ==========================================================

async function cargarSolicitudes() {

    try {

        const respuesta =
            await fetch('/api/solicitudes');


        if (respuesta.status === 401) {

            window.location.href = '/';
            return;
        }


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


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            'Error de conexión con el servidor.',
            'error'
        );
    }
}


// ==========================================================
// 3. MOSTRAR SOLICITUDES
// ==========================================================

function mostrarSolicitudes() {

    cuerpoTabla.textContent = '';


    const filtradas =
        listaSolicitudes.filter(
            solicitud =>
                solicitud.estado === estadoActual
        );


    actualizarTitulo();


    if (filtradas.length === 0) {

        const fila =
            document.createElement('tr');

        const celda =
            document.createElement('td');

        celda.colSpan = 7;

        celda.textContent =
            estadoActual === 'Pendiente'
                ? 'No hay solicitudes pendientes.'
                : 'No hay solicitudes programadas.';


        fila.appendChild(celda);

        cuerpoTabla.appendChild(fila);

        return;
    }


    filtradas.forEach(solicitud => {

        const fila =
            document.createElement('tr');


        // RESIDENTE

        const tdResidente =
            document.createElement('td');

        tdResidente.textContent =
            `${solicitud.nombres} ${solicitud.apellidos}`;


        // ESPECIALIDAD

        const tdEspecialidad =
            document.createElement('td');

        tdEspecialidad.textContent =
            solicitud.especialidad;


        // MOTIVO

        const tdMotivo =
            document.createElement('td');

        tdMotivo.textContent =
            solicitud.motivo;


        // ENFERMERO

        const tdEnfermero =
            document.createElement('td');

        tdEnfermero.textContent =
            solicitud.enfermero;


        // FECHA SOLICITUD

        const tdFecha =
            document.createElement('td');

        tdFecha.textContent =
            formatearFecha(
                solicitud.fecha_solicitud
            );


        // ESTADO

        const tdEstado =
            document.createElement('td');

        const badge =
            document.createElement('span');

        badge.className =
            `badge-estado ${solicitud.estado}`;

        badge.textContent =
            solicitud.estado;

        tdEstado.appendChild(badge);


        // ACCIONES

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
            () => verDetalle(solicitud)
        );


        tdAcciones.appendChild(btnVer);


        // Solo las pendientes pueden programarse

        if (solicitud.estado === 'Pendiente') {

            const btnProgramar =
                document.createElement('button');

            btnProgramar.type = 'button';

            btnProgramar.className =
                'btn-icono';

            btnProgramar.textContent =
                'Programar';


            btnProgramar.addEventListener(
                'click',
                () => abrirProgramacion(
                    solicitud
                )
            );


            tdAcciones.appendChild(
                btnProgramar
            );
        }
        
        // --------------------------------------------------
        // REGISTRAR VISITA
        // Solo aparece para solicitudes programadas
        // --------------------------------------------------

        if (solicitud.estado === 'Programada') {

            const btnVisita =
                document.createElement('button');

            btnVisita.type = 'button';

            btnVisita.className =
                'btn-icono';

            btnVisita.textContent =
                'Registrar visita';


            btnVisita.addEventListener(
                'click',
                () => abrirVisita(solicitud)
            );


            tdAcciones.appendChild(btnVisita);
        }

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
// 4. ABRIR MODAL PARA PROGRAMAR
// ==========================================================

function abrirProgramacion(solicitud) {

    document.getElementById(
        'idSolicitudProgramar'
    ).value =
        solicitud.id_solicitud;


    document.getElementById(
        'programarResidente'
    ).textContent =
        `${solicitud.nombres} ${solicitud.apellidos}`;


    document.getElementById(
        'programarEspecialidad'
    ).textContent =
        solicitud.especialidad;


    document.getElementById(
        'programarMotivo'
    ).textContent =
        solicitud.motivo;


    // Limpiamos datos de una programación anterior

    document.getElementById(
        'medico'
    ).value = '';

    document.getElementById(
        'fechaCita'
    ).value = '';

    document.getElementById(
        'horaCita'
    ).value = '';


    modalProgramar.show();
}


// ==========================================================
// 5. PROGRAMAR CITA
// ==========================================================

document
    .getElementById('btnConfirmarProgramacion')
    .addEventListener(
        'click',
        programarCita
    );


async function programarCita() {

    const id =
        document.getElementById(
            'idSolicitudProgramar'
        ).value;


    const medico =
        document.getElementById(
            'medico'
        ).value.trim();


    const fechaCita =
        document.getElementById(
            'fechaCita'
        ).value;


    const horaCita =
        document.getElementById(
            'horaCita'
        ).value;


    // VALIDACIÓN

    if (
        !id ||
        !medico ||
        !fechaCita ||
        !horaCita
    ) {

        mostrarMensaje(
            'Complete médico, fecha y hora.',
            'error'
        );

        return;
    }


    try {

        const respuesta =
            await fetch(
                `/api/solicitudes/${id}/programar`,
                {
                    method: 'PUT',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        medico,
                        fechaCita,
                        horaCita
                    })
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
                'No se pudo programar la cita.',
                'error'
            );

            return;
        }


        modalProgramar.hide();


        mostrarMensaje(
            'Cita programada correctamente.',
            'exito'
        );


        // Actualizamos datos
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
// 6. VER DETALLE
// ==========================================================

function verDetalle(solicitud) {

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
        'detalleEstado'
    ).textContent =
        solicitud.estado;


    document.getElementById(
        'detalleMedico'
    ).textContent =
        solicitud.medico ||
        'No asignado';


    document.getElementById(
        'detalleFecha'
    ).textContent =
        solicitud.fecha_cita
            ? formatearFecha(
                solicitud.fecha_cita,
                true
            )
            : 'No programada';


    document.getElementById(
        'detalleHora'
    ).textContent =
        solicitud.hora_cita
            ? formatearHora(
                solicitud.hora_cita
            )
            : 'No programada';


    modalDetalle.show();
}


// ==========================================================
// 7. CAMBIAR ENTRE PENDIENTES Y PROGRAMADAS
// ==========================================================

document
    .getElementById('btnVerPendientes')
    .addEventListener('click', () => {

        estadoActual = 'Pendiente';

        mostrarSolicitudes();
    });


document
    .getElementById('btnVerProgramadas')
    .addEventListener('click', () => {

        estadoActual = 'Programada';

        mostrarSolicitudes();
    });


// ==========================================================
// 8. ACTUALIZAR TÍTULO
// ==========================================================

function actualizarTitulo() {

    const titulo =
        document.getElementById(
            'tituloPagina'
        );


    const descripcion =
        document.getElementById(
            'descripcionPagina'
        );


    if (estadoActual === 'Pendiente') {

        titulo.textContent =
            'Solicitudes Pendientes';

        descripcion.textContent =
            'Solicitudes médicas que esperan programación.';

    } else {

        titulo.textContent =
            'Solicitudes Programadas';

        descripcion.textContent =
            'Citas médicas que ya tienen médico, fecha y hora asignados.';
    }
}


// ==========================================================
// 9. FUNCIONES AUXILIARES
// ==========================================================

function formatearFecha(fecha, soloFecha = false) {

    if (!fecha) {
        return '—';
    }

    // SQL DATE llega a medianoche UTC: conservar el día elegido para la cita.
    return Formatos.fecha(fecha);
}


function formatearHora(hora) {

    if (!hora) {
        return '—';
    }

    const [horas, minutos] = String(hora).split(':');
    const numeroHora = Number(horas);
    return `${String(numeroHora % 12 || 12).padStart(2, '0')}:${minutos} ${numeroHora < 12 ? 'AM' : 'PM'}`;
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
// 11. VOLVER
// ==========================================================

document
    .getElementById('btnVolver')
    .addEventListener('click', () => {

        window.location.href =
            'fundacion_dashboard.html';
    });


// ==========================================================
// 12. LOGOUT
// ==========================================================

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

            } finally {

                window.location.href = '/';
            }
        }
    );


// ==========================================================
// 13. INICIAR
// ==========================================================

obtenerEstadoInicial();

cargarSolicitudes();
