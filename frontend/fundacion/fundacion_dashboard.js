// ==========================================================
// DASHBOARD - FUNDACIÓN
// ==========================================================
document.getElementById('btnVisitasRealizadas').addEventListener('click', () => {
    window.location.href = '/fundacion/visitas_realizadas.html';
});
document.getElementById('btnFichasMedicas').addEventListener('click', () => {
    window.location.href = '/fundacion/fichas_medicas.html';
});
document.getElementById('btnObligacionesFundacion').addEventListener('click', () => {
    window.location.href = '/finanzas/fundacion.html?origen=fundacion';
});


// ----------------------------------------------------------
// SOLICITUDES PENDIENTES
// ----------------------------------------------------------

const btnSolicitudesPendientes =
    document.getElementById('btnSolicitudesPendientes');

if (btnSolicitudesPendientes) {

    btnSolicitudesPendientes.addEventListener('click', () => {

        window.location.href =
            'solicitudes_fundacion.html?estado=Pendiente';

    });
}


// ----------------------------------------------------------
// SOLICITUDES PROGRAMADAS
// ----------------------------------------------------------

const btnSolicitudesProgramadas =
    document.getElementById('btnSolicitudesProgramadas');

if (btnSolicitudesProgramadas) {

    btnSolicitudesProgramadas.addEventListener('click', () => {

        window.location.href =
            'solicitudes_fundacion.html?estado=Programada';

    });
}


// ----------------------------------------------------------
// CERRAR SESIÓN
// ----------------------------------------------------------

const btnCerrarSesion =
    document.getElementById('btnCerrarSesion');

if (btnCerrarSesion) {

    btnCerrarSesion.addEventListener('click', async () => {

        try {

            await fetch('/api/logout', {
                method: 'POST'
            });

        } catch (error) {

            console.error(
                'Error al cerrar sesión:',
                error
            );

        } finally {

            window.location.href = '/';
        }

    });
}
