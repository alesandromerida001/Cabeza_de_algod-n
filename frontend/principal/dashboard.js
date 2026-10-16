// ==========================================
// NAVEGACIÓN DEL MENÚ PRINCIPAL
// ==========================================
const btnIrVisitas = document.getElementById('btnIrVisitas');
document.getElementById('btnFinanzas')?.addEventListener('click', () => {
    window.location.href = '/finanzas/finanzas.html';
});
document.getElementById('btnEstadosCuenta')?.addEventListener('click', () => {
    window.location.href = '/finanzas/cuentas.html';
});
if (btnIrVisitas) {
    btnIrVisitas.addEventListener('click', () => {
        window.location.href = '/fundacion/visitas_realizadas.html?origen=asilo';
    });
}

const btnIrResidentes = document.getElementById('btnIrResidentes');

if (btnIrResidentes) {
    btnIrResidentes.addEventListener('click', () => {
        window.location.href = '/residentes/residentes.html';
    });
}

const btnIrUsuarios = document.getElementById('btnIrUsuarios');

if (btnIrUsuarios) {
    btnIrUsuarios.addEventListener('click', () => {
        window.location.href = '/usuarios/usuarios.html';
    });
}

// ==========================================
// IR AL MÓDULO DE SOLICITUDES
// ==========================================
const btnIrSolicitudes = document.getElementById('btnIrSolicitudes');

if (btnIrSolicitudes) {
    btnIrSolicitudes.addEventListener('click', () => {
        window.location.href = '/solicitudes/solicitudes.html';
    });
}

// ==========================================
// CERRAR SESIÓN
// ==========================================

async function cerrarSesion() {
    try {
        await fetch('/api/logout', {
            method: 'POST'
        });
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    } finally {
        window.location.href = '/';
    }
}
