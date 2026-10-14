let listaUsuarios = [];
const catalogoRoles = configurarCatalogo({ ruta: '/api/roles', clave: 'roles', singular: 'rol', selectId: 'rol',
    botonId: 'btnNuevoRol', padreId: 'modalUsuario', modalId: 'modalNuevoRol' });
const tablaUsuarios = document.getElementById('tablaUsuarios');

const modalUsuario = new bootstrap.Modal(
    document.getElementById('modalUsuario')
);

const formUsuario = document.getElementById('formUsuario');

const btnNuevoUsuario = document.getElementById('btnNuevoUsuario');
const btnGuardarUsuario = document.getElementById('btnGuardarUsuario');


// ==========================================
// CARGAR USUARIOS
// ==========================================

async function cargarUsuarios() {

    try {

        const respuesta = await fetch('/api/usuarios');

        // Sesión vencida o inexistente
        if (respuesta.status === 401) {
            window.location.href = '/';
            return;
        }

        // Usuario sin permisos
        if (respuesta.status === 403) {
            mostrarMensaje(
                'No tiene permisos para acceder a este módulo.',
                'danger'
            );
            return;
        }

        const datos = await respuesta.json();

        if (!datos.success) {
            mostrarMensaje(
                datos.message || 'No fue posible cargar los usuarios.',
                'danger'
            );
            return;
        }

        listaUsuarios = datos.usuarios;
        aplicarFiltrosUsuarios();

    } catch (error) {

        console.error(error);

        mostrarMensaje(
            'Error al comunicarse con el servidor.',
            'danger'
        );
    }
}


// ==========================================
// MOSTRAR USUARIOS
// ==========================================

function mostrarUsuarios(usuarios) {

    // Limpiamos la tabla de forma segura
    tablaUsuarios.replaceChildren();

    if (!usuarios.length) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 7;
        celda.textContent = 'No hay usuarios que coincidan con la búsqueda y el filtro.';
        fila.appendChild(celda);
        tablaUsuarios.appendChild(fila);
    }
    usuarios.forEach(usuario => {

        const fila = document.createElement('tr');


        const tdNombre = document.createElement('td');
        tdNombre.textContent =
            `${usuario.nombres} ${usuario.apellidos}`;


        const tdCorreo = document.createElement('td');
        tdCorreo.textContent = usuario.correo;


        const tdTelefono = document.createElement('td');
        tdTelefono.textContent = usuario.telefono || '';


        const tdRol = document.createElement('td');

        tdRol.textContent = usuario.rol || 'Sin asignar';
        const tdTipo = document.createElement('td');
        tdTipo.textContent = usuario.tipo_personal === 'Fundacion' ? 'Fundación' : (usuario.tipo_personal || 'Pendiente de migración');


        const tdEstado = document.createElement('td');
        tdEstado.textContent = usuario.estado;


        const tdAcciones = document.createElement('td');


        const btnEditar = document.createElement('button');

        btnEditar.type = 'button';
        btnEditar.className = 'btn btn-sm btn-warning me-2';
        btnEditar.textContent = 'Editar';

        btnEditar.addEventListener('click', () => {
            abrirEditarUsuario(usuario);
        });


        const btnEstado = document.createElement('button');

        btnEstado.type = 'button';

        if (usuario.estado === 'Activo') {

            btnEstado.className = 'btn btn-sm btn-danger';
            btnEstado.textContent = 'Desactivar';

        } else {

            btnEstado.className = 'btn btn-sm btn-success';
            btnEstado.textContent = 'Activar';
        }


        btnEstado.addEventListener('click', () => {

            if (usuario.estado === 'Activo') {
                desactivarUsuario(usuario.id_usuario);
            } else {
                activarUsuario(usuario);
            }

        });


        tdAcciones.appendChild(btnEditar);
        tdAcciones.appendChild(btnEstado);


        fila.appendChild(tdNombre);
        fila.appendChild(tdCorreo);
        fila.appendChild(tdTelefono);
        fila.appendChild(tdTipo);
        fila.appendChild(tdRol);
        fila.appendChild(tdEstado);
        fila.appendChild(tdAcciones);

        tablaUsuarios.appendChild(fila);
    });
}

//NUEVO USUARIO
btnNuevoUsuario.addEventListener('click', async () => {

    limpiarErrorUsuario();
    formUsuario.reset();
    document.getElementById('tipoPersonal').value = 'Asilo';
    await catalogoRoles.cargar();

    document.getElementById('idUsuario').value = '';

    document.getElementById('estado').value = 'Activo';

    document.getElementById('tituloModal').textContent =
        'Nuevo Usuario';

    document.getElementById('ayudaContrasena').textContent =
        'Mínimo 8 caracteres.';

    modalUsuario.show();
});
//EDITAR USUARIOS
async function abrirEditarUsuario(usuario) {
    limpiarErrorUsuario();
    await catalogoRoles.cargar(usuario.id_rol);

    document.getElementById('idUsuario').value =
        usuario.id_usuario;

    document.getElementById('nombres').value =
        usuario.nombres;

    document.getElementById('apellidos').value =
        usuario.apellidos;

    document.getElementById('correo').value =
        usuario.correo;

    document.getElementById('telefono').value =
        usuario.telefono || '';

    document.getElementById('rol').value = usuario.id_rol == null ? '' : String(usuario.id_rol);
    document.getElementById('tipoPersonal').value = usuario.tipo_personal || '';

    document.getElementById('estado').value =
        usuario.estado || '';

    // JAMÁS cargamos el hash existente
    document.getElementById('contrasena').value = '';

    document.getElementById('tituloModal').textContent =
        'Editar Usuario';

    document.getElementById('ayudaContrasena').textContent =
        'Dejar vacío para conservar la contraseña actual.';

    modalUsuario.show();
}

//Guardar crear/editar
btnGuardarUsuario.addEventListener('click', guardarUsuario);


async function guardarUsuario() {

    if (btnGuardarUsuario.disabled) return;
    limpiarErrorUsuario();
    const id = document.getElementById('idUsuario').value;

    const usuario = {

        nombres:
            document.getElementById('nombres').value.trim(),

        apellidos:
            document.getElementById('apellidos').value.trim(),

        correo:
            document.getElementById('correo').value.trim(),

        telefono:
            document.getElementById('telefono').value.trim(),

        id_rol: Number(document.getElementById('rol').value),
        tipo_personal: document.getElementById('tipoPersonal').value,

        estado:
            document.getElementById('estado').value || null,

        contrasena:
            document.getElementById('contrasena').value
    };


    // Validación frontend
    if (
        !usuario.nombres ||
        !usuario.apellidos ||
        !usuario.correo || !usuario.tipo_personal || !usuario.id_rol
    ) {

        mostrarErrorUsuario(
            'Nombres, apellidos, correo, tipo de personal y rol son obligatorios.',
            'warning'
        );

        return;
    }


    // Si estamos CREANDO, contraseña obligatoria
    if (!id && !usuario.contrasena) {

        mostrarErrorUsuario(
            'Debe ingresar una contraseña.',
            'warning'
        );

        return;
    }


    // Si escribió contraseña, mínimo 8 caracteres
    if (
        usuario.contrasena &&
        usuario.contrasena.length < 8
    ) {

        mostrarErrorUsuario(
            'La contraseña debe tener al menos 8 caracteres.',
            'warning'
        );

        return;
    }


    btnGuardarUsuario.disabled = true;
    try {

        const url = id
            ? `/api/usuarios/${id}`
            : '/api/usuarios';

        const metodo = id
            ? 'PUT'
            : 'POST';


        const respuesta = await fetch(url, {

            method: metodo,

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(usuario)
        });


        if (respuesta.status === 401) {
            window.location.href = '/';
            return;
        }


        if (respuesta.status === 403) {

            mostrarErrorUsuario(
                'No tiene permisos para realizar esta acción.',
                'danger'
            );

            return;
        }


        const datos = await respuesta.json();


        if (!respuesta.ok) {

            mostrarErrorUsuario(
                datos.message || 'No fue posible guardar el usuario.',
                'danger'
            );

            return;
        }


        modalUsuario.hide();

        mostrarMensaje(
            datos.message,
            'success'
        );

        await cargarUsuarios();


    } catch (error) {

        console.error(error);

        mostrarErrorUsuario(
            'Error al comunicarse con el servidor.',
            'danger'
        );
    } finally {
        btnGuardarUsuario.disabled = false;
    }
}

//descativar el usuario
async function desactivarUsuario(id) {

    const confirmar = await Cyberdeck.confirmar(
        '¿Desea desactivar este usuario?'
    );

    if (!confirmar) {
        return;
    }


    try {

        const respuesta = await fetch(
            `/api/usuarios/${id}`,
            {
                method: 'DELETE'
            }
        );


        if (respuesta.status === 401) {
            window.location.href = '/';
            return;
        }


        if (respuesta.status === 403) {

            mostrarMensaje(
                'No tiene permisos para realizar esta acción.',
                'danger'
            );

            return;
        }


        const datos = await respuesta.json();


        if (!respuesta.ok) {

            mostrarMensaje(
                datos.message || 'No fue posible desactivar el usuario.',
                'danger'
            );

            return;
        }


        mostrarMensaje(
            datos.message,
            'success'
        );

        await cargarUsuarios();


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            'Error al comunicarse con el servidor.',
            'danger'
        );
    }
}

//reactivar un usuario
async function activarUsuario(usuario) {

    const datosUsuario = {

        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        telefono: usuario.telefono || '',
        id_rol: usuario.id_rol,
        tipo_personal: usuario.tipo_personal,
        estado: 'Activo',

        // Vacía = conservar contraseña actual
        contrasena: ''
    };


    try {

        const respuesta = await fetch(
            `/api/usuarios/${usuario.id_usuario}`,
            {

                method: 'PUT',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify(datosUsuario)
            }
        );


        if (respuesta.status === 401) {
            window.location.href = '/';
            return;
        }


        if (respuesta.status === 403) {

            mostrarMensaje(
                'No tiene permisos para realizar esta acción.',
                'danger'
            );

            return;
        }


        const datos = await respuesta.json();


        if (!respuesta.ok) {

            mostrarMensaje(
                datos.message || 'No fue posible activar el usuario.',
                'danger'
            );

            return;
        }


        mostrarMensaje(
            'Usuario activado correctamente.',
            'success'
        );

        await cargarUsuarios();


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            'Error al comunicarse con el servidor.',
            'danger'
        );
    }
}

function limpiarErrorUsuario() {
    const contenedor = document.getElementById('mensajeUsuario');
    contenedor.className = '';
    contenedor.replaceChildren();
}

function mostrarErrorUsuario(texto, tipo = 'danger') {
    const contenedor = document.getElementById('mensajeUsuario');
    contenedor.className = 'alert alert-' + tipo;
    contenedor.textContent = texto;
}

//mesnajes del cerrar sesion
function mostrarMensaje(texto, tipo) {

    const contenedor =
        document.getElementById('mensaje');

    contenedor.replaceChildren();

    const alerta = document.createElement('div');

    alerta.className =
        `alert alert-${tipo}`;

    alerta.textContent = texto;

    contenedor.appendChild(alerta);


    setTimeout(() => {

        alerta.remove();

    }, 4000);
}

//CERRAR LA SESION 
async function cerrarSesion() {

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
}

const btnVolverMenu = document.getElementById('btnVolverMenu');

btnVolverMenu.addEventListener('click', () => {
    window.location.href = '/principal/admin_dashboard.html';
});


let estadoFiltrado = '';
document.getElementById('filtrosEstado').addEventListener('click', evento => {
    const boton = evento.target.closest('button[data-estado]');
    if (!boton) return;
    estadoFiltrado = boton.dataset.estado;
    document.querySelectorAll('#filtrosEstado button').forEach(b => b.setAttribute('aria-pressed', String(b === boton)));
    aplicarFiltrosUsuarios();
});

function aplicarFiltrosUsuarios() {
    const texto = document.getElementById('buscarUsuario').value.trim().toLowerCase();
    mostrarUsuarios(listaUsuarios.filter(usuario =>
        (!estadoFiltrado || usuario.estado === estadoFiltrado) &&
        [usuario.nombres, usuario.apellidos, usuario.correo, usuario.telefono, usuario.rol].join(' ').toLowerCase().includes(texto)
    ));
}
document.getElementById('buscarUsuario').addEventListener('input', aplicarFiltrosUsuarios);

// Arrancamos el módulo
cargarUsuarios();
catalogoRoles.cargar();
