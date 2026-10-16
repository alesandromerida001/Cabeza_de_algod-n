# Limpieza conservadora — 16/oct/2026

## Estructura y clasificación

La estructura se conserva: backend (10 archivos), frontend (46), SQL (10) y tests (13). No se trasladaron módulos ni se cambiaron rutas.

| Grupo | Archivos | Decisión |
|---|---|---|
| Producción | backend/, frontend/, package.json, package-lock.json | Conservar; incluyen estilos, fuentes locales y sus licencias. |
| Configuración y herramientas | .env.example, .gitignore, nueva .editorconfig | Conservar; .env privado no se modificó ni se versionó. |
| Desarrollo y pruebas | tests/ completo | Conservar los 13 archivos de pruebas. |
| Esquema y migraciones | sql/001, 002, 003, 005, 007 | Conservar para instalaciones/migraciones manuales. No sustituir la revisión del esquema base existente. |
| Verificación SQL | sql/004, 006, 010 | Conservar para comprobación manual. |
| Operación controlada | sql/008_datos_demo.sql, sql/009_activar_mensualidades.sql | Conservar, pero no ejecutar como parte del arranque o despliegue. Son DEMO y activación explícita. |
| Documentación útil | FINANZAS.md, REPORTES.md, MIGRACION_CATALOGOS.md, SMTP_PRUEBA_CONTROLADA.md | Conservar; guía SMTP actualizada con el resultado real previo. |
| Documentación histórica | RADIOGRAFIA_COMPLETA_PROYECTO.md, ESTABILIDAD_CYBERDECK.md | Conservar como evidencia. Sus diagnósticos y cifras corresponden a su revisión, no necesariamente al estado actual. |
| Residuos confirmados | er.name Sergio Merida; ion inicial estable de Cabeza de Algodon | Eliminados tras respaldo: salida de estadísticas Git y ayuda del paginador less, sin referencias en código, SQL, tests, documentación ni manifiesto. |
| Dependencias instaladas | node_modules/ | Conservar localmente, excluido de Git. No tratarlo como fuente ni eliminarlo en esta tarea. |

## Respaldo y cambios previos

Antes de editar se respaldaron los dos residuos, backend/notificaciones-correo.js, tests/notificaciones.test.js, SMTP_PRUEBA_CONTROLADA.md y frontend/principal/dashboard.js en:

`C:\Users\guide\AppData\Local\Packages\sandbox.{efedb9c8-ad30-4c53-974f-05ba7986012c}\AC\Temp\asilo-limpieza-20261016-004105`

Es un respaldo temporal de los archivos afectados, no una copia integral ni un respaldo de SQL Server. No contiene .env. Los cambios SMTP y sus tres pruebas adicionales ya estaban pendientes antes de esta limpieza; se conservaron. No se creó commit ni push.

## Cambios de esta limpieza

- Corregida la indentación del bloque de mantenimiento SMTP, sin cambiar consultas, condiciones ni envío.
- Compactados espacios y saltos innecesarios del dashboard administrativo, manteniendo los mismos listeners, rutas y logout.
- Añadida .editorconfig: UTF-8, espacios, cuatro posiciones para JS/HTML/CSS/SQL y dos para JSON. No incluye .env. Es una convención para editores compatibles, no una reescritura automática de todo el repositorio.
- Actualizada la guía SMTP: aceptación Gmail previa de la notificación 9; no se efectuaron nuevos envíos durante la limpieza.
- No se hallaron archivos idénticos. No se eliminaron funciones, imports ni bloques de lógica por una sospecha de falta de uso.

## Organización y pendientes conservados

server.js concentra rutas, autenticación y residentes; Finanzas y otros módulos contienen funciones compactas. Separarlos o reformatear masivamente dificultaría revisar cambios y excedería una limpieza de bajo riesgo. Se conservan. El frontend financiero comparte controlador y mantiene páginas de entrada distintas; no son archivos idénticos y no se fusionan. Tampoco se fusionan estilos con posible solapamiento: su orden puede afectar la identidad visual.

Antes de Azure queda una revisión de despliegue separada: puerto 3000 fijo, configuración SQL/TLS de entorno, manejo privado de credenciales y decisión explícita sobre correo y mensualidades. Esta limpieza no certifica preparación completa para Azure ni cambia estas políticas. No quitar filtros SMTP con correo habilitado sin revisar la cola pendiente.

## Verificaciones

- 39 archivos JavaScript con sintaxis correcta.
- npm test: 95 aprobadas, 0 fallidas. SQL/SMTP simulados; no se validaron los siete reportes contra SQL real.
- Referencias locales src/href de todos los HTML: sin destinos inexistentes.
- Sin archivos idénticos por SHA-256 en backend/frontend/sql/tests.
- Arranque real temporal: GET / respondió HTTP 200 con HTML. Correo y mensualidades desactivados mediante variables del proceso; proceso detenido al finalizar. No se invocaron endpoints con datos.
- Sin coincidencias de los secretos actuales de .env en archivos versionados; .env excluido de Git. Esta comprobación no equivale a una auditoría exhaustiva de todo el historial Git o de secretos desconocidos.
- git diff --check sin errores de espacios. No hubo migraciones, envíos SMTP ni cambios de datos reales.
