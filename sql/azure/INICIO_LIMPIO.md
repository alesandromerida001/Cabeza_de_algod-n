# Azure desde cero — procedimiento vigente

La decisión actual sustituye cualquier plan previo de copiar históricos o datos DEMO. No exportar BACPAC con datos ni ejecutar DATOS_DEMOSTRACION.md, el antiguo 008 ni migraciones incrementales con siembras históricas. La base local no se modifica.

## Contenido inicial autorizado

| Tabla | Filas iniciales | Motivo |
|---|---|---|
| Roles | Administrador; Médico Fundación, activos | Catálogo inicial existente. El rol no determina permisos. |
| Especialidades | Cardiología, Medicina Interna, Neurología, Geriatría, Traumatología, activas | Catálogo original; no se copian especialidades históricas locales. |
| FinanzasVersion | version=1 | El backend comprueba este marcador para habilitar Finanzas. |
| ConfiguracionMensualidades | id=1, preparado_el=fecha de ejecución en Guatemala, inicio=NULL | Inicialización nueva; no genera mensualidades ni inventa fechas de residentes. |
| Usuarios | Una cuenta real proporcionada por el operador | Administrador inicial Activo, tipo_personal=Asilo; id_rol resuelto por nombre; rol antiguo=Admin por compatibilidad. Hash bcrypt, coste 10. |

Todas las demás tablas de la aplicación quedan VACÍAS, incluidas Huespedes, FichaMedica, SolicitudesMedicas, VisitasMedicas, CuotasResidentes, CargosFamiliares, PagosFamiliares, AplicacionesPagos, AjustesMensualidades, ObligacionesFundacion, PagosFundacion, Donaciones, Gastos, NotificacionesCorreo, OperacionesFinancieras y AuditoriaContactoFinanciero. No se crea usuario Fundación ficticio; el administrador dará de alta personal real mediante la interfaz. No se copia ningún hash ni ID de la base local.

## Orden exacto de ejecución futura

1. Crear una Azure SQL Database vacía con collation Modern_Spanish_CI_AS. Configurar permisos y conectividad de manera privada. Mantener Node detenido o apuntando a otro entorno durante la inicialización.
2. Conectado al DESTINO, revisar y ejecutar `001_crear_esquema.sql`. Conserva toda la estructura de la aplicación y sus restricciones; excluye únicamente utilidades de diagramas SSMS.
3. Ejecutar `002_verificar_esquema.sql` y revisar que no existan diferencias.
4. Revisar y ejecutar `003_datos_minimos.sql`. Solo inserta los catálogos y las dos filas de configuración enumeradas arriba. Es transaccional, no actualiza registros existentes y rechaza SQL Server local y bases con usuarios. Si se repite antes del alta de usuario no duplica semillas. No omitir errores ni quitar protecciones.
5. Crear el primer administrador con `node sql/azure/crear-primer-admin.cjs`, desde la raíz del repositorio con las dependencias instaladas. Este comando NO se ejecutó durante la preparación.
6. Configurar App Service para Azure y probar login, logout, listas vacías, creación de usuarios y operaciones nuevas legítimas. Mantener `CORREO_HABILITADO=false` y `MENSUALIDADES_AUTOMATICAS=false` hasta aprobar sus activaciones por separado. No reutilizar filtros SMTP de una notificación antigua.

## Credenciales del administrador: solo en el proceso privado

El operador debe proporcionar temporalmente las siguientes variables mediante un mecanismo privado, sin escribir secretos en archivos versionados, argumentos de comandos, capturas o historial del terminal:

- AZURE_DB_SERVER, AZURE_DB_DATABASE, AZURE_DB_USER, AZURE_DB_PASSWORD: conexión privada al destino. TLS obligatorio y certificado validado. Puerto 1433.
- CONFIRMAR_BASE_AZURE: exactamente el nombre de AZURE_DB_DATABASE; el script además comprueba EngineEdition=5 y DB_NAME().
- ADMIN_NOMBRES, ADMIN_APELLIDOS, ADMIN_CORREO: datos del administrador real.
- ADMIN_PASSWORD: contraseña elegida por el operador. Para esta cuenta inicial se exige al menos 12 caracteres y un máximo de 72 bytes UTF-8 para evitar truncamiento de bcrypt. No se modifica la validación del formulario existente.

No utilizar JWT_SECRET como contraseña del usuario. No cargar .env local: el script usa exclusivamente estas variables temporales. No imprime contraseña ni hash, no inicia Express ni SMTP. Inserta mediante parámetros y una transacción serializable con bloqueo de Usuarios; dos ejecuciones concurrentes no deben crear dos primeros administradores. Si ya existe un usuario, no cambia contraseñas ni sobrescribe cuentas. Ante un fallo de conexión después del commit, comprobar existencia/login antes de repetir. El mensaje de error no expone detalles SQL privados.

Cerrar la sesión/proceso privado y eliminar sus variables temporales al finalizar. No dejar ADMIN_PASSWORD ni las credenciales privilegiadas del inicializador en App Service. La cuenta SQL usada por la aplicación se configura por separado con los permisos necesarios, sin copiar logins locales.

## Validación pendiente en destino

Después de la inicialización deben existir exactamente los catálogos iniciales, las dos filas de configuración y un usuario. Todas las tablas transaccionales deben continuar vacías. Verificar login con el administrador, acceso Asilo, logout y pantalla financiera sin movimientos. Las funcionalidades requieren operaciones nuevas desde la interfaz; no insertar transacciones ficticias para llenar pantallas.

Preparación únicamente: no se ejecutaron scripts SQL, conexiones de escritura ni altas de usuario durante esta intervención. La ejecución real en Azure y QA del primer login siguen pendientes.

## Diagnóstico antes de repetir un alta fallida

`node sql/azure/crear-primer-admin.cjs --verificar` usa solamente AZURE_DB_SERVER, AZURE_DB_DATABASE, AZURE_DB_USER, AZURE_DB_PASSWORD y CONFIRMAR_BASE_AZURE. Comprueba el destino, muestra cantidad de usuarios y roles Administrador activos, y metadatos de Usuarios/Roles. No lee nombres/correos/hash de usuarios, no calcula contraseñas y no escribe. Deben resultar cero usuarios y un rol activo antes de solicitar un alta nueva. Si hay usuarios, revisar login/cuenta mediante el operador, nunca borrar para repetir.

El script ahora diferencia causas conocidas de validación, conexión, autenticación, permisos, longitud, FK/CHECK y duplicados mediante mensajes controlados y números SQL; nunca muestra error.message de SQL, contraseñas ni hashes. La tabla mostrada en --verificar debe contrastarse con 001_crear_esquema.sql: no se ha verificado Azure desde esta sesión porque las credenciales temporales pertenecen al operador. La compatibilidad del INSERT se comprobó contra el esquema guardado, no contra una conexión real nueva.
