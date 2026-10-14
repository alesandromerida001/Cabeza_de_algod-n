// Catálogos de Roles y Especialidades. Solo un modal Bootstrap visible a la vez.
function configurarCatalogo({ ruta, clave, singular, selectId, botonId, padreId, modalId, porNombre = false }) {
    const select = document.getElementById(selectId);
    const boton = document.getElementById(botonId);
    const padre = document.getElementById(padreId);
    const elemento = document.getElementById(modalId);
    const modal = bootstrap.Modal.getOrCreateInstance(elemento, { backdrop: 'static', keyboard: false });
    const nombre = elemento.querySelector('input');
    const mensaje = elemento.querySelector('[data-mensaje]');
    const guardar = elemento.querySelector('[data-guardar]');
    const cancelar = elemento.querySelector('[data-bs-dismiss]');
    const aviso = padre.querySelector('[data-aviso-catalogo]');
    let volverAlPadre = false;

    function agregarOpcion(registro) {
        const valor = String(porNombre ? registro.nombre : registro[`id_${singular}`]);
        let opcion = Array.from(select.options).find(o => o.value === valor);
        if (!opcion) {
            opcion = document.createElement('option');
            opcion.value = valor;
            select.appendChild(opcion);
        }
        opcion.textContent = registro.nombre;
        return valor;
    }

    async function cargar(seleccion = select.value) {
        try {
            const respuesta = await fetch(ruta);
            if (respuesta.status === 401) { window.location.href = '/'; return false; }
            const datos = await respuesta.json();
            if (!respuesta.ok || !datos.success) throw new Error(datos.message || 'No se pudo cargar el catálogo.');
            select.replaceChildren(new Option('Seleccione...', ''));
            datos[clave].forEach(agregarOpcion);
            select.value = seleccion == null ? '' : String(seleccion);
            aviso.textContent = datos.migracionPendiente
                ? 'Modo anterior: ejecute los scripts SQL para crear opciones nuevas y separar el rol del tipo de personal.' : '';
            return true;
        } catch (error) {
            aviso.textContent = error.message || 'No se pudo cargar el catálogo. Intente nuevamente.';
            return false;
        }
    }

    boton.addEventListener('click', () => {
        if (boton.disabled) return;
        boton.disabled = true;
        nombre.value = '';
        mensaje.textContent = '';
        volverAlPadre = true;
        guardar.disabled = true;
        cancelar.disabled = true;
        padre.addEventListener('hidden.bs.modal', () => modal.show(), { once: true });
        bootstrap.Modal.getInstance(padre).hide();
    });
    padre.addEventListener('show.bs.modal', () => { boton.disabled = true; });
    padre.addEventListener('shown.bs.modal', () => { boton.disabled = false; });
    elemento.addEventListener('shown.bs.modal', () => {
        guardar.disabled = false;
        cancelar.disabled = false;
        nombre.focus();
    });
    elemento.addEventListener('hidden.bs.modal', () => {
        if (volverAlPadre) {
            volverAlPadre = false;
            bootstrap.Modal.getInstance(padre).show();
        }
    });
    async function crear() {
        if (guardar.disabled) return;
        const texto = nombre.value.trim();
        if (!texto || texto.length > nombre.maxLength) {
            mensaje.textContent = 'Ingrese un nombre válido.';
            nombre.focus();
            return;
        }
        guardar.disabled = true;
        cancelar.disabled = true;
        mensaje.textContent = '';
        try {
            const respuesta = await fetch(ruta, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: texto })
            });
            if (respuesta.status === 401) { window.location.href = '/'; return; }
            const datos = await respuesta.json();
            if (!respuesta.ok || !datos.success) {
                mensaje.textContent = datos.message || 'No se pudo guardar. Intente nuevamente.';
                return;
            }
            // Conservar la opción creada incluso si la posterior actualización de la lista falla.
            const valor = agregarOpcion(datos[singular]);
            select.value = valor;
            const actualizado = await cargar(valor);
            aviso.textContent = actualizado ? 'Registro creado y seleccionado.'
                : 'Registro creado y seleccionado. No se pudo actualizar el resto del catálogo.';
            modal.hide();
        } catch (error) {
            mensaje.textContent = 'Error de conexión. No se pudo confirmar el guardado; revise el catálogo antes de reintentar.';
        } finally {
            guardar.disabled = false;
            cancelar.disabled = false;
        }
    }
    guardar.addEventListener('click', crear);
    nombre.addEventListener('keydown', evento => {
        if (evento.key === 'Enter') { evento.preventDefault(); crear(); }
    });
    return { cargar };
}
