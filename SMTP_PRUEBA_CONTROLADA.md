# Correo: prueba controlada de una notificación

## Estado y funcionamiento verificados en código

Servicio: `backend/notificaciones-correo.js`, con Nodemailer ya instalado. Express inicia un temporizador de 30 segundos mediante `finanzas.iniciarCorreos()`. No se creó otro sistema de envío.

Los eventos Cita, Cargo y Pago se insertan en `NotificacionesCorreo` dentro de las transacciones existentes. El trabajador solo consume eventos confirmados. La restricción UNIQUE(evento,id_evento) y la comprobación parametrizada evitan duplicar eventos. La selección y cambio a Enviando ocurren en una única sentencia con bloqueos SQL; además hay exclusión dentro del proceso.

Estados: Pendiente → Enviando → Enviada, o Incierta ante fallo/resultado ambiguo. En operación normal, un Enviando de más de cinco minutos pasa a Incierta. No hay reintentos automáticos de Incierta: revisar primero el proveedor. Un Message-ID estable ayuda a rastrear, pero no garantiza deduplicación del proveedor. Enviada significa aceptación SMTP, no recepción confirmada en la bandeja de entrada.

Las plantillas incluyen texto plano y HTML escapado. Cita comunica fecha, hora, residente y especialidad; Cargo comunica concepto, importe, período y saldo; Pago comunica modalidad, concepto de abono/pago completo, comprobante, importe y saldo. No se añade historial clínico.

Con CORREO_HABILITADO distinto de `true`, o configuración inválida, el trabajador no consulta ni modifica la cola. Los eventos de negocio pueden seguir quedando pendientes. El modo de prueba exige ID y destinatario coincidentes: no redirige mensajes de otra persona y no hace mantenimiento global de la cola.

## Estado actualizado: 16/oct/2026

El operador configuró Gmail SMTP (puerto 465 y TLS implícito). La prueba autorizada de la notificación 9 realizó un único intento: Gmail respondió `250 2.0.0 OK` y la cola quedó en Enviada. Esto acredita aceptación SMTP, no lectura ni recepción en bandeja. No repetir esa notificación ni reiniciar su estado.

Posteriormente el operador autorizó el modo automático general y los destinatarios efectivos de la cola: alesandromerida001@gmail.com y roblestito331@gmail.com. Se reinició el backend para cargar la configuración local ya actualizada por el operador, sin modificar secretos. Se confirmó aceptación SMTP 250 y estado Enviada en avisos procesados por el temporizador. Los registros sin dirección disponible permanecen pendientes.

Resultado de la verificación real: 13 pendientes anteriores procesados una sola vez y dos avisos nuevos (19: cita de solicitud 8; 20: pago 6) generados durante la prueba, aceptados por Gmail con 250 y persistidos como Enviada con intentos=1. La notificación 9 no se repitió. Total al cierre: 16 Enviadas, cuatro Pendientes sin correo (1, 2, 4, 17). Recepción en bandeja de estos nuevos mensajes pendiente de confirmación del operador. Suite automatizada: 95/95 aprobadas.

## Operación automática general

- CORREO_HABILITADO=true, con SMTP_SOLO_NOTIFICACION_ID y SMTP_DESTINATARIO_PRUEBA ausentes o vacíos. Reiniciar Node tras cambios de configuración; el proceso no recarga .env en caliente.
- Ejecutar el backend normalmente con npm start. Su arranque ya llama iniciarCorreos: procesa como máximo un aviso por ciclo de 30 segundos mientras el proceso esté activo. No requiere scripts manuales por evento.
- El modo general consume también pendientes antiguos. Las direcciones futuras deben ser contactos autorizados: la cola no contiene una lista de autorizaciones. Revisar cualquier nuevo contacto antes de usar datos de prueba; no introducir destinatarios ajenos.
- La aceptación SMTP se registra con ID y código de respuesta, sin contenido, dirección ni secretos. Corroborar Enviada en Notificaciones; un fallo posterior al envío puede dejar Incierta y exige revisión, nunca reinicio automático del estado.
- El envío no genera mensualidades: MENSUALIDADES_AUTOMATICAS sigue desactivado. Los cargos/mensualidades que se registren por los flujos existentes generan sus propios avisos transaccionales.
- Para Azure, proporcionar las mismas variables mediante configuración privada del servicio, asegurar conexión a SQL y salida TLS a Gmail y mantener el proceso en ejecución. El temporizador no corre si el alojamiento suspende el proceso; debe elegirse/configurarse un alojamiento que lo mantenga activo. No se realizó despliegue ni validación de infraestructura Azure. Preferir una sola instancia del procesador en esta etapa; los bloqueos SQL existentes siguen protegiendo la toma del aviso.

La sección siguiente de prueba por ID se conserva como procedimiento opcional de diagnóstico, no como requisito de operación normal.

## Referencia de configuración

En la revisión inicial el correo estaba desactivado; posteriormente se efectuó la prueba real indicada arriba. La limpieza de código no realiza envíos ni modifica `.env`.

Solicitar al proveedor: SMTP_HOST, SMTP_PORT (1–65535; por defecto 587), SMTP_SECURE (`true` para TLS implícito, habitualmente 465; `false` para STARTTLS, habitualmente 587), SMTP_USER, SMTP_PASS y SMTP_FROM autorizado. El servicio exige TLS y conserva la validación de certificados. SMTP_MESSAGE_DOMAIN debe ser un dominio apropiado para los identificadores de mensaje; no es una contraseña. No compartir credenciales en chats, capturas o registros.

## Procedimiento, solo después de autorización explícita

1. Detener otras instancias/trabajadores del proyecto. Mantener el correo desactivado mientras se revisa la cola desde Notificaciones. Elegir UNA notificación Pendiente con destinatario ya registrado y expresamente autorizado. Revisar asunto y cuerpo mediante una consulta de solo lectura autorizada antes del envío. No usar mensajes históricos sin revisar ni cambiar destinatarios para reutilizar datos de otra persona. Si no existe un evento adecuado, detener la prueba y acordar su preparación; no insertar ni reiniciar eventos a ciegas.
2. En un proceso aislado, configurar las variables SMTP mediante el mecanismo seguro del operador, sin editar `.env`. Definir **ambas** variables: SMTP_SOLO_NOTIFICACION_ID con el ID seleccionado y SMTP_DESTINATARIO_PRUEBA con su dirección exacta. Mantener MENSUALIDADES_AUTOMATICAS=`false`. No habilitar todavía correo si falta alguno de los filtros.
3. Solo con autorización de envío, establecer CORREO_HABILITADO=`true` en ese proceso e iniciar `npm start`. En el siguiente ciclo se intentará exclusivamente ese ID pendiente si coincide el destinatario. Otros eventos pendientes no se enviarán ni se actualizarán por este trabajador de prueba. Un ID ya enviado o incierto no se reenvía. No quitar filtros mientras el correo esté habilitado: el modo normal sin filtros consume la cola pendiente antigua.
4. Revisar el estado en Notificaciones y la bandeja del destinatario/proveedor. Si queda Incierta, no restablecerla ni repetir automáticamente: comprobar primero si SMTP aceptó el mensaje. Fallos SMTP o de persistencia posteriores a la aceptación no deshacen operaciones financieras.
5. Detener el proceso de prueba y retirar sus variables temporales; cualquier instancia posterior debe arrancar con CORREO_HABILITADO=`false`. Conservar el registro y su estado. La activación general del correo y el tratamiento de pendientes antiguos requieren una decisión separada del operador.

No se necesita migración SQL. El procedimiento de prueba cambia exclusivamente el estado del evento seleccionado; no requiere reiniciar ni borrar la cola.

## Verificación automatizada

`node --check backend/notificaciones-correo.js`

`node --check tests/notificaciones.test.js`

`node --test tests/notificaciones.test.js`

Las pruebas sustituyen SQL y SMTP: no certifican conectividad, permisos del proveedor, bloqueos reales de SQL Server ni entrega real.
