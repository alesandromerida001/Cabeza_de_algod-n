const formulario = document.getElementById("formLogin");
const correo = document.getElementById("correo");
const contrasena = document.getElementById("contrasena");
const mensaje = document.getElementById("mensaje");
const botonIngresar = document.getElementById("botonIngresar");
const botonMostrar = document.getElementById("mostrarContrasena");

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = "mensaje " + tipo;
}

botonMostrar.addEventListener("click", function () {
    if (contrasena.type === "password") {
        contrasena.type = "text";
        botonMostrar.textContent = "Ocultar";
    } else {
        contrasena.type = "password";
        botonMostrar.textContent = "Mostrar";
    }
});

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    if (botonIngresar.disabled) return;

    const correoIngresado = correo.value.trim();
    const contrasenaIngresada = contrasena.value;

    // VALIDACIONES
    if (correoIngresado === "") {
        mostrarMensaje("Ingrese su correo electrónico para continuar.", "error");
        correo.focus();
        return;
    }

    if (!correo.validity.valid) {
        mostrarMensaje("Escriba un correo electrónico válido.", "error");
        correo.focus();
        return;
    }

    if (contrasenaIngresada === "") {
        mostrarMensaje("Ingrese su contraseña para continuar.", "error");
        contrasena.focus();
        return;
    }

    botonIngresar.disabled = true;
    botonIngresar.textContent = "Verificando acceso...";

    try {
        // Petición real al Backend de Node.js
        const respuesta = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo: correoIngresado, contrasena: contrasenaIngresada })
        });

        const datos = await respuesta.json();

        if (datos.success) {
            mostrarMensaje("Acceso autorizado. Redirigiendo...", "exito");

            // REDIRECCIÓN POR TIPO DE PERSONAL
            // El rol institucional no decide el acceso.
            setTimeout(() => {
                if (datos.tipo_personal === 'Asilo') {
                    window.location.href = '/principal/admin_dashboard.html';
                } else if (datos.tipo_personal === 'Fundacion') {
                    window.location.href = '/fundacion/fundacion_dashboard.html';
                } else {
                    mostrarMensaje("Su tipo de personal no tiene un panel asignado. Contacte al administrador.", "error");
                }
            }, 2000); // Pausa de 2 segundos para que el usuario lea el mensaje de éxito

        } else {
            mostrarMensaje(datos.message, "error");
            botonIngresar.disabled = false;
            botonIngresar.textContent = "Ingresar al sistema";
        }
    } catch (error) {
        mostrarMensaje("Error al conectar con el servidor.", "error");
        botonIngresar.disabled = false;
        botonIngresar.textContent = "Ingresar al sistema";
    } finally {
        botonIngresar.disabled = false;
        botonIngresar.textContent = "Ingresar al sistema";
    }
});
