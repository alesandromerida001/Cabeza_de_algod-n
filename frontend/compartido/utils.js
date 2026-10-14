// ==========================================
// UTILIDADES COMPARTIDAS DEL DASHBOARD
// ==========================================
// Cualquier página del dashboard que incluya este archivo (y tenga
// un <div id="toast">) puede usar mostrarToast() sin reescribirla.

function mostrarToast(texto, tipo = "exito") {
    const toast = document.getElementById('toast');
    toast.textContent = texto;
    toast.className = `toast ${tipo}`;

    clearTimeout(mostrarToast._temporizador);
    mostrarToast._temporizador = setTimeout(() => {
        toast.classList.add('oculto');
    }, 4000);
}
