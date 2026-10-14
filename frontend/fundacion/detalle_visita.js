// Formato y detalle de solo lectura compartidos por Visitas realizadas y Fichas médicas.
const modalVisita = new bootstrap.Modal(document.getElementById('modalVisita'));
const formatoNumero = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function texto(valor) {
    return valor == null || String(valor).trim() === '' ? 'No registrado' : String(valor);
}

function numero(valor) {
    if (valor == null || String(valor).trim() === '') return null;
    const resultado = Number(valor);
    return Number.isFinite(resultado) ? resultado : null;
}

function moneda(valor) {
    const cantidad = numero(valor);
    return cantidad === null ? 'No registrado' : `Q ${formatoNumero.format(cantidad)}`;
}

function porcentaje(valor) {
    const cantidad = numero(valor);
    return cantidad === null ? 'No registrado' : `${cantidad} %`;
}

// SQL serializa fechas como ISO: conservar su día de calendario sin desplazarlo por UTC.
function diaVisita(valor) { return Formatos.dia(valor); }

function fechaVisible(valor) { return Formatos.fecha(valor); }

function residente(visita) {
    return texto([visita.nombres, visita.apellidos].filter(v => v != null && String(v).trim()).join(' '));
}

function verVisita(visita) {
    const campos = {
        residente: residente(visita), especialidad: texto(visita.especialidad), medico: texto(visita.medico), fecha_visita: fechaVisible(visita.fecha_visita)
    };
    for (const campo of ['diagnostico', 'examenes', 'resultados_examenes', 'medicamentos', 'cantidad_medicamentos', 'indicaciones', 'observaciones']) campos[campo] = texto(visita[campo]);
    for (const campo of ['costo_consulta', 'costo_examenes', 'costo_medicamentos', 'subtotal', 'descuento', 'total']) campos[campo] = moneda(visita[campo]);
    for (const campo of ['descuento_consulta_porcentaje', 'descuento_examenes_porcentaje', 'descuento_medicamentos_porcentaje']) campos[campo] = porcentaje(visita[campo]);
    for (const [campo, valor] of Object.entries(campos)) document.getElementById(`detalle_${campo}`).textContent = valor;
    modalVisita.show();
}

