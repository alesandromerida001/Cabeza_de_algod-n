# Estabilidad y Cyberdeck Corpo 2077

## Comprobaciones reales

- Configuración inspeccionada sin mostrar credenciales: `DB_SERVER=localhost`, sin puerto ni instancia explícitos. mssql utiliza el puerto predeterminado únicamente en ese caso.
- Windows Services: `MSSQLSERVER` en ejecución; `SQLBrowser` detenido. Registro de instancia: `MSSQL17.MSSQLSERVER`.
- TCP: puerto 1433 escuchando en IPv4 e IPv6.
- **SELECT 1 real devolvió 1** con la configuración existente. No se reprodujo el timeout original. El intento inicial dentro del aislamiento falló por restricciones de red; la comprobación autorizada fuera del aislamiento sí funcionó. No confundir ambos resultados.
- No se ejecutaron consultas de negocio, migraciones, INSERT, UPDATE o DELETE contra la base real. No se arrancó el servidor real ni sus procesos de correo/mensualidades.

No es posible atribuir retrospectivamente ETIMEOUT a un puerto equivocado, caída del servicio o consulta bloqueada sin más evidencia. `Failed to cancel request` puede aparecer después de un timeout mientras el controlador intenta cancelar una petición; no se ocultó aumentando el tiempo de cancelación.

## Cambios de estabilidad

- `backend/config/db.js`: límites explícitos de conexión y consulta de 15 segundos (los valores predeterminados anteriores), pool máximo 10, mínimo 0, adquisición 15 segundos y conexiones inactivas 30 segundos. Soporta variables opcionales `DB_PORT` o `DB_INSTANCE`, mutuamente excluyentes; no se modificó `.env` ni se cambió el destino vigente.
- `mssql.connect(dbConfig)` ya reutilizaba un único pool global. Se conserva, sin nuevos pools por endpoint ni reintentos automáticos. Listener del error global del pool para evitar eventos sin manejar.
- `backend/config/errores-db.js`: errores de conexión/timeout/cancelación devuelven HTTP 503 y un mensaje seguro. Server, Finanzas y Reportes lo reutilizan. Una escritura cuyo resultado no se confirmó debe revisarse antes de reintentar; el mensaje no afirma falsamente que se haya revertido.
- Middleware final de Express maneja errores y JSON inválido sin exponer detalles internos.
- Login usa `/api/login`, no una URL fija `http://localhost:3000`; recuperación del botón en `finally`.
- `frontend/compartido/cyberdeck.js`: progreso, límite de espera (45 segundos lecturas; 90 segundos escrituras/PDF), cancelación mediante AbortController, bloqueo de solicitudes de escritura idénticas mientras están en curso, restauración de botones y mensajes de red. Recibe también el cuerpo completo antes de liberar el bloqueo. No reintenta operaciones, no cambia payloads ni reemplaza la idempotencia del backend. Cancelar una espera en navegador **no garantiza** cancelar una transacción del servidor.
- Confirmaciones asíncronas para retirar residente, desactivar usuario y cancelar solicitud. Cancelar/Escape no ejecuta la escritura.
- Mensualidades ya seleccionaba el mes actual en Guatemala; el selector permitía meses posteriores del mismo año. Ahora se valida antes de llamar al endpoint. El backend mantiene su rechazo de futuros y las validaciones financieras intactas. Las validaciones esperadas ya no se registran como errores internos de SQL.
- Residentes tenía un modal manual sin reglas de posicionamiento y un modal Bootstrap sin su CSS. Se incorporó el CSS faltante, overlay acotado y desplazable, foco, Escape, Tab y botón accesible de cierre.

## Identidad visual

Las 17 páginas HTML existentes cargan al final `frontend/css/cyberdeck.css`, con tokens y componentes comunes, y antes de sus scripts `frontend/compartido/cyberdeck.js`.

- Fondos #26374B; paneles #344B63; modales #EDF1F5.
- Amarillo #FCEE0A para acciones principales y avisos; magenta #FF315D para errores y acciones destructivas; cian #00D9EF para información/éxito.
- Tablas, formularios, estados, menús, carga, toasts y confirmaciones coherentes; esquinas recortadas, códigos de sección, separadores técnicos, foco visible y respeto a movimiento reducido.
- IBM Plex Sans local para contenido y SemiBold para encabezados. Se comprobó la fuente Rajdhani mediante fontkit: 85 glifos presentaron discrepancias mayores de una unidad entre límites almacenados y contornos. **Se conserva el original, pero no se carga**. La alternativa IBM Plex verificada no presentó discrepancias. No se parchearon glifos ni se silenciaron advertencias de Firefox. La prueba de navegador fue Edge; comprobar también Firefox con caché limpia.
- No existen módulos independientes de Médicos/Personal: se adaptaron Usuarios, Fundación y las pantallas reales, sin crear CRUDs nuevos.

## Reportes

Se conservan los siete reportes. R02/R03 exigen residente; R02 permite fechas opcionales. R05 no muestra ni admite residente y separa donaciones de pagos familiares. Los otros reportes permiten residente opcional y requieren rango.

Solo PDF con PDFKit: tablas, fuentes incrustadas, encabezado institucional, fecha guatemalteca, filtros, totales y páginas numeradas. Se retiraron código/botón/ruta funcional XLSX, ExcelJS y su override del manifiesto/lockfile. El endpoint rechaza formatos distintos de PDF.

No se inventan motivo de ingreso, estados de realización de exámenes o administración de medicamentos. R06/R07 muestran los registros disponibles y su limitación. Detalles contables y límites en `REPORTES.md`.

## Archivos

Nuevos: `backend/config/errores-db.js`, `frontend/css/cyberdeck.css`, `frontend/compartido/cyberdeck.js`, `tests/estabilidad.test.js`, este documento; fuentes locales y licencias bajo `frontend/reportes/fuentes/` durante la actualización de Reportes.

Modificados: configuración DB, `backend/server.js`, `backend/finanzas.js`, los tres archivos backend de Reportes; los 17 HTML para integrar recursos; JS de Login, Residentes, Usuarios, Solicitudes, Finanzas y Reportes; CSS de Reportes; package/lock; documentación y pruebas relacionadas. No se cambió la autenticación, permisos, contabilidad, descuentos, registro clínico ni automatismos.

## Validación

- `npm test`: **88 pruebas aprobadas**. Incluye respuesta HTTP real en servidor de prueba local con SQL simulado desconectado; ningún dato real se lee o escribe durante tests.
- `node --check`: **38 archivos JavaScript** correctos.
- Rutas/recursos locales e IDs HTML verificados por tests; exportaciones PDF reales para los siete reportes con fixtures en memoria; contraste de totales, pagos parciales y permisos.
- Edge sin ventana: **17 páginas cargadas sin errores JavaScript**, con API simulada en HTTP 503. Comprobados recuperación de login, cancelación sin escritura, modal de Residentes y filtros R02/R05. Reportes a 390 px sin desbordamiento de página. Se generaron y revisaron capturas de escritorio/móvil y PDF renderizado. No equivale a probar todas las operaciones exitosas con SQL real.

## Operador: si vuelve a fallar SQL

1. Abrir `services.msc` y comprobar **SQL Server (MSSQLSERVER)**, o el nombre real de la instancia. No confundir SQL Server Agent con el motor. No es necesario que Agent esté iniciado para el login.
2. Abrir SQL Server Configuration Manager → SQL Server Network Configuration → Protocols for la instancia correcta → TCP/IP. Confirmar que está habilitado.
3. TCP/IP → Properties → IP Addresses: revisar IPAll, TCP Port y TCP Dynamic Ports. Contrastar con el puerto real que escucha SQL y el ERRORLOG; no asignar 1433 por suposición. Si cambia TCP/IP, el operador deberá reiniciar el servicio en una ventana segura.
4. Instancia nombrada sin puerto fijo: verificar SQL Browser/UDP 1434 o configurar un puerto TCP conocido. Para la instancia predeterminada actualmente comprobada en 1433, SQL Browser detenido no impidió SELECT 1.
5. Confirmar host y puerto desde el equipo que ejecuta Node; revisar firewall sin deshabilitarlo globalmente. Probar SSMS contra el mismo destino. No publicar credenciales ni `.env`.
6. Si conecta pero las consultas/cancelaciones expiran: revisar bloqueos, transacciones abiertas, plan de consulta y registro del motor con el administrador. Las lecturas SERIALIZABLE de reportes pueden esperar por escrituras; usar rangos pequeños y un residente para la demostración. No aumentar timeouts como sustituto de investigar.
7. Reiniciar Node después de una corrección manual de configuración. No hay nuevas migraciones que ejecutar.

## QA manual antes de presentar

1. `npm start`; login Asilo y Fundación, navegación y logout.
2. Abrir formularios reales, comprobar contraste, botones, cancelar y Escape. Probar Firefox con recarga sin caché y verificar que no solicita Rajdhani.
3. Consultar Residentes/Usuarios/Solicitudes y Fundación. Para pruebas de escritura utilizar únicamente los registros que el operador autorice; no se crearon datos de prueba automáticamente.
4. Mensualidades: mes actual por defecto, futuro rechazado con mensaje legible, período anterior con previsualización. No activar generación automática.
5. Reportes: siete opciones Asilo, cinco autorizadas Fundación; R02/R03 residente obligatorio; R05 sin residente; PDF de cada reporte. Comparar saldos con Finanzas y medir tiempos con el volumen real.
6. Verificar que SMTP y mensualidades automáticas conservan la configuración deseada antes de arrancar; esta entrega no cambió esas variables.
