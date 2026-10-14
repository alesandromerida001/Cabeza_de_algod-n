# Catálogos, tipo de personal y filtros

## Estado de la entrega

Código implementado sobre las carpetas actuales. **Los scripts SQL no se ejecutaron sobre la BD del proyecto.**
No se instalaron dependencias ni se modificaron `.env`, credenciales, configuración de conexión, hashes o datos existentes.

## Aplicación manual: orden exacto

1. Revisar los tres archivos de `sql/` y contar con un respaldo de la BD. En SSMS seleccionar explícitamente la base utilizada por el proyecto.
2. Detener Node con `Ctrl+C` en la terminal que ejecuta el servidor. No dejar una versión antigua escribiendo mientras se aplica la migración.
3. Ejecutar **`sql/001_roles.sql`**: crea Roles e inserta Administrador y Médico Fundación si no existen.
4. Ejecutar **`sql/002_especialidades.sql`**: crea Especialidades e incorpora las cinco opciones anteriores y las especialidades históricas de SolicitudesMedicas. No modifica las solicitudes.
5. Ejecutar **`sql/003_migrar_usuarios.sql`**: solo Admin → Asilo/Administrador y MedicoFundacion → Fundacion/Médico Fundación. Cualquier otro rol histórico detiene y revierte el script. No recupera cuentas eliminadas.
6. Revisar el resultado agrupado del script 003. IDs, contraseñas/hash, correo, nombres, teléfono y estado deben seguir iguales. Los estados NULL se conservan y esos usuarios siguen sin poder iniciar sesión hasta activarlos expresamente.
7. Iniciar Node desde la carpeta raíz con `npm start`.
8. Abrir `http://localhost:3000/`, recargar sin caché y cerrar sesiones anteriores. Probar primero una cuenta activa conservada con rol histórico Admin y después una con MedicoFundacion. Según el desarrollador, los IDs conservados son 13, 14, 15 y 17; no se consultaron ni verificaron sus roles/estados actuales. No usar la recomendación anterior del ID 12: esa cuenta fue eliminada manualmente.

Los scripts son transaccionales y reejecutables. No contienen DROP de tablas/columnas, borrado de usuarios ni cambios de contraseña. La columna antigua `Usuarios.rol` permanece: las nuevas altas y ediciones guardan un valor compatible con el tipo de personal, pero la autorización migrada nunca lee ese rol antiguo.

Si se vuelve a una versión antigua del código después de migrar, sus INSERT no conocen las nuevas columnas NOT NULL. Por ello **no volver a desplegar el servidor antiguo después del paso 5**. Conservar el código compatible incluido en esta entrega.

## Compatibilidad antes de aplicar SQL

- El backend detecta columnas/tablas, NOT NULL y restricciones activas/confiables; además comprueba tipos y referencias de usuarios. Si hay columnas nuevas pero falta completar la migración, responde 503 sin volver a los permisos antiguos. No consulta columnas nuevas si todavía no existen.
- Admin se interpreta como Asilo y MedicoFundacion como Fundacion. Cualquier otro rol antiguo carece de acceso.
- Login, residentes, solicitudes y visitas siguen disponibles con los dos accesos anteriores.
- GET de catálogos devuelve las opciones anteriores y `migracionPendiente: true`. Los IDs negativos de Roles son identificadores temporales, no IDs persistidos.
- Crear un rol o especialidad antes de que su catálogo esté disponible responde 503 con un mensaje explicativo.
- Antes de migrar usuarios solo se admiten los pares anteriores Asilo/Administrador y Fundacion/Médico Fundación. Los cargos independientes requieren el script 003. Roles pasa al catálogo persistido al completarse esa migración; Especialidades lo hace al ejecutar el script 002.
- La detección usa metadatos visibles para el usuario SQL de la aplicación. La comprobación de lectura con la configuración actual funcionó. Después del SQL, verificar que GET de catálogos ya no indique migración pendiente.

## Cambios funcionales

### Solicitudes y Especialidades

- Todas por defecto; filtros Pendientes, Programadas, Finalizadas y Canceladas combinados con búsqueda por residente, especialidad, motivo o enfermero. Se filtra el listado cargado, sin peticiones por cada tecla/filtro.
- Especialidad es un selector obtenido desde GET `/api/especialidades`; POST permite crearla exclusivamente a personal Asilo.
- Nombres recortados, máximo 50 caracteres, únicos; duplicado devuelve 409. Los errores SQL internos no se envían al cliente.
- La solicitud conserva su especialidad textual histórica. Al crear se valida que la opción esté disponible en el catálogo.

### Usuarios y Roles

- Tipo fijo Asilo/Fundacion y rol institucional elegido desde GET `/api/roles`. El rol NO concede permisos.
- POST `/api/roles` disponible solo para Asilo: nombres recortados de hasta 100 caracteres y duplicados 409.
- Alta/edición permiten seleccionar tipo y rol independientemente después de migrar. Contraseña vacía al editar conserva el hash; crear conserva el comportamiento de estado inicial Activo.
- Correos duplicados generan 409 y un mensaje amigable tanto al crear como al editar, incluida la restricción UNIQUE de SQL Server.
- Todos por defecto; Activos/Inactivos combinados con búsqueda. Los estados NULL históricos aparecen en Todos y pueden conservarse al editar.
- Nuevo rol y Nueva especialidad abren un modal secundario. Se oculta el principal y se restaura después; nunca se apilan ambos backdrops. Errores visibles dentro del secundario, sin perder el texto. Tras crear se actualiza el catálogo, se selecciona la opción y se preserva el formulario principal.

### Autenticación

- JWT nuevo: ID y tipo de personal, con expiración de dos horas. Se conserva bcrypt y la cookie HttpOnly, sameSite lax y configuración actual de localhost.
- `verificarToken` comprueba firma/expiración y lee estado/tipo actuales desde Usuarios. Una cuenta desactivada pierde acceso; un cambio de tipo tiene efecto en la siguiente petición, aunque su cookie anterior aún no expire.
- `soloAdmin` conserva su nombre, pero comprueba Asilo; `soloFundacion` comprueba Fundacion. No hay permisos dinámicos ni autorización por nombre del catálogo Roles.
- Las cookies anteriores con ID válido se resuelven contra la BD; se recomienda cerrar sesión y volver a entrar para recibir el JWT nuevo y la redirección apropiada.

### Residentes e interfaz

- Todos por defecto, Activos e Inactivos combinados con nombre/DPI. Se conserva el listado completo en memoria para editar, ver y abrir ficha.
- Herramientas en el contenido: título, filtros, buscador y acción de alta, tabla. Las estadísticas existentes permanecen debajo de la tabla. Salir y navegación general permanecen en el header.
- Ajustes limitados de contraste para botones primarios/secundarios, filtros, hover, focus y disabled. No se rediseñaron el tema ni los formularios médicos.

## Archivos

Modificados:

- `backend/server.js`
- `frontend/login/login.js`
- `frontend/principal/admin_dashboard.html` (etiqueta Personal del Asilo)
- `frontend/principal/dashboard.css`
- `frontend/usuarios/usuarios.html` y `usuarios.js`
- `frontend/residentes/residentes.html` y `residentes.js`
- `frontend/solicitudes/solicitudes.html` y `solicitudes.js`
- `tests/fundacion.test.js` (sesiones de prueba adaptadas)

Creados:

- `frontend/compartido/catalogos.js`
- `sql/001_roles.sql`
- `sql/002_especialidades.sql`
- `sql/003_migrar_usuarios.sql`
- `tests/catalogos.test.js`
- Este documento.

## Comandos y verificaciones

Desde la raíz del proyecto:

```powershell
npm start
node --check backend/server.js
node --test tests/fundacion.test.js tests/catalogos.test.js
```

`npm test` conserva el script provisional del proyecto; utilizar el comando `node --test` anterior.

Se verificaron sintaxis, correspondencia de IDs y rutas locales. Las pruebas automatizadas cubren compatibilidad anterior/migrada, JWT/cookies, denegaciones, usuario desactivado, correos y catálogos duplicados, validaciones y el flujo financiero existente de Fundación. Las escrituras de esas pruebas usan SQL simulado.

Las comprobaciones de navegador con datos ficticios pertenecen a la sesión anterior. En esta finalización no se inició el servidor ni se accedió a SQL Server.

**Pendiente manual:** ejecutar y verificar la migración real en SSMS; probar persistencia y login de cuentas reales después de migrar. No se afirma haber ejecutado esa migración ni haber escrito datos reales.

## Recorrido manual recomendado

1. Solicitudes: probar cada estado y búsqueda; crear especialidad, cancelar/reabrir su modal y provocar un duplicado; luego crear una solicitud usando la opción nueva.
2. Usuarios: probar Todos/Activos/Inactivos con búsqueda; crear rol; crear un usuario Asilo y otro Fundacion con cargos independientes; editar tipo/rol sin cambiar contraseña; activar/desactivar; probar correo duplicado en alta y edición.
3. Acceso: entrar con ambos tipos, comprobar sus destinos y logout. Fundación debe recibir 403 en endpoints administrativos, aun si se le asigna el cargo Administrador. Asilo mantiene acceso aunque su cargo se llame Médico.
4. Residentes: combinar nombre y DPI con los filtros; registrar, editar, ver detalle, ficha y retirar una cuenta de prueba cuando corresponda.
5. Fundación: pendientes → programar en horario existente → programadas → registrar visita. Consulta Q500/20%, laboratorio Q1,500/10%, medicamentos Q750/15% deben dar Q2,387.50 y finalizar la solicitud.

No se implementaron Finanzas, reportes, nuevos módulos de Fundación, RBAC, permisos dinámicos, correos ni CRUD de médicos/medicamentos/exámenes. La lógica médica, sus tres descuentos y horarios permanece igual.

## Respaldo y verificación manual final

Antes de aplicar SQL: en SSMS, base correcta → Tasks/Tareas → Back Up/Copia de seguridad → Full/Completa. Elegir un archivo .bak nuevo en una ubicación accesible al servicio SQL Server; no sobrescribir respaldos previos. Confirmar que finaliza correctamente y, preferiblemente, probar restauración en una base separada.

Con Node detenido, guardar localmente una referencia de IDs, estados y datos de usuarios para comparar después; no publicar hashes ni credenciales. Los scripts solo completan las dos columnas nuevas: no restauran IDs 1–12, no resecuencian identidad y no eliminan usuarios.

Tras 001 → 002 → 003, ejecutar manualmente sql/004_verificar_migracion.sql (solo SELECT). Revisar los cuatro IDs esperados, ausencia de usuarios inválidos y restricciones confiables. Roles dinámicos pueden ser distintos de los roles iniciales y no conceden permisos. Los scripts no corrigen automáticamente tablas preexistentes incompatibles. No iniciar Node si un script falla; cada script tiene su propia transacción.

Errores de crear/editar usuario se muestran dentro del modal, se conservan los campos y se evita enviar dos veces mientras el guardado está pendiente. El script 002 conserva sus cinco especialidades, UNION para duplicados históricos, UNIQUE, NOT EXISTS y transacción; no necesitó cambios.
