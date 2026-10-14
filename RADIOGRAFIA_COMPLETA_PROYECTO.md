# Radiografía completa — Asilo Cabeza de Algodón

Fecha de corte: **13/oct/2026**, America/Guatemala. Auditoría técnica y funcional del código local.

## Criterio de evidencia y límites

Este documento describe los archivos presentes, no una arquitectura ideal ni una reconstrucción de conversaciones. Se inspeccionaron backend, frontend, consultas, scripts SQL, manifiesto, pruebas y documentación. Se ejecutaron `npm test` y comprobaciones `node --check`. No se inició `backend/server.js`, no se conectó a SQL Server, no se ejecutó SQL, no se envió correo ni se modificó configuración o código.

La única creación autorizada de esta auditoría es este Markdown. Las menciones a `.env` se limitan al nombre de base y al estado de indicadores; no se reproducen credenciales, direcciones de correo privadas ni secretos. Las referencias de líneas son orientativas para esta versión; las funciones y rutas son el identificador principal.

**Resultado cuantitativo:** 10 áreas funcionales documentadas, 17 páginas HTML, 46 contratos de endpoint HTTP, 12 archivos de pruebas y **88 pruebas ejecutadas: 88 aprobadas, 0 fallos**. Los siete códigos de reporte comparten una ruta parametrizada; no se cuentan como siete endpoints distintos. Los recursos estáticos no se incluyen en los 46.

Áreas consideradas: acceso y usuarios; catálogos; residentes y ficha administrativa; solicitudes/citas; registro y consulta de visitas; portal Fundación/ficha de consulta; cuentas familiares/mensualidades/pagos; tesorería/obligaciones/donaciones/gastos; reportes; notificaciones. El diseño compartido se documenta como infraestructura transversal.

Una función puede estar **IMPLEMENTADA** en código y probada con mocks, pero su operación contra la instalación real seguir **NO VERIFICADA**. Esta distinción se conserva en todo el informe.

## 1. Información general

### 1.1 Objetivo y alcance observados

Aplicación web institucional para administrar residentes y usuarios del Asilo, coordinar solicitudes y atenciones con Fundación, registrar importes médicos, gestionar cuentas familiares y obligaciones con Fundación, registrar efectivo recibido/desembolsado, consultar reportes PDF y preparar avisos por correo.

No es un expediente clínico normalizado por procedimiento o medicamento, un sistema de inventario, una contabilidad de partida doble, una plataforma bancaria ni un sistema de permisos configurables por cargo. No se encontró despliegue Azure implementado en los archivos de aplicación inspeccionados.

### 1.2 Arquitectura y arranque

- Backend Node.js CommonJS, Express 5 y consultas SQL explícitas mediante `mssql`; no hay ORM.
- `backend/server.js` es el punto de entrada. Carga dotenv, JSON, CORS, cookie-parser, sirve `frontend` con `express.static`, monta Finanzas/Reportes y define usuarios, residentes y flujo médico.
- Puerto **3000 fijo** en `server.js`; no se toma de una variable `PORT`.
- `npm start` ejecuta `node backend/server.js`. No ejecuta migraciones. En el callback de escucha inicia los temporizadores de correo y mensualidades según sus controles internos.
- Frontend multipágina HTML/CSS/JavaScript directo, sin React/Vue ni proceso de compilación. `http://localhost:3000/` sirve `frontend/index.html`; `login/login.js` consume `/api/login`.
- Bootstrap **5.3.3** se carga desde CDN en pantallas con sus componentes. Las fuentes utilizadas son locales. No toda la interfaz depende exclusivamente de Bootstrap: Residentes combina un modal propio y otro Bootstrap.
- La API usa JSON y rutas relativas al mismo origen. No se encontró una API versionada, OpenAPI ni un generador de clientes.
- Los módulos de cálculo exportan funciones; `finanzas.js` y `reportes.js` reciben `app`, SQL y middleware por parámetros. `server.js` no está separado en capas controller/service/repository.

### 1.3 Dependencias declaradas

Fuente: `package.json`, versión del proyecto `1.0.0`, licencia declarada `ISC`, descripción vacía. Rangos declarados, no equivalentes a verificar cada versión instalada:

| Paquete | Rango | Uso observado |
|---|---|---|
| bcrypt | ^6.0.0 | Hash y comparación de contraseñas |
| cookie-parser | ^1.4.7 | Lectura de cookie JWT |
| cors | ^2.8.6 | Middleware CORS sin opciones particulares |
| dotenv | ^18.0.4 | Variables de configuración |
| express | ^5.2.1 | HTTP y archivos estáticos |
| jsonwebtoken | ^9.0.3 | Firma/verificación JWT |
| mssql | ^12.7.0 | Pool, parámetros y transacciones SQL Server |
| nodemailer | ^10.0.16 | Transporte SMTP desde la cola |
| pdfkit | ^0.20.2 | Exportación PDF |

`package-lock.json` existe. No hay dependencias de Excel/XLSX declaradas ni `devDependencies` en el manifiesto. Las pruebas utilizan módulos nativos de Node, no Jest/Mocha. No se hizo instalación, actualización ni auditoría en línea de paquetes en esta intervención.

### 1.4 Árbol funcional real

```text
backend/
  server.js
  config/{db.js,errores-db.js}
  finanzas.js, finanzas-calculos.js, mensualidades.js
  notificaciones-correo.js
  reportes.js, reportes-calculos.js, reportes-exportar.js
frontend/
  index.html
  login/login.js
  css/{styles.css,cyberdeck.css}
  compartido/{utils.js,formatos.js,catalogos.js,cyberdeck.js}
  principal/{admin_dashboard.html,dashboard.js,dashboard.css}
  usuarios/{usuarios.html,usuarios.js}
  residentes/{residentes.html,residentes.js}
  solicitudes/{solicitudes.html,solicitudes.js,solicitudes.css}
  fundacion/
    fundacion_dashboard.html, fundacion_dashboard.js
    solicitudes_fundacion.html, solicitudes_fundacion.js
    visitas_realizadas.html, visitas_realizadas.js, visitas_realizadas.css
    fichas_medicas.html, fichas_medicas.js, fichas_medicas.css
    detalle_visita.js
  finanzas/
    finanzas.html, cuentas.html, mensualidades.html, fundacion.html
    donaciones.html, gastos.html, notificaciones.html
    finanzas.js, finanzas.css
  reportes/{reportes.html,reportes.js,reportes.css,fuentes/}
sql/001_roles.sql ... 010_verificar_mensualidades.sql
tests/ (12 archivos *.test.js)
package.json, package-lock.json, .env, .env.example
MIGRACION_CATALOGOS.md, FINANZAS.md, REPORTES.md, ESTABILIDAD_CYBERDECK.md
```

No existe la antigua agrupación `frontend/dashboards` en el inventario actual. Los nombres de archivos conservan palabras como `admin_dashboard`, aunque la autorización actual usa `tipo_personal`.

## 2. Base de datos

### 2.1 Configuración visible y alcance de verificación

El archivo local `.env` declara **DB_DATABASE=CabezaDeAlgodon**. `backend/config/db.js` toma `DB_USER`, `DB_PASSWORD`, `DB_SERVER` y `DB_DATABASE`; no contiene credenciales literales. No se comprobó el destino efectivo de un proceso ya arrancado ni si variables externas sustituyen el archivo.

Configuración en código: `connectionTimeout=15000`, `requestTimeout=15000`, pool máximo 10/mínimo 0, inactividad 30000 ms, adquisición 15000 ms. `encrypt:false` y `trustServerCertificate:true`. `DB_PORT` opcional admite enteros 1–65535; `DB_INSTANCE` es alternativa mutuamente excluyente. `mssql.connect` reutiliza el pool global. El listener de error registra código/nombre.

**NO VERIFICADO:** existencia actual de tablas, tipos reales, restricciones, índices, collation, disparadores, permisos del usuario SQL, datos, versión del motor y ejecución histórica de migraciones. Los documentos anteriores contienen resultados de inspecciones previas, pero no constituyen una consulta actual. No hay script completo de creación de las cinco tablas base clínicas/usuarios en el inventario SQL actual.

### 2.2 Diccionario de las 21 tablas identificadas

“Base” significa inferida de consultas y referencias, sin DDL completo reproducible en los scripts presentes. “Script” significa definida explícitamente, no que se haya verificado su existencia en el servidor.

| Tabla | Columnas relevantes / claves | Evidencia y relación |
|---|---|---|
| Usuarios | id_usuario, nombres, apellidos, correo, telefono, contrasena, rol, estado; tipo_personal, id_rol tras 003 | Base + 003. id_usuario usado como PK/FK; hash bcrypt. FK Usuarios→Roles explícita en 003 |
| Roles | id_rol INT IDENTITY PK; nombre VARCHAR(100) UNIQUE; estado | 001; CHECK Activo/Inactivo y nombre no vacío |
| Especialidades | id_especialidad INT IDENTITY PK; nombre VARCHAR(50) UNIQUE; estado | 002. No hay FK desde solicitudes: se almacena el nombre |
| Huespedes | id_residente, nombres, apellidos, dpi, fecha_nacimiento, genero, tipo_sangre, alergias, requiere_asistencia_especial, descripcion_asistencia, nombre_responsable, parentesco, telefono_emergencia, cuota_mensual, estado, fecha_registro | Base. DPI único esperado por manejo de errores, no DDL base verificable. R02 también consulta diagnostico |
| Huespedes: ampliaciones | correo_responsable VARCHAR(254) NULL; fecha_ingreso y fecha_retiro DATE NULL | 005 y 007; CHECK de estancia: retiro requiere ingreso y no puede ser anterior |
| FichaMedica | id_residente, psicopatologias, padecimientos, medicamentos_habituales, antecedentes, observaciones, fecha_actualizacion | Base; JOIN/MERGE por id_residente. El código pretende una ficha por residente; no se certifica UNIQUE real |
| SolicitudesMedicas | id_solicitud, id_residente, motivo, especialidad, enfermero, fecha_solicitud, estado, medico, fecha_cita, hora_cita | Base; JOIN a Huespedes. Hora tratada como SQL TIME. Alta omite fecha/estado, dependiendo de defaults previos |
| VisitasMedicas | id_visita, id_solicitud, fecha_visita, diagnostico, examenes, resultados_examenes, costo_examenes, medicamentos, cantidad_medicamentos, indicaciones, costo_medicamentos, costo_consulta, subtotal, porcentaje_descuento, descuento_consulta_porcentaje, descuento_examenes_porcentaje, descuento_medicamentos_porcentaje, descuento, total, observaciones | Base; una visita por solicitud esperada. El catch menciona UQ_VisitasMedicas_Solicitud, no hay DDL clínico creador en 001–010 |
| CargosFamiliares | id_cargo IDENTITY PK; id_residente FK; id_visita FK nullable; tipo, periodo CHAR(7), fecha DATE, concepto NVARCHAR(300), monto DECIMAL(12,2), creado_por FK, creado_en UTC | 005. Tipos Mensualidad/Medico/Manual, monto≥0 y coherencia tipo/período/visita |
| PagosFamiliares | id_pago IDENTITY PK; id_residente FK; fecha, monto DECIMAL(12,2)>0, metodo, referencia, observaciones, creado_por FK, creado_en | 005. No “tipo Abono” ni columna modalidad: modalidad nueva queda en comprobante JSON |
| AplicacionesPagos | id_aplicacion IDENTITY PK; id_pago FK; id_cargo FK; monto>0; UNIQUE(id_pago,id_cargo) | 005. Une pagos y cargos; suma y pertenencia al mismo residente se validan en backend |
| ObligacionesFundacion | id_obligacion IDENTITY PK; id_visita FK UNIQUE; monto≥0, regla, creado_por FK, creado_en | 005. Regla por defecto «Neto visita: provisional» |
| PagosFundacion | id_pago_fundacion IDENTITY PK; id_obligacion FK; fecha, monto>0, metodo, referencia, observaciones, creado_por FK, creado_en | 005. Varios pagos por obligación |
| Donaciones | id_donacion IDENTITY PK; donante, tipo_donante, fecha, monto>0, descripcion, referencia, estado, motivo_anulacion, anulado_por FK, anulado_en, creado_por FK, creado_en | 005. Confirmada/Anulada; CHECK exige datos de anulación coherentes |
| Gastos | id_gasto IDENTITY PK; categoria, concepto, fecha, monto>0, beneficiario, referencia, observaciones, estado y campos de anulación/creación | 005. Confirmado/Anulado; FK a Usuarios para autores |
| OperacionesFinancieras | clave UNIQUEIDENTIFIER PK; tipo, id_usuario FK, huella CHAR(64), resultado NVARCHAR(MAX), creado_en | 005. Idempotencia y resultado JSON de operación |
| NotificacionesCorreo | id_notificacion IDENTITY PK; evento, id_evento, id_residente FK, destinatario, asunto, cuerpo, estado, intentos, creado_en, ultimo_intento, enviado_en, error | 005. UNIQUE(evento,id_evento); id_evento es referencia polimórfica, no FK por cada tabla |
| AuditoriaContactoFinanciero | id_cambio IDENTITY PK; id_residente FK; correo_anterior, correo_nuevo, creado_por FK, creado_en | 005; historial del contacto financiero |
| FinanzasVersion | version INT PK CHECK(version=1) | 005; marcador de instalación del esquema financiero |
| ConfiguracionMensualidades | id INT PK CHECK(id=1), preparado_el DATE, inicio DATE nullable | 007; inicio debe ser primer día de mes no anterior al de preparación |
| CuotasResidentes | id_cuota IDENTITY PK; id_residente FK; desde DATE primer día de mes; monto DECIMAL(10,2)≥0; creado_por FK; creado_en | 007. Se conservan revisiones del mismo período, prevalece último id_cuota |
| AjustesMensualidades | id_ajuste IDENTITY PK; id_cargo FK; importe_anterior, importe_nuevo DECIMAL(12,2)≥0; motivo obligatorio; creado_por FK obligatorio; creado_en | 007. Importes anterior/nuevo deben ser distintos |

Los autores financieros opcionales admiten NULL para operaciones automáticas; los ajustes requieren usuario. Las FK observadas no declaran borrado en cascada. El alcance de las FK originales de Ficha/Solicitudes/Visitas depende del esquema base no incluido.

### 2.3 Relaciones y datos normalizados

```text
Roles 1 ── N Usuarios
Huespedes 1 ── ficha actual FichaMedica (cardinalidad pretendida)
Huespedes 1 ── N SolicitudesMedicas ── visita VisitasMedicas (una por solicitud pretendida)
Huespedes 1 ── N CargosFamiliares / PagosFamiliares / CuotasResidentes
PagosFamiliares N ── AplicacionesPagos ── N CargosFamiliares
VisitasMedicas ── cargo médico y obligación (únicos por visita en 005)
ObligacionesFundacion 1 ── N PagosFundacion
CargosFamiliares 1 ── N AjustesMensualidades
```

Roles y Especialidades sí son catálogos propios. Los tipos de personal, categorías de gasto y tipos de donante son listas cerradas en código/CHECK, no catálogos administrables. Especialidad queda como texto validado contra catálogo al crear la solicitud: cambiar el catálogo no reescribe históricos.

**Texto libre:** médico, enfermero, motivo de solicitud, diagnóstico, exámenes, resultados, medicamentos, cantidad de medicamentos, indicaciones, antecedentes, alergias y observaciones. No existen tablas de médicos/enfermeros/exámenes/medicamentos/dosis/inventario ni estados estructurados de realización o administración. Métodos financieros son texto con selector UI, no una tabla; backend valida longitud/no vacío, no pertenencia a las opciones del selector.

**Calculado al consultar:** edades, contadores, saldos, aplicaciones agregadas, estados de obligación, resumen de efectivo, algunos conceptos históricos y resultados de reportes. **Calculado y persistido:** subtotal/descuento/total oficial de visita; importe de cargo/obligación; aplicaciones monetarias; comprobante de operación; mensajes de correo. Reportes no persiste un nuevo libro contable.

### 2.4 Scripts, dependencias y riesgos

| Archivo | Comportamiento real | Dependencia / precaución |
|---|---|---|
| 001_roles.sql | Crea Roles si falta; semillas Administrador y Médico Fundación; transacción | No inserta Personal del Asilo. No elimina roles existentes |
| 002_especialidades.sql | Crea catálogo, cinco semillas y nombres históricos distintos de SolicitudesMedicas | Requiere tabla clínica previa; no altera solicitudes |
| 003_migrar_usuarios.sql | Agrega tipo_personal/id_rol, completa vacíos, valida, NOT NULL, CHECK y FK confiables | Requiere 001 y Usuarios. Admin→Asilo/Administrador; MedicoFundacion→Fundacion/Médico Fundación. Otro rol detiene todo. Mantiene hashes/IDs/estado/columna rol |
| 004_verificar_migracion.sql | SELECT de columnas, FK, CHECK, catálogos y usuarios | Contiene una lista histórica de IDs esperados; no es regla permanente de negocio ni lista actual certificada |
| 005_finanzas.sql | Crea 11 tablas financieras, correo del responsable, índices y versión | Requiere tablas base y Usuarios. Rechaza homónimas financieras sin versión. No convierte visitas históricas |
| 006_verificar_finanzas.sql | SELECT de duplicados, sumas, vínculos, sobrepagos, avisos y visitas sin cargo/obligación | No corrige inconsistencias |
| 007_mensualidades.sql | Fechas de estancia, configuración, cuotas y ajustes; semilla cuota actual desde mes de ejecución | No inventa fechas pasadas. No activa automatización. Cuotas antiguas previas a esa semilla quedan sin historia verificable |
| 008_datos_demo.sql | **Descartado**: THROW incondicional al inicio y RETURN; cuerpo histórico conservado | No debe usarse para cargar QA. No es una migración pendiente |
| 009_activar_mensualidades.sql | Activación manual de inicio bajo bloqueo | Por defecto autorización=0/inicio=NULL: se detiene. Requiere fechas verificadas; no genera cargos por sí mismo |
| 010_verificar_mensualidades.sql | SELECT de configuración, estancias, duplicados, cadena de ajustes y saldos | Revisión posterior a 007; no depende de datos DEMO |

Orden conceptual para una instalación que aún no tenga ampliaciones: esquema base revisado → 001/002 → 003 → verificación 004 → 005 → 006 → 007 → 010. 009 es opcional, posterior a QA; **no ejecutar 008**. Esta auditoría no recomienda repetir migraciones sobre una instalación ya migrada sin comprobar antes el estado.

El código nuevo requiere las tres columnas de descuento en VisitasMedicas y conserva también `porcentaje_descuento`. No existe aquí un script independiente que reconstruya toda esa evolución clínica. R02 requiere además `Huespedes.diagnostico` y `fecha_ingreso`; no se encontró alta/edición de `diagnostico` de Huespedes en el formulario actual, aunque sí del diagnóstico de visita. Esa dependencia merece comprobación de esquema.

No hay procedimientos de negocio personalizados identificados. Sí se usa **sys.sp_getapplock** para exclusión transaccional y **sys.sp_executesql** en migración 003; son procedimientos del sistema. SQL usa JSON_VALUE/TRY_CONVERT, OUTER APPLY, MERGE y funciones de fecha; compatibilidad de motor/collation debe probarse en la instalación destino.

## 3. Autenticación, usuarios y permisos

### 3.1 Login y sesión

`server.js:226`, POST `/api/login`: valida correo no vacío de hasta 100 y contraseña no vacía; consulta parametrizada de usuario **Activo**; bcrypt.compare contra `contrasena`. Error de credenciales devuelve 401 sin distinguir correo/contraseña. Si el tipo no está reconocido devuelve 403.

Firma JWT con `{id,tipo_personal}`, `JWT_SECRET` y expiración **2 horas**. Cookie `token`: HttpOnly, SameSite=lax, Secure=false, maxAge=2h. No hay express-session, sesión persistida en tabla, refresh token ni almacenamiento del JWT en localStorage en este flujo. La interfaz redirige después del éxito a principal o Fundación según tipo.

`verificarToken` (`server.js:122`) verifica firma/expiración e ID entero positivo. Después consulta esquema y vuelve a cargar usuario/estado/tipo desde BD en **cada petición protegida**. Un cambio de estado o ámbito surte efecto en la próxima petición aunque el JWT anterior siga vigente. Token ausente/incorrecto o usuario inactivo/eliminado →401. Error al verificar disponibilidad →503.

Logout borra la cookie; no mantiene una lista de tokens revocados. Un token copiado podría seguir siendo válido hasta expirar si el usuario sigue activo; la cookie del navegador sí se elimina. No se encontró recuperación de contraseña, MFA, cierre de todas las sesiones ni revocación por cambio de contraseña.

### 3.2 Ámbitos y cargos institucionales

- `soloAdmin` conserva nombre histórico pero autoriza **tipo_personal='Asilo'**.
- `soloFundacion` autoriza **tipo_personal='Fundacion'**.
- El nombre dinámico del Rol no otorga ni restringe permisos. Cualquier usuario activo de Asilo tiene todas las operaciones administrativas previstas, incluido gestionar otros usuarios.
- El catálogo puede marcar estado, pero no hay endpoints de editar/desactivar Roles/Especialidades en esta etapa. El middleware no usa el estado del Rol para denegar acceso al usuario; crear/editar sí exige seleccionar rol activo.
- Compatibilidad antigua estricta: solo Admin y MedicoFundacion se traducen, con IDs virtuales -1/-2. No hay acceso administrativo automático para roles desconocidos.
- `obtenerEsquema` comprueba columnas NOT NULL, existencia/campos de Roles, CHECK/FK habilitados y confiables, y ausencia de usuarios con referencias inválidas. Una migración parcial bloquea. Comprueba nombres y estado de restricciones, no equivalencia completa de toda su definición.
- `guardarUsuario` continúa escribiendo `rol='Admin'/'MedicoFundacion'` según ámbito para compatibilidad; el cargo dinámico se guarda en `id_rol`. Eliminar físicamente `rol` hoy rompería esas escrituras.

### 3.3 Matriz de autorización

| Capacidad | Asilo | Fundación |
|---|---|---|
| Usuarios: listar, crear, editar, activar/desactivar | Sí | No |
| Roles/Especialidades: consultar | Sí | Sí |
| Roles/Especialidades: crear | Sí | No |
| Residentes: alta/edición/listado administrativo/retiro | Sí | No |
| Búsqueda clínica mínima y ficha individual específica | No por esas rutas; usa listado administrativo | Sí, lectura |
| Solicitudes: listar | Sí | Sí |
| Solicitudes: crear/cancelar pendiente | Sí | No |
| Programar solicitud / registrar visita | No | Sí |
| Visitas realizadas: consultar | Sí | Sí |
| Cuentas familiares, cargos, pagos, mensualidades, ajustes | Sí | No |
| Obligaciones/pagos Fundación: consultar | Sí | Sí |
| Registrar pago a Fundación | Sí | No |
| Donaciones, gastos, resumen, notificaciones | Sí | No |
| R01/R02/R04/R06/R07 | Sí | Sí |
| R03/R05 | Sí | No |

No hay restricción por médico propietario ni asignación de residentes a un usuario de Fundación. Su ámbito consulta la información que exponen esas rutas para todos los residentes pertinentes. Las páginas HTML son estáticas públicas; la protección efectiva de datos está en la API.

### 3.4 Gestión de usuarios

`guardarUsuario` (`server.js:959`) valida nombres/apellidos/correo, teléfono hasta 20, ámbitos fijos, rol y estado. Nueva contraseña mínima 8 caracteres; bcrypt.hash con coste 10. En edición, vacía conserva hash. La API no devuelve hashes en listado. Correo duplicado se comprueba antes y errores 2601/2627 se convierten en HTTP409.

Alta siempre Activo; edición admite Activo/Inactivo y NULL para compatibilidad histórica. DELETE hace baja lógica. Activar desde frontend usa PUT con datos actuales y contraseña vacía. No hay protección específica contra desactivar la propia cuenta o la última cuenta Asilo: es un pendiente operativo, no un RBAC faltante que deba inventarse.

`usuarios.js` usa textContent, búsqueda combinada con Todos/Activos/Inactivos, modal de alta/edición, selector de ámbito y catálogo. El error queda dentro del modal conservando entradas. `catalogos.js` oculta el modal padre, espera eventos Bootstrap y abre el secundario; al cerrar lo restaura, sin dos backdrops simultáneos.

## 4. Módulo de residentes

### 4.1 Alta, edición y consulta

`POST /api/huespedes` crea Huespedes y FichaMedica en una transacción. Con esquema mensual disponible registra cuota desde el mes actual y fecha de ingreso actual si estaba vacía. No crea automáticamente una mensualidad durante el alta: eso corresponde a generación manual o proceso automático habilitado.

Formulario: nombres, apellidos, DPI, nacimiento, género, sangre, alergias, asistencia y descripción, responsable, parentesco, teléfono, cuota, psicopatologías, padecimientos, medicamentos habituales, antecedentes y observaciones. La API usa parámetros tipados; no tiene validación exhaustiva de cada campo comparable a `guardarUsuario`. Parte de la validación depende del HTML (`required`, min/step, maxlength), tipos SQL y restricciones base.

GET devuelve todos los residentes con LEFT JOIN a ficha; orden por estado, apellidos y nombres. Frontend conserva `listaResidentes`, muestra Ver, Ficha médica, Modificar y Retirar para activos. Ver reutiliza el formulario en solo lectura; no descarga un nuevo expediente por ID.

PUT actualiza datos del residente y hace MERGE de FichaMedica: actualiza la ficha o la crea si no existe, con fecha_actualizacion=GETDATE() en actualización. Cambio de cuota se registra antes del UPDATE en la misma transacción para detectar diferencia. No hay versionado completo del expediente ni auditoría clínica de cada cambio.

### 4.2 Retiro y estado

DELETE es retiro lógico, no borrado. `finanzas.retirarResidente` usa transacción/bloqueo común. Si 007 existe, registra fecha_retiro actual únicamente al retirar un Activo con fecha_ingreso conocida; si ingreso no está verificado conserva retiro previo/NULL. Sin 007 solo cambia estado. No se encontró interfaz de reingreso/reactivación del residente ni edición de fechas históricas de estancia.

No se cancela automáticamente una cita pendiente/programada ni se borran deudas al retirar. Las solicitudes nuevas requieren Activo; las operaciones sobre solicitudes ya existentes se rigen por el estado de la solicitud, no por un nuevo chequeo general del estado del residente.

### 4.3 Búsqueda, filtros y contadores

`aplicarFiltrosResidentes` combina nombre/apellido o DPI con estado; búsqueda local, sin nueva consulta por pulsación. Tres contadores en `actualizarEstadisticas` (`residentes.js:120`): longitud total, Activo e Inactivo. Se actualizan desde la lista completa cargada, no desde filas filtradas. No existe paginación del backend ni del listado actual. Un estado NULL no cuenta como Activo ni Inactivo, pero sí en Todos.

Orden visual: título/Volver → contadores → filtros → búsqueda/Nuevo → tabla. Tabla incluye nombre, DPI, nacimiento, responsable, cuota, estado y acciones.

### 4.4 Ficha médica administrativa y limitación comprobada

El modal de ficha presenta datos mediante textContent y “No registrado” para ausencias. **Su sección Historial de visitas médicas contiene un párrafo fijo que dice que todavía no existen visitas** (`residentes.html`, sección modalFichaMedica). `verFichaMedica` no consulta visitas ni sustituye ese párrafo. Por tanto, este modal no implementa historial real y puede dar información engañosa cuando sí existen visitas. El historial de Fundación y Visitas realizadas sí usa `/api/visitas`; no confundirlos.

Relaciones: ficha automática, solicitudes por residente, visitas vía solicitud, cuenta familiar, cuotas y correo financiero. No hay módulo independiente para familiares; sus datos se almacenan en Huespedes.

## 5. Módulo médico

### 5.1 Solicitud

Asilo crea solicitud con residente activo, motivo, especialidad del catálogo y enfermero como texto. No asigna un usuario enfermero por FK. Estado/fecha inicial dependen de defaults de la tabla base; el código espera **Pendiente**. Se consulta el catálogo activo cuando existe, o cinco especialidades compatibles antes de migración.

Listado compartido Asilo/Fundación: JOIN con nombres/apellidos, datos de solicitud, médico y cita. Hora se entrega `HH:mm` con `CONVERT(VARCHAR(5),s.hora_cita,108)`. Asilo tiene Todas por defecto, Pendientes, Programadas, Finalizadas y Canceladas, combinadas con búsqueda local. Resúmenes de Pendientes/Programadas/Finalizadas se calculan sobre todas las solicitudes cargadas. Ver usa los datos disponibles; cancelar requiere confirmación.

### 5.2 Estados y programación

```text
Alta Asilo → Pendiente ──programar Fundación──→ Programada ──registrar visita──→ Finalizada
                  └────cancelar Asilo───────→ Cancelada
```

La cancelación solo acepta **Pendiente**, no Programada. No se encontraron rutas de reprogramación, reapertura o edición de visita finalizada. Programar actualiza únicamente una fila Pendiente; si no existe o cambió de estado devuelve error sin programar.

Campos: `medico` texto hasta 150, fecha ISO válida y uno de **09:00, 09:45, 10:30, 11:15, 12:00, 12:45, 14:00, 14:45, 15:30, 16:15, 17:00**. Frontend los muestra con AM/PM. Backend recibe VARCHAR(5) y hace CAST a TIME, evitando convertir una hora a Date de JavaScript.

No hay catálogo independiente de especialistas, agenda por profesional ni comprobación de choque de dos citas para el mismo médico/hora. Tampoco se encontró una prohibición backend de fecha de cita pasada; la validación es de formato/calendario. Son límites del flujo observado, no garantía de agenda clínica completa.

Programación y aviso de cita ocurren en una transacción. Si Finanzas está completamente ausente, se conserva compatibilidad clínica sin aviso; un esquema parcial detectado no se ignora.

### 5.3 Registro clínico y descuentos

Solo Fundación registra visita de solicitud Programada. Diagnóstico obligatorio, ID entero positivo, campos opcionales limitados por longitud. Exámenes/resultados, medicamentos/cantidad/indicaciones son campos de texto, sin filas por ítem ni estados de realización/administración.

Costos de consulta/exámenes/medicamentos: números finitos entre 0 y 99,999,999.99; subtotal también debe caber en ese máximo. Tres descuentos **independientes y configurables**, cada uno 0–100. El modal inicia costos vacíos y descuentos sugeridos 20; ese valor no es una regla fija. Envía números, no cadenas `Q 1,250.00`.

Algoritmo oficial (`server.js:1740` aproximadamente):

```text
costoCentavos[i] = round((costo[i] + EPSILON) * 100)
porcentajeCentesimas[i] = round((porcentaje[i] + EPSILON) * 100)
descuentoCentavos[i] = round(costoCentavos[i] * porcentajeCentesimas[i] / 10000)
subtotal = suma(costoCentavos) / 100
descuento = suma(descuentoCentavos) / 100
total = (suma(costosCentavos) - suma(descuentosCentavos)) / 100
```

Redondea cada rubro antes de sumar, no aplica un porcentaje único al subtotal. Ignora totales enviados por navegador. Persiste tres porcentajes, costos y totales oficiales; escribe **0** en `porcentaje_descuento` antiguo solo por compatibilidad.

### 5.4 Atomicidad, consulta e historial

POST visita abre transacción, adquiere bloqueo financiero si disponible, lee solicitud con UPDLOCK/HOLDLOCK, inserta visita, cambia Programada→Finalizada y verifica una fila afectada. Después `finanzas.registrarVisita` crea cargo y obligación con el **total guardado** y encola aviso de cargo, antes de COMMIT. Cualquier fallo revierte el conjunto. El esquema base espera UNIQUE de solicitud para impedir dos visitas; los bloqueos y cambio de estado también impiden repetir normalmente la operación.

GET `/api/visitas` une VisitasMedicas, SolicitudesMedicas y Huespedes; permite `id_residente` opcional validado; orden fecha_visita/ID descendente. Entrega todos los datos clínicos y económicos guardados. La pantalla de Visitas realizadas permite búsqueda por nombre/apellido, médico y especialidad, y rango de fechas combinado. Contadores globales: número de visitas, residentes distintos por ID y visitas del mes Guatemala. Modal amplio de lectura usa `detalle_visita.js`, textContent y “No registrado”. No ofrece edición.

No se recalculan visitas históricas al mostrar, generar cargos antiguos o exportar reportes. Fecha_visita se omite del INSERT, por lo que su asignación depende del default previo SQL; no es una fecha libre capturada en el registro actual.

## 6. Módulo de Fundación

Dashboard ofrece solicitudes pendientes/programadas, Visitas realizadas, Fichas Médicas, Cobros pendientes del Asilo y Centro de Reportes. Los botones de solicitudes cambian el estado inicial de la misma pantalla, no crean módulos separados.

Solicitudes recibidas reutiliza GET compartido; Fundación programa y registra visita, pero no crea/cancela solicitudes mediante las rutas administrativas. El médico asignado es texto, no identidad del usuario conectado. No se verifica licencia, pertenencia a especialidad ni disponibilidad del profesional.

Fichas Médicas implementa búsqueda mínima desde 2 caracteres, TOP20, nombre/DPI; al seleccionar consulta ficha individual e historial `/api/visitas?id_residente=...`. Debounce, AbortController y versiones de consulta evitan que respuestas tardías mezclen residentes. Calcula edad, presenta ausencia de ficha/historial y abre detalle de visita. No entrega responsable, cuota ni correo familiar desde la ruta de ficha. No modifica clínica.

Finanzas de Fundación presenta **Cobros pendientes del Asilo**, total adeudado, pagos recibidos, obligaciones pendientes/pagadas, filas por residente/atención con importe original/abonos/saldo/estado e historial de pagos. `puedePagar` lo determina el servidor según ámbito, no el parámetro visual `origen`. Fundación no puede registrar pagos ni consultar cuentas familiares, resumen administrativo, donaciones, gastos o cola de correo. Sí recibe los datos de costo/porcentajes de las visitas asociados a obligaciones en la ruta compartida.

La autorización del servidor es la barrera real. Los parámetros `origen=asilo` o `origen=fundacion` cambian regreso/visibilidad del menú, no permisos. Los dashboards no implementan una verificación previa dedicada tipo `/api/me`; abrir HTML directamente no prueba acceso a los datos.

## 7. Módulo financiero

### 7.1 Detección del esquema e integridad común

`finanzas.js:12`, `disponible`: exige FinanzasVersion, las 11 tablas enumeradas, correo_responsable de longitud254 y fila version=1. Ausencia total permite conservar algunos flujos clínicos antiguos; endpoints financieros responden503. Presencia parcial produce error. No valida exhaustivamente cada columna, índice o CHECK: la marca de versión no sustituye una inspección real.

`transaccion`/`bloqueo` usan transacción SQL y `sp_getapplock` exclusivo común **AsiloFinanzas**, propietario Transaction, timeout10s. Serializa escrituras del módulo y las integraciones clínicas. Esto favorece integridad pero reduce concurrencia; no es un bloqueo independiente por residente.

`operacion` exige UUIDv4 `claveOperacion`; calcula SHA256 del objeto `{params,body}`. Dentro del bloqueo busca clave previa: mismo tipo, usuario y huella devuelve resultado guardado; otra combinación devuelve409. Inserta el resultado JSON junto con la operación. Se protege el reintento de **la misma clave**, no dos formularios diferentes con UUID distintos y el mismo importe/referencia.

Finanzas no tiene DELETE de movimientos. La API oficial valida límites agregados que las FK/CHECK no pueden garantizar por sí solos. Escribir SQL manual fuera de ella puede romper aplicaciones/saldos; 006/010 ayudan a detectarlo, no lo impiden.

### 7.2 Representación monetaria

`finanzas-calculos.js:3`, `centavos`: admite número/cadena decimal positiva con hasta dos decimales y hasta diez dígitos enteros; rechaza notación exponencial, negativos, NaN y decimales excesivos. Multiplica por100 y exige entero seguro hasta999999999999 centavos. Cero solo cuando la operación lo permite. Los importes SQL financieros son DECIMAL(12,2); la cuota de residente es DECIMAL(10,2).

Suma/aplica en centavos; vuelve a unidades para persistir/responder. Fechas ISO se validan contra calendario, desde1900. Los movimientos de dinero recibido/pagado no permiten fechas futuras. Un cargo manual usa `C.fecha` y no tiene el mismo rechazo explícito de futuro que `fechaPago`.

### 7.3 Cuenta familiar y cargos

Se busca residente por nombre/apellido/DPI, máximo20. GET cuenta retorna responsable/contacto/cuota/estado, cargos con pagado/saldo, pagos, aplicaciones, ajustes y movimientos cronológicos. Tarjetas: cargos totales, pagos realizados, saldo pendiente. No es una cuenta separada por familiar: el titular técnico es el residente.

Tipos de cargo:

- **Mensualidad:** residente/período, con UNIQUE filtrado en SQL.
- **Medico:** visita única, importe igual al total neto ya registrado.
- **Manual:** cargo adicional extraordinario; concepto, fecha e importe; no sustituye mensualidad.

La sección redundante de cargos no se muestra como segunda tabla; se conservan detalles auditables desde los movimientos. Cambiar correo del responsable permite NULL/vacío o dirección validada y deja AuditoriaContactoFinanciero; no cambia correos ya enviados. No es edición general del familiar.

Para reconstruir movimientos, el primer ajuste aporta importe original del cargo; cada ajuste suma su diferencia y cada pago resta. Se ordena por fecha, tipo/ID. El JSON utiliza `tipo:'Abono'` como etiqueta interna de movimiento negativo, pero la interfaz lo muestra **Pago**; no existe una tercera tabla/tipo contable Abono.

Las lecturas de cuenta constan de varias consultas fuera de una transacción de lectura conjunta. Con escrituras concurrentes podría observarse una mezcla temporal de momentos; es un riesgo a probar, no un saldo erróneo demostrado en BD.

### 7.4 Mensualidades manuales y elegibilidad

`mensualidades.js`, `vista`/`evaluar`: exige 007. Frontend selecciona mes español, año desde1900 al actual, Todos los residentes activos o Individual con autocomplete. Mes por defecto actual Guatemala. No hay autorización especial para meses anteriores; sí previsualización y confirmación con huella. No se permiten meses futuros en frontend ni backend.

Por cada candidato explica Elegible, Existente u Omitida. Orden de comprobación: ya tiene cargo; falta ingreso; período anterior al ingreso; ingreso aún no ocurrió; período posterior a retiro; inactivo sin retiro verificado; falta cuota histórica; cuota≤0. No inventa fechas/importes. Si no hay elegibles, la pantalla muestra aviso y oculta confirmación.

Cuota elegida: última `CuotasResidentes.desde <= primer día del período`, desempate por id_cuota descendente. Genera **mes completo**, sin prorrateo, fecha contable primer día del mes. El lote manual usa Activos; Individual puede consultar retirados si estancia/cuota permiten ese mes. Los meses de ingreso y retiro se incluyen cuando cumplen las reglas, aunque la estancia no abarque todo el mes.

POST vuelve a obtener vista bajo bloqueo y compara huella: cambio de importe/estancia/existencia →409 y nueva revisión. Cada cargo generado encola su evento; un duplicado por período queda además impedido por UQ_Cargo_Mes.

### 7.5 Automatización y cuota vigente

`recuperar` requiere **MENSUALIDADES_AUTOMATICAS exactamente 'true'** y `ConfiguracionMensualidades.inicio` no NULL. Inicio no anterior al mes preparado. `iniciar` recupera al arrancar y cada hora, sin meses futuros. Recorre períodos desde inicio aprobado hasta mes actual, incluyendo candidatos retirados para meses elegibles. Ejecuta una transacción por período, no un COMMIT único de todos los meses. Reinicios/repeticiones no deben duplicar por bloqueo y UNIQUE.

**Configuración visible hoy:** variable ausente del `.env` leído; por defecto el código no activa automatización. El valor real de configuración SQL y un posible entorno externo del proceso **NO VERIFICADOS**. No se arrancó para probarlo.

Al dar de alta, la cuota comienza en mes actual. Al editar y detectar diferencia, `cuota` inserta vigencia desde el **mes siguiente**; `Huespedes.cuota_mensual` se actualiza inmediatamente como valor configurado. Generar meses anteriores usa la historia, no el nuevo valor. Varias ediciones para el mismo período se preservan y prevalece la última por ID. Cargos emitidos no se alteran automáticamente.

La migración007 siembra la cuota existente desde el mes en que se ejecuta, no desde un ingreso supuesto. Completar historia anterior es una tarea manual de revisión de datos; no hay interfaz general de mantenimiento de todas las vigencias/estancias antiguas.

### 7.6 Ajuste controlado de mensualidad

Desde Ver cargo→Corregir mensualidad: nuevo importe, motivo y anterior observado. Backend solo admite tipo Mensualidad; exige nuevo distinto del anterior y no menor que total ya abonado; verifica `importeAnterior` contra monto actual. Inserta AjustesMensualidades y actualiza monto del cargo en una transacción/idempotencia. No cambia pagos ni aplicaciones. Puede reducir a cero si no hay abonos. No existe ajuste equivalente general para cargos médicos/manuales ni anulación de pagos familiares.

### 7.7 Pago general, específico y abonos

`vistaPago` filtra cargos con saldo>0 y fecha≤fecha de pago. `cargos` los ordena por **fecha ascendente e id_cargo ascendente**. `distribuir` consume ese orden hasta agotar importe. Rechaza monto mayor al saldo conjunto; no crea saldo a favor, donación ni crédito.

`planPago` distingue:

- **General:** no admite idCargo; aplica FIFO, puede cubrir uno o varios cargos.
- **Mensualidad:** exige un cargo pendiente de tipo Mensualidad perteneciente a esa cuenta y no posterior al pago; solo aplica a él. Exceso sobre su saldo se rechaza explícitamente, sin distribuir a otros.

Cada aplicación expone cargo, concepto, período, monto, saldoAnterior, saldoResultante y clasificación Completo/Parcial. Si el importe deja saldo cero es completo respecto al saldo previo, aunque existieran abonos anteriores. Si cubre varios cargos, concepto “Pago general aplicado a varios cargos”; si cubre una mensualidad, “Abono a mensualidad de …” o “Pago completo de mensualidad de …”.

Previsualización no inserta. Confirmación recalcula dentro de transacción, compara huella, inserta PagosFamiliares, cada AplicacionesPagos, evento Pago y resultado de OperacionesFinancieras; todo o nada. La UI conserva campos/UUID para reintento de resultado incierto y exige revisar nuevamente tras conflicto409.

Comprobante nuevo guarda modalidad/concepto/aplicaciones con saldos en JSON, preservando significado frente a ajustes posteriores. Para pagos anteriores `describirPago` reconstruye usando aplicaciones por ID y ajustes vigentes al registrar, sin reescribir históricos. Exactitud de esa reconstrucción depende de integridad histórica; no se verificó contra datos reales.

El comprobante es una consulta/modal con ID, fecha, método, referencia y aplicaciones. **No hay facturación fiscal/FEL, firma digital, archivo bancario ni emisión PDF específica de recibo**; PDF pertenece al módulo Reportes.

### 7.8 Visitas nuevas e incorporación histórica

Nueva visita genera cargo familiar y obligación Fundación con el mismo neto, incluso neto0, en su transacción clínica. El saldo cero es válido. Los porcentajes históricos no se recalculan.

`historicos` busca visitas a las que falta cargo **o** obligación y devuelve filas/huella. POST revalida y completa lo que falte sin duplicar. La pantalla de mantenimiento se habilita mediante `/finanzas/mensualidades.html?revision=visitas`; no está en el menú principal cotidiano. La confirmación procesa el conjunto previsualizado, no se encontró selector por visita individual en ese POST. No hay conversión automática al iniciar.

Crear cargos históricos mediante ese flujo puede encolar avisos de cargo nuevos; antes de habilitar correo debe revisarse la cola. Un cargo ya existente no se vuelve a crear ni a notificar por repetir revisión.

### 7.9 Obligaciones y pagos a Fundación

Una obligación por visita, provisionalmente **igual al neto descontado**. La regla está visible en backend/UI y pendiente de confirmación de negocio en FINANZAS.md; no se verificó una aprobación posterior dentro de los archivos.

Saldo=monto−SUM(PagosFundacion). Estado derivado Pagada si cero, Parcial si hay abonos y resta, Pendiente si no. La consulta devuelve fecha de atención, residente, costos/porcentajes guardados, original, pagado y saldo. Solo Asilo registra pagos parciales o completos; exige importe≤saldo, fecha no futura y no anterior a visita. Pago familiar no cancela ni reduce esta obligación.

No hay consolidación de varias obligaciones en un único pago bancario, remesa automática ni conciliación bancaria. Referencia/método son datos registrados por el operador. No se encontró anulación de pagos a Fundación.

### 7.10 Donaciones, gastos y resumen

Donaciones: tipos Empresa internacional/Empresa nacional/Gobierno/Particular; donante, fecha, monto, descripción y referencia. Gastos: Agua/Energía eléctrica/Alimentación/Mantenimiento/Transporte/Servicios/Otros; concepto, beneficiario, fecha, monto, referencia y observaciones. Listado por fechas; interfaz añade búsqueda/filtros correspondientes. Registrar exige dinero ya recibido/desembolsado, fecha no futura e importe positivo.

Corregir se implementa como anulación con motivo/usuario/fecha y nuevo registro; no UPDATE silencioso de importe ni DELETE. El backend limita anular a un registro no anulado. Preserva fila histórica.

`resumen` reúne movimientos con UNION ALL:

```text
Ingresos = PagosFamiliares + Donaciones actualmente Confirmadas
Egresos = Gastos actualmente Confirmados + PagosFundacion
Neto del período = ingresos filtrados - egresos filtrados
Disponible estimado = ingresos acumulados - egresos acumulados
Por cobrar = SUM(CargosFamiliares.monto) - SUM(PagosFamiliares.monto)
Deuda Fundación = SUM(obligación - pagos asociados)
```

Los cargos pendientes no son ingresos y obligaciones pendientes no son gastos pagados. Registrar pago Fundación otra vez como Gasto duplicaría egreso: el sistema no lo hace automáticamente, pero la operación humana debe evitarlo.

Disponible parte de cero, sin saldo bancario inicial. Por cobrar/deuda/disponible son actuales/acumulados, no un cierre histórico del rango. Anular una donación o gasto lo excluye del resumen actual incluso al consultar un período anterior: no hay cierres contables inmutables. Consulta obtiene todos los movimientos y filtra fechas en JavaScript, riesgo de escala a medir.

## 8. Módulo de reportes

### 8.1 Contrato y arquitectura comunes

`backend/reportes.js` monta catálogo, consulta y exportación; `reportes-calculos.js` contiene `catalogo`, `permitido`, `filtros` y `crear`; `reportes-exportar.js:12` genera PDF. Frontend ajusta filtros en `adaptarFiltros`, invalida resultado/token al cambiar filtros y renderiza mediante textContent.

Consulta: `GET /api/reportes/:codigo`. Parámetros `desde`, `hasta` ISO inclusivos e `id_residente` según reporte. Exportación: `GET /api/reportes/exportar/:token/pdf`. Catálogo: `GET /api/reportes`. Permisos se revisan también al descargar.

SQL parametrizado por id/desde/hasta; cada plan retorna conjuntos, sin una consulta por fila. Lectura SERIALIZABLE con timeout solicitado30s; máximo4 consultas simultáneas, 5000 filas por conjunto; SELECT TOP5001 permite detectar exceso y rechazar, no mostrar totales truncados. No se midieron rendimiento ni bloqueos reales.

Resultado y totales se guardan temporalmente en memoria bajo token privado por usuario, diez minutos, máximo3 por usuario, 5MiB cada informe y 30MiB global. Reinicio o expulsión por memoria invalida token. Descarga no acepta filas/totales enviados por navegador; usa la instantánea. Cache-Control:no-store en rutas de Reportes. Máximo2 exportaciones simultáneas y 30000 celdas.

### 8.2 Inventario detallado

#### R01 — Costos de citas médicas por paciente

- Endpoint: GET `/api/reportes/R01`. Asilo y Fundación.
- Fuente: plan `identidad+visitas`, JOIN VisitasMedicas/SolicitudesMedicas/Huespedes. Pese al título, las filas principales son **visitas registradas**, no citas aún sin visita.
- Filtros: residente opcional; rango obligatorio sobre fecha_visita.
- Columnas: paciente, visita, fecha, cita, especialidad, médico, exámenes y medicamentos registrados, costo consulta/exámenes/medicamentos, subtotal, descuento monetario, neto y tres porcentajes.
- Segunda tabla por paciente: número de visitas, descuentos y neto. Totales: visitas, pacientes distintos, descuentos y neto. Sumas en centavos de valores guardados.
- No recalcula descuentos a partir de porcentajes ni tasa fija. Exporta la misma instantánea PDF.

#### R02 — Análisis médicos y ficha del paciente

- GET `/api/reportes/R02`. Asilo y Fundación; residente obligatorio; fechas opcionales e independientes para historial.
- Fuente: `pacientes+visitas`; Huespedes/FichaMedica y visitas. Fecha_ingreso y diagnostico de Huespedes son dependencias concretas del SELECT.
- Ficha: paciente/DPI/nacimiento/género/ingreso/motivo de ingreso/diagnóstico registrado/sangre/alergias/antecedentes/psicopatologías/padecimientos/medicamentos habituales/asistencia/observaciones.
- Motivo de ingreso no existe en fuente y aparece “No registrado”; no se sustituye por diagnóstico o motivo de solicitud. Diagnóstico de ficha es el campo Huespedes.diagnostico, distinto del de cada visita.
- Historial: paciente, visita, fecha, especialidad, médico, diagnóstico, exámenes/resultados, medicamentos/cantidad/indicaciones/observaciones. Totales de pacientes y visitas.
- Es **ficha actual**, no versión histórica al cierre. “Análisis” no significa interpretación automática ni diagnóstico generado. PDF incluye advertencia.

#### R03 — Cobros por paciente y período

- GET `/api/reportes/R03`. **Solo Asilo**; residente y rango obligatorios.
- Fuente: CargosFamiliares, PagosFamiliares, AplicacionesPagos, AjustesMensualidades, OperacionesFinancieras y VisitasMedicas para desglose; identidad Huespedes.
- Lee movimientos anteriores para apertura y ajustes necesarios para reconstruir original. Ordena fecha, cargos/ajustes antes de pagos y desempates estables.
- Movimientos: paciente, fecha, tipo, ID, modalidad, concepto, cargo/ajuste, pago y saldo por paciente. Desglose médico separado con cargo/visita/costos; aplicaciones del período con pago/cargo/monto.
- Totales: saldo inicial + cargos y ajustes del período − pagos del período = saldo final. No vuelve a sumar desglose ni aplicaciones. Auditoría UTC se convierte a Guatemala.
- Usa `describirPago` financiero y comprobante cuando existe. PDF conserva datos consultados. No es factura ni sustituye libros legales.

#### R04 — Pagos a la Fundación

- GET `/api/reportes/R04`. Asilo y Fundación. Rango obligatorio; residente opcional por relación visita→solicitud→residente.
- Fuentes: ObligacionesFundacion, PagosFundacion, VisitasMedicas, SolicitudesMedicas, Huespedes.
- Obligaciones hasta cierre: paciente, visita, fecha de atención, obligación, fecha de creación convertida Guatemala, original, pagado hasta cierre, saldo y estado. Otra tabla: pagos efectivos del rango, ID, obligación/visita, fecha, monto, método y referencia.
- Totales: obligaciones nuevas del período, efectivo pagado en período, saldo pendiente al cierre incluyendo obligaciones anteriores. Pagos familiares no entran.
- Si un pago está fechado antes de la creación de su obligación, conserva el efectivo del rango y advierte que esa obligación posterior queda fuera del saldo al cierre. Fecha de atención y creación no se confunden.

#### R05 — Entradas: donaciones y cobros

- GET `/api/reportes/R05`. Solo Asilo. Rango obligatorio; **no admite residente**, el backend rechaza incluso ese parámetro ajeno al reporte.
- Fuente: PagosFamiliares/Huespedes/OperacionesFinancieras para concepto y Donaciones actualmente Confirmadas.
- Dos tablas independientes: donaciones y pagos familiares. Columnas fecha, ID de origen, origen (donante/residente), concepto e importe.
- Subtotales separados y total de entradas. No incluye cargos, obligaciones pendientes ni gastos. Una donación posteriormente anulada queda excluida aun en rango pasado: no reconstruye estado histórico de anulación.

#### R06 — Exámenes registrados por paciente

- GET `/api/reportes/R06`. Asilo y Fundación. Residente opcional/rango obligatorio por visita.
- Mismo JOIN de visitas; filtra texto `examenes` no vacío.
- Columnas paciente, visita, fecha, exámenes, resultados, costo conjunto y evidencia “Realización no verificada”. Cuenta visitas con registros, no número de exámenes individuales.
- No existe estado solicitado/realizado, resultado por examen ni precio unitario normalizado. No se deduce realización por presencia de texto. PDF conserva esa limitación.

#### R07 — Medicamentos registrados por paciente

- GET `/api/reportes/R07`. Asilo y Fundación. Residente opcional/rango obligatorio por visita.
- Filtra visitas con texto medicamentos no vacío. Columnas paciente, visita, fecha, medicamentos, dosis verificada (ausente), cantidad registrada, indicaciones, costo conjunto y evidencia.
- Cuenta visitas con registros; **no certifica aplicación, administración, dispensación ni prescripción estructurada**. Dosis inexistente queda “No registrado”; cantidad es texto libre.
- No descompone nombres ni calcula consumos o existencias. PDF utiliza mismas filas.

### 8.3 Exportación comprobada y límites

Solo PDF funcional; la ruta general contiene `:formato` pero rechaza cualquiera distinto de `pdf`. No Excel, XLSX ni CSV. PDFKit usa A4, nombre del asilo, código/título, fecha Guatemala, filtros, notas, resumen, tablas **Campo/Detalle por registro** y numeración de páginas. Fuentes IBM Plex Sans incrustadas. No es una réplica horizontal exacta de la tabla web.

Las pruebas generan **PDF reales en memoria con fixtures** para los siete códigos y verifican contenido/estructura. No se ejecutaron las consultas completas contra SQL Server real en esta auditoría, no se imprimieron documentos ni se midió generación con volumen productivo. Las pruebas SQL simuladas no garantizan existencia/tipos de columnas reales.

## 9. Sistema de correos

### 9.1 Outbox y eventos

`finanzas.notificar` inserta NotificacionesCorreo dentro de la transacción de negocio, con UNIQUE(evento,id_evento) y comprobación de ausencia. Eventos existentes: **Cita**, **Cargo**, **Pago**. Destinatario es correo_responsable del residente. No hay correo de donación, gasto, retiro, anulación o pago a Fundación identificado.

- Cita: residente, especialidad, fecha y hora; no diagnóstico.
- Cargo: concepto, importe, período/mes, fecha y saldo pendiente.
- Pago: modalidad, concepto de abono/completo/general, comprobante, importe, fecha y saldo.
- Plantilla HTML en `notificaciones-correo.js:2` escapa contenido y conserva versión de texto. Estilo propio claro/azul, no el CSS Cyberdeck de la web.

Los campos clínicos de visita no se seleccionan para plantillas. Sin embargo, el **concepto manual** es texto libre y sí se envía: un operador podría escribir información sensible allí. La ausencia de diagnósticos automáticos no equivale a un filtro semántico de toda entrada humana.

### 9.2 Estados, duplicados y fallos

Temporizador cada30s; procesa una notificación por ciclo y no consulta/envía si no está configurado. Actualiza pendientes sin destinatario desde el contacto actual; no reemplaza destinatarios ya no nulos. Reclama con UPDATE/UPDLOCK/READPAST/READCOMMITTEDLOCK y cambia a Enviando, incrementa intentos y fecha.

SMTP sucede **después del COMMIT**, fuera de la respuesta/transacción financiera. Aceptación por proveedor→Enviada; no garantiza recepción/lectura. Fallo de envío o de persistir confirmación→Incierta cuando es posible. Enviando con último intento de más de5 minutos pasa a Incierta al procesar.

Message-ID estable por ID de notificación. No hay reintento automático de Incierta ni endpoint de reenvío. No puede garantizar exactamente una entrega SMTP ante caída después de aceptar: requiere verificar proveedor antes de recuperación manual. UNIQUE impide duplicar evento, pero no resuelve por sí sola esa ambigüedad externa.

### 9.3 Variables, modo de prueba y estado visible

Nombres de variables SMTP/correo (sin sus valores privados): `CORREO_HABILITADO`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_MESSAGE_DOMAIN`, `SMTP_SOLO_NOTIFICACION_ID`, `SMTP_DESTINATARIO_PRUEBA`.

Transporte exige TLS, usa puerto587 por defecto, `secure` según variable, límites conexión/saludo10s, socket15s, DNS10s; bloquea acceso a archivos/URL para contenido externo. Configurado requiere indicador exactamente true y host/user/pass/from, además de filtros de prueba válidos si se usan. No certifica conexión real ni credenciales válidas.

Modo de prueba requiere **ambos** ID y destinatario; limita reclamación a coincidencia, no redirige mensajes. Si un filtro falta o es inválido, no configura envío. El proceso aún puede realizar mantenimiento de estados/contactos de la cola una vez configurado; los filtros restringen envío, no todo UPDATE interno.

**Estado del `.env` visible en esta auditoría:** CORREO_HABILITADO ausente y campos SMTP principales ausentes/vacíos; bajo ese archivo el envío queda **desactivado/no configurado**. `.env.example` propone indicadores false. Variables externas de un proceso en ejecución, cola real y entrega SMTP: **NO VERIFICADAS**. No se consultaron destinatarios ni se realizó envío.

## 10. Identidad visual

### 10.1 Capa global real

Las 17 páginas incluyen `frontend/css/cyberdeck.css` al final de sus estilos y `compartido/cyberdeck.js` antes de scripts de módulo. Paleta observada:

| Token | Color | Aplicación |
|---|---|---|
| cd-slate | #26374B | Fondo principal y texto sobre superficie clara |
| cd-panel | #344B63 | Paneles, tarjetas, tablas, controles oscuros |
| cd-paper | #EDF1F5 | Modales Arasaka claros |
| cd-cyan | #00D9EF | Información, bordes, cifras y éxito |
| cd-yellow | #FCEE0A | Primarios, confirmaciones, advertencias y foco |
| cd-magenta | #FF315D | Errores, cancelaciones y acciones críticas |

Contenido: IBM Plex Sans400; encabezados: **IBM Plex Sans600**, no Rajdhani activo. El archivo Rajdhani-SemiBold.ttf y licencia están conservados, pero CSS/PDF no lo cargan. ESTABILIDAD_CYBERDECK.md documenta discrepancias de glifos; las pruebas revisan límites de fuentes usadas. La identidad tipográfica deseada Rajdhani está, por tanto, **PARCIAL**.

### 10.2 Componentes y comportamiento

Cyberdeck expone `mensaje`, `avisar`, `confirmar`; títulos ERROR // OPERACIÓN RECHAZADA, ATENCIÓN // CONFIRMACIÓN REQUERIDA, OPERACIÓN COMPLETADA e información. Observa cambios DOM y adapta alertas/toasts anteriores por clases y texto. Confirmación usa `<dialog>.showModal()`, foco inicial Cancelar, Escape, devolución boolean y restauración de foco; CSS la centra con inset/margin auto.

El envoltorio global fetch muestra carga, limita45s lecturas/90s escrituras o PDF, une abort del llamador, espera también el cuerpo, bloquea escrituras idénticas simultáneas en la pestaña y restaura botones. No reintenta. Un timeout del navegador no demuestra rollback del servidor. Ese bloqueo visual no sustituye UUID/transacciones.

Formularios oscuros y modales claros tienen estilos específicos; botones críticos con texto blanco, foco amarillo, disabled distinguible. Tabla en contenedor overflow-x, cabeceras legibles, botones sin reducción de texto. Tarjetas grandes antes de filtros cuando existen; Residentes tiene total/activos/inactivos, Solicitudes pendiente/programada/finalizada y Visitas total/distintos/mes.

Volver al menú está junto a encabezados de módulos; Salir permanece en header. En login el estilo de contraseña se fija por ID, no por tipo, conservando geometría al mostrarla. Breakpoint650px adapta tarjetas y herramientas; también hay reglas locales600/700/768. `prefers-reduced-motion` reduce animaciones.

### 10.3 Qué sigue siendo anterior y qué no se certifica

No se eliminaron `styles.css`, `principal/dashboard.css`, estilos de solicitudes, fichas/visitas, finanzas ni reportes. Cyberdeck sobreescribe con muchos `!important` y alias de variables antiguas incluso llamadas “verde”; no significa que toda fuente CSS antigua esté migrada. Plantilla de correo y PDF tienen diseño de documento propio.

No hay sistema de componentes compilado ni eliminación de todas las repeticiones de HTML de modales financieros. Usuarios y algunas pantallas no tienen tarjetas de resumen porque no se implementaron contadores allí; no afirmar que todos los módulos usan idéntico bloque de tarjetas.

Pruebas actuales verifican inclusión de recursos, rutas y fuentes; **en esta auditoría no se hizo QA visual nuevo en navegador**. La documentación previa registra QA Edge con mocks, no valida cada combinación actual de datos largos, zoom, teclado o Firefox. Cumplimiento WCAG global y contraste de cada estado: NO VERIFICADOS.

## 11. Flujo completo real

1. **Manual:** usuario activo introduce credenciales; API verifica bcrypt y emite cookie. Frontend elige dashboard por ámbito.
2. **Manual Asilo:** registra residente con ficha. **Automático en transacción:** alta de ficha, y cuota/ingreso actuales si 007 disponible. No crea por sí mismo un cargo mensual en ese instante.
3. **Manual/opcional:** revisar contacto financiero y correo. Cambios de correo quedan auditados.
4. **Manual Asilo:** solicita atención para residente activo, especialidad de catálogo y enfermero textual; estado inicial esperado Pendiente.
5. **Manual Fundación:** consulta pendientes y programa médico/fecha/horario permitido. **Automático transaccional:** Programada y evento Cita si Finanzas disponible.
6. **Manual Fundación:** registra diagnóstico, textos clínicos, tres costos y porcentajes. **Automático backend:** redondeo oficial, INSERT visita, Finalizada, cargo familiar, obligación y aviso de cargo; COMMIT conjunto.
7. **Manual o automático optativo:** mensualidades se previsualizan/confirmán o se generan desde inicio autorizado si indicador+configuración lo permiten. Cuota histórica y estancia determinan elegibilidad.
8. **Manual Asilo:** recibe dinero y registra pago general o de mensualidad; previsualiza aplicaciones. **Automático transaccional:** validación contra saldo actual, pago, aplicaciones, comprobante y evento Pago.
9. **Manual independiente:** Asilo registra desembolso a Fundación; reduce solo su obligación. Donaciones/gastos reflejan otro efectivo real, sin duplicar pagos Fundación.
10. **Consulta opcional:** residentes/visitas/cuentas y reportes; PDF usa instantánea de la consulta, no genera movimientos.
11. **Automático solo habilitado/configurado:** trabajador de correo reclama eventos confirmados y trata de enviarlos. Error SMTP no revierte negocio. Sin configuración los avisos pueden acumularse pendientes.

No hay cobro bancario automático, envío inmediato dentro de la transacción, aplicación automática de pago familiar a Fundación ni historial clínico normalizado por tratamiento.

## 12. API y endpoints

Convenciones: **A**=verificarToken+Asilo; **F**=verificarToken+Fundacion; **AF**=verificarToken+comprobación de ambos ámbitos. Público=sin JWT. Respuestas JSON suelen incluir `success`; se indican propiedades de éxito relevantes. Parámetros son un resumen del contrato, no Swagger. Las mutaciones financieras, salvo previsualizaciones, requieren `claveOperacion` UUIDv4; donde se indica vista requieren además `huella`. Los catálogos y donaciones/gastos se expanden desde bucles en código.

### 12.1 Servidor principal — 22 endpoints

| # | Método / ruta | Acceso | Entrada principal | Respuesta / finalidad | Controlador |
|---|---|---|---|---|---|
| 1 | POST /api/login | Público | correo, contrasena | cookie token, tipo_personal, nombres/apellidos | server.js:226 |
| 2 | POST /api/logout | Público | Ninguna | Borra cookie; message | server.js:327 |
| 3 | POST /api/huespedes | A | Datos personales, responsable, cuota, ficha | message; alta conjunta | server.js:360 |
| 4 | GET /api/huespedes | A | Sin filtros server | huespedes con ficha | server.js:611 |
| 5 | PUT /api/huespedes/:id | A | ID y formulario completo | message/cambio de vigencia | server.js:680 |
| 6 | DELETE /api/huespedes/:id | A | ID | message; retiro lógico | server.js:904 + finanzas.retirarResidente |
| 7 | GET /api/huespedes/buscar | F | q de2–100 | residentes TOP20 mínimos | server.js:570 |
| 8 | GET /api/huespedes/:id/ficha-medica | F | ID positivo | ficha o404 | server.js:590 |
| 9 | GET /api/usuarios | A | Ninguna | usuarios, migracionPendiente | server.js:1036 |
| 10 | POST /api/usuarios | A | nombres/apellidos/correo/telefono/contrasena/tipo_personal/id_rol | message; estado Activo | guardarUsuario:959/1033 |
| 11 | PUT /api/usuarios/:id | A | anteriores, estado; contraseña opcional | message | guardarUsuario:959/1034 |
| 12 | DELETE /api/usuarios/:id | A | ID | Baja lógica, message | server.js:1061 |
| 13 | GET /api/roles | AF | Ninguna | roles activos, migracionPendiente | bucle catálogo:1122 |
| 14 | POST /api/roles | A | nombre≤100 | 201, rol;409 duplicado | bucle catálogo:1144 |
| 15 | GET /api/especialidades | AF | Ninguna | especialidades activas, migracionPendiente | bucle catálogo:1122 |
| 16 | POST /api/especialidades | A | nombre≤50 | 201, especialidad;409 duplicado | bucle catálogo:1144 |
| 17 | POST /api/solicitudes | A | idResidente,motivo,especialidad,enfermero | message | server.js:1201 |
| 18 | GET /api/solicitudes | AF | Sin filtro server | solicitudes; hora HH:mm | server.js:1351 |
| 19 | PUT /api/solicitudes/:id/programar | F | medico,fechaCita,horaCita | message; Programada y aviso | server.js:1436 |
| 20 | PUT /api/solicitudes/:id/cancelar | A | ID | message; solo Pendiente | server.js:1579 |
| 21 | POST /api/visitas | F | idSolicitud,diagnostico,textos,costos,tres descuentos | message,calculo oficial | server.js:1667 |
| 22 | GET /api/visitas | AF | id_residente opcional | visitas clínicas/económicas | server.js:2110 |

### 12.2 Finanzas — 21 endpoints

Todos implementados mediante `ruta` en `backend/finanzas.js`; transacciones monetarias mediante `operacion`. Las fechas/descripciones y validaciones se detallan en sección7.

| # | Método / ruta | Acceso | Parámetros principales | Respuesta / función |
|---|---|---|---|---|
| 23 | GET /api/finanzas/residentes | A | q≥2 | residentes TOP20 |
| 24 | GET /api/finanzas/cuentas/:id | A | ID residente | residente,cargos,pagos,aplicaciones,ajustes,movimientos,totales |
| 25 | PUT /api/finanzas/cuentas/:id/correo | A | correo nullable,claveOperacion | message; auditoría contacto |
| 26 | POST /api/finanzas/cargos | A | idResidente,fecha,concepto,monto,claveOperacion | cargo,message |
| 27 | POST /api/finanzas/mensualidades/previsualizar | A | periodo YYYY-MM,idResidente opcional | residentes,filas,resumen,historico,huella; mensual.vista |
| 28 | POST /api/finanzas/mensualidades | A | mismos+huella+claveOperacion | cantidad,resumen,message; mensual.generar |
| 29 | POST /api/finanzas/mensualidades/:id/ajustar | A | ID cargo,monto,motivo,importeAnterior,claveOperacion | message; ajuste auditado |
| 30 | GET /api/finanzas/historicos | A | Ninguno | filas,huella; historicos |
| 31 | POST /api/finanzas/historicos | A | huella,claveOperacion | cantidad,message; registrarVisita por fila |
| 32 | POST /api/finanzas/pagos/previsualizar | A | idResidente,fecha,monto,modalidad,idCargo si específica | residente,responsable,modalidad,concepto,importe,aplicaciones,huella; vistaPago |
| 33 | POST /api/finanzas/pagos | A | vista+metodo,referencia,observaciones,huella,claveOperacion | pago,modalidad,concepto,aplicaciones,message |
| 34 | GET /api/finanzas/fundacion | AF | Ninguno | obligaciones,pagos,puedePagar,regla |
| 35 | POST /api/finanzas/fundacion/pagos | A | idObligacion,fecha,monto,metodo,referencia,observaciones,claveOperacion | pago,message |
| 36 | GET /api/finanzas/donaciones | A | desde,hasta opcionales | registros ordenados |
| 37 | POST /api/finanzas/donaciones | A | donante,tipo_donante,fecha,monto,descripcion,referencia,claveOperacion | registro,message |
| 38 | POST /api/finanzas/donaciones/:id/anular | A | motivo,claveOperacion | message; anulación trazable |
| 39 | GET /api/finanzas/gastos | A | desde,hasta opcionales | registros ordenados |
| 40 | POST /api/finanzas/gastos | A | categoria,concepto,fecha,monto,beneficiario,referencia,observaciones,claveOperacion | registro,message |
| 41 | POST /api/finanzas/gastos/:id/anular | A | motivo,claveOperacion | message; anulación trazable |
| 42 | GET /api/finanzas/resumen | A | desde,hasta opcionales | resumen,movimientos; efectivo/pendientes separados |
| 43 | GET /api/finanzas/notificaciones | A | Ninguno | configurado,últimas200 notificaciones sin cuerpo completo |

No hay endpoint público para ejecutar recuperación automática, enviar correos, cambiar configuración SMTP o activar mensualidades. Son funciones internas controladas por entorno/configuración SQL manual.

### 12.3 Reportes — 3 endpoints

| # | Método / ruta | Acceso | Entrada | Respuesta / controlador |
|---|---|---|---|---|
| 44 | GET /api/reportes | AF | Ninguna | tipo_personal,catálogo permitido; reportes.js:82 aprox. |
| 45 | GET /api/reportes/:codigo | AF + permiso del código | filtros según sección8 | informe,token; consulta/R.crear |
| 46 | GET /api/reportes/exportar/:token/:formato | AF + dueño+permiso | token vigente; formato=pdf | binario application/pdf; E.pdf |

Errores habituales:400 validación,401 sesión,403 ámbito,404 no encontrado,409 duplicado/conflicto,410 instantánea expirada,413 volumen excesivo y503 indisponibilidad/esquema/concurrencia. No todos los endpoints antiguos comparten exactamente la misma validación o forma de error.

## 13. Pruebas existentes

### 13.1 Ejecución de esta auditoría

`npm test` → `node --test`: **88 aprobadas / 88 ejecutadas, 0 fallos, 0 omitidas**. `node --check` sobre backend/frontend/tests: **38 JS sin errores de sintaxis**. No se ejecutó `npm start`.

Runner nativo `node:test`, aserciones `node:assert/strict`, VM/objetos de DOM y SQL simulados. Una prueba de estabilidad arranca un Express mínimo en loopback con `sql.connect` que lanza un error simulado; **no arranca el servidor real ni sus trabajos**. PDFKit sí genera documentos binarios reales en memoria. Pruebas de fuentes leen los archivos locales.

### 13.2 Cobertura por archivo

| Archivo en tests/ | Casos ejecutados | Qué comprueba |
|---|---:|---|
| catalogos.test.js | 9 | Login viejo/migrado, cookie/hash, permisos actuales, catálogos, usuario, esquema parcial, error visible |
| estabilidad.test.js | 5 | Errores DB/HTTP simulado, configuración, fetch timeout/doble envío, recursos y fuentes |
| fichas_medicas.test.js | 4 | Búsqueda/ficha parametrizadas, permisos, vacíos, render seguro y respuestas tardías |
| finanzas-estructura.test.js | 3 | Rutas/recursos/IDs HTML, DEMO bloqueado, preparación y activación separadas |
| finanzas-frontend.test.js | 8 | Formulario/UUID, doble clic, mensualidades, futuros, Fundación lectura, omisiones, pagos y errores |
| finanzas.test.js | 15 | Centavos/FIFO, parcial/completo, sobrepago, idempotencia, rollback, ajustes, histórico, efectivo, avisos/permisos |
| formatos.test.js | 3 | Español, fechas civiles/UTC Guatemala, independencia de zona del host |
| fundacion.test.js | 10 | Horarios, costos/descuentos oficiales, validación, rollback, IDs/listeners, integración cargo/aviso |
| mensualidades.test.js | 8 | Automatización desactivada/recuperación, duplicados simulados, estancias, cuotas, migración parcial, transacción alta |
| notificaciones.test.js | 6 | Desactivado, envío simulado, escape HTML, prueba controlada, inciertos y concurrencia |
| reportes.test.js | 14 | Siete reportes, filtros, permisos, límites, instantáneas, cálculos, contratos SQL y PDF |
| visitas_realizadas.test.js | 3 | Orden/filtros/contadores, detalle seguro, permisos/GET |
| **Total** | **88** | **SQL y SMTP simulados** |

El conteo corresponde a casos `test(...)` ejecutados, no al número de asserts ni a coincidencias de `.test(` dentro de expresiones regulares.

### 13.3 Qué no cubren como garantía real

- No prueban compilación/ejecución de todas las consultas en SQL Server real, tipos/defaults/índices/triggers presentes ni interbloqueos reales entre procesos.
- Simular rollback/applock no acredita comportamiento de aislamiento del motor bajo carga.
- No verifican entrega SMTP, DNS/TLS del proveedor ni correo recibido.
- DOM simulado no valida render completo, accesibilidad ni CSS con contenido real. No se hizo un nuevo recorrido manual en esta auditoría.
- No hay suite end-to-end de navegador declarada en package.json, cobertura porcentual ni pipeline CI identificado.
- No hay pruebas de penetración, fuerza bruta, CSP/CSRF, carga productiva o restauración de respaldo.
- Existe prueba de alta/edición de residente integrada con cuota, pero no una validación exhaustiva de todas las combinaciones de sus campos ni del HTML inseguro de tabla.

La prueba de rutas/recursos/IDs pasó; esto no implica comprobar por navegador todos los botones y estados. No se detectó un botón huérfano concreto en los flujos examinados, pero no se certifica ausencia universal de ellos.

## 14. Problemas técnicos y limitaciones

### 14.1 Hallazgos confirmados en código (sin explotación ni cambios)

| Prioridad | Hallazgo | Evidencia / consecuencia |
|---|---|---|
| Alta | Datos de residente interpolados sin escapar en HTML | `residentes.js:140`, renderizarTabla usa fila.innerHTML con nombres/apellidos/DPI/responsable/estado. Patrón de XSS almacenado confirmado; no se intentó explotación ni se insertó payload |
| Alta | Errores de alta/edición de residente incluyen mensaje interno | `server.js` catches de POST/PUT Huespedes incluyen `error:err.message` después del filtro de conexión. Puede revelar SQL/estructura en errores no clasificados |
| Alta antes de publicación | Configuración orientada a localhost | Cookie Secure=false, SQL encrypt=false/trustServerCertificate=true; no rate limiter de login, CSP/Helmet ni protección CSRF explícita observados. SameSite=lax mitiga algunos escenarios, no certifica seguridad global |
| Media | Historial administrativo de ficha es placeholder fijo | `residentes.html` y `verFichaMedica`; puede afirmar ausencia de visitas sin consultarlas |
| Media | No existe instalación base completamente reproducible | Scripts actuales son ampliaciones; faltan DDL base clínico/usuarios y migración específica de descuentos. R02 depende de Huespedes.diagnostico |
| Media | Esquema financiero detectado de forma limitada | `disponible` verifica tablas/marca/correo, no todas las columnas/índices/constraints; una alteración parcial posterior puede pasar y fallar al operar |
| Media | Validación de residente desigual | Alta/edición asignan numerosos campos directamente a parámetros SQL; formulario es más restrictivo que backend. Duplicado DPI se reconoce por texto “UNIQUE KEY”, no por todos los códigos como Usuarios |
| Media | Usuarios pueden desactivar la última cuenta administrativa | DELETE/PUT no contiene defensa de última cuenta o autodesactivación. Requiere decisión operativa |
| Media | Cookie eliminada no revoca JWT copiado | Logout no blacklist; cambio de contraseña tampoco revoca tokens por versión. Estado/tipo sí se revalida en cada request |
| Media | Agenda sin detección de colisiones ni reprogramación | Programar valida formato/horario/estado, no calendario por médico; médico es texto libre |
| Baja / identidad | Rajdhani no está activo | CSS/PDF usa IBM Plex; archivo conservado no equivale a implementación tipográfica completa |
| Baja / UX | Todo HTTP503 genera aviso genérico de DB en fetch global | Cyberdeck también intercepta503 por límite de exportaciones o esquema, por lo que puede atribuir falsamente a conexión una causa distinta |

No se encontraron marcadores literales TODO/FIXME en backend/frontend en la búsqueda realizada. Eso no elimina pendientes: varios están explícitos en comportamiento/documentación sin esas etiquetas.

### 14.2 Riesgos inferidos a comprobar, no defectos productivos demostrados

1. **Escalabilidad:** listados completos de residentes/solicitudes/visitas; resumen financiero carga todo efectivo y filtra en JS; consultas de comprobantes recorren JSON_VALUE; buscar con CHARINDEX/CONCAT no es una búsqueda indexada por prefijo. Medir planes/volumen antes de atribuir lentitud.
2. **Bloqueos:** exclusión global AsiloFinanzas, lotes mensuales/históricos largos y Reportes SERIALIZABLE pueden competir. Las pruebas no miden deadlocks ni esperas reales.
3. **Consistencia de lecturas financieras:** cuenta y resumen hacen múltiples SELECT sin snapshot común; una operación concurrente puede cambiar parte del conjunto entre lecturas. Reportes sí tiene transacción de lectura.
4. **Idempotencia limitada al identificador:** nuevo formulario tras respuesta perdida puede producir una operación distinta; revisar comprobante antes de registrar otra. Referencia bancaria no es UNIQUE.
5. **Cronología de movimientos:** cuenta ordena fechas crudas y desempates propios; Reportes convierte auditoría a fecha Guatemala y tiene otro comparador. Probar ajustes/pagos en mismo día, retrofechas y cambios cercanos a medianoche para descartar diferencias de saldo intermedio. No se demostró diferencia de saldo final.
6. **Diagnóstico de ficha:** R02 consulta un campo que el formulario residente no actualiza. Puede estar vacío o contener dato previo; existencia/calidad deben verificarse, no sustituir automáticamente por diagnóstico de visita.
7. **Datos clínicos en texto manual financiero:** notificaciones no seleccionan clínica, pero no eliminan información sensible si el usuario la escribe en concepto del cargo.
8. **Dependencia de CDN:** Bootstrap puede fallar sin acceso externo; no hay copia local verificada en inventario ni plan offline. No se probó desconexión de CDN.
9. **Código transversal fetch:** clona/lee cuerpo completo antes de entregarlo, incluso PDF; aumenta memoria por descarga. El detector de tipo de mensaje se basa parcialmente en palabras y puede clasificar de forma incorrecta frases nuevas.
10. **Nulos heredados:** estado NULL de usuario se conserva por migración y queda sin login; filtros Todos lo muestran, Activos/Inactivos no necesariamente. No es autorización por defecto.

No se identificó un endpoint principal claramente abandonado: los contratos inventariados tienen usos en pantallas, catálogos o integración de reportes. Se conserva compatibilidad histórica intencional y mantenimiento de visitas fuera del menú habitual; no confundirlos con código muerto.

### 14.3 Duplicación y límites de mantenimiento

`server.js` permanece grande; hay funciones de logout/mensajes/formatos envoltorio repetidas entre páginas y HTML financiero similar. El cálculo clínico se replica como preview frontend y cálculo oficial backend, deliberadamente; las pruebas comparan el contrato, no se debe confiar en preview. No se propone refactorización dentro de esta auditoría.

La documentación contiene resultados de etapas anteriores (63/68/88 pruebas, metadatos de fechas distintas). Son registros históricos; esta ejecución acredita88, no suma esos números. Avisos anteriores de dependencias en REPORTES.md no se revalidaron con npm audit actual y no se presentan aquí como vulnerabilidades vigentes confirmadas.

## 15. Historial de cambios disponible

`git status --short` devolvió **fatal: not a git repository**. No hay historial de commits disponible para atribuir fechas/autores/diffs. Las etapas siguientes se deducen de archivos, scripts numerados y documentos presentes, no de un historial Git certificado:

1. Base HTML/JS + server.js para acceso, residentes/ficha, usuarios y solicitudes/visitas. Esquema clínico inicial no está completamente versionado aquí.
2. Separación funcional de carpetas; estado actual ya no usa dashboards como contenedor común.
3. Catálogos Roles/Especialidades y separación tipo_personal/cargo mediante001–003; compatibilidad con rol antiguo conservada.
4. Programación con horarios cerrados, TIME SQL y tres descuentos independientes; consultas de visitas y ficha Fundación.
5. Finanzas aditivas005: outbox, idempotencia, cargos/obligaciones por visita y efectivo separado de deuda.
6. Mensualidades007/009/010: vigencias, estancia, recuperación optativa y ajuste auditado.008 se conserva explícitamente descartado.
7. Clasificación de pagos específicos/generales con comprobante JSON, sin nueva migración de tipo contable.
8. Reportes R01–R07 y PDF exclusivo, instantáneas, fuentes locales y advertencias clínicas.
9. Capa Cyberdeck, tratamiento de errores de conexión, límites fetch y confirmaciones. CSS actual contiene ampliación de tablas, contadores Residentes, botón Retirar y diálogo centrado.

No se puede inferir de los archivos qué usuario real ejecutó cada migración, qué datos permanecen hoy, ni cuándo se desplegó una versión. Esos aspectos quedan NO VERIFICADOS.

## 16. Estado final y pendientes

### 16.1 Clasificación funcional

| Función | Estado del código | Límite de evidencia |
|---|---|---|
| Login JWT/cookie, ámbitos y usuarios | IMPLEMENTADA | Pruebas simuladas y bcrypt; instalación real no probada hoy |
| Roles y Especialidades dinámicos | IMPLEMENTADA para consultar/crear | No hay edición/desactivación en UI/API de catálogo |
| Residentes alta/editar/ver/retirar/buscar/filtros/contadores | IMPLEMENTADA | Validación/seguridad con pendientes descritos |
| Ficha administrativa actual | IMPLEMENTADA | Historial dentro de ese modal PARCIAL: placeholder |
| Solicitudes y programación/cancelación | IMPLEMENTADA | Agenda avanzada y reprogramación no existen |
| Registro de visita y descuentos configurables | IMPLEMENTADA | Integridad contra SQL real NO VERIFICADA en auditoría |
| Visitas realizadas e historial Fundación | IMPLEMENTADA | Solo lectura; sin edición clínica posterior |
| Ficha Fundación por residente | IMPLEMENTADA | Sin versiones históricas de ficha |
| Cuentas/cargos/pagos generales/específicos/abonos | IMPLEMENTADA | QA real concurrente pendiente |
| Mensualidades manuales y ajustes | IMPLEMENTADA | Requiere007 y datos de estancia/cuota verificados |
| Automatización de mensualidades | IMPLEMENTADA como optativa | Desactivada bajo .env visible; configuración SQL NO VERIFICADA |
| Fundación financiera y pagos parciales | IMPLEMENTADA | Regla neto de visita pendiente de confirmación de negocio |
| Donaciones/gastos/anulaciones/resumen | IMPLEMENTADA | Disponible estimado, no banco ni cierre inmutable |
| Correos en cola/procesador/modo controlado | IMPLEMENTADA | SMTP visible no configurado; entrega real NO VERIFICADA |
| Siete reportes y PDF | IMPLEMENTADA con pruebas | SQL real/volumen/impresión NO VERIFICADOS |
| Cyberdeck | PARCIAL respecto identidad completa | Capa global operativa; Rajdhani pendiente, estilos locales conservados |
| Reproducción íntegra de BD desde cero | PARCIAL | Solo ampliaciones/versiones; falta esquema base completo |
| Carga DEMO automática | NO APLICA al proceso actual | Script008 bloqueado/descartado, no restaurarlo por inferencia |
| CRUD médicos/enfermeros/exámenes/medicamentos | NO APLICA al alcance actual | No implementados; no presentarlos como módulos existentes |
| Estados de examen realizado/medicamento administrado | PENDIENTE si se exige esa evidencia | No hay captura estructurada; R06/R07 advierten limitación |
| RBAC por rol, facturación fiscal, banca, inventario, Azure | NO APLICA al alcance actual | No implementados ni añadidos en esta tarea |

### 16.2 Prioridad recomendada para cerrar el proyecto

**P1 — antes de usar con datos sensibles fuera de entorno local:** corregir interpolación HTML de Residentes y exposición de errores internos; revisar validación backend de residentes, HTTPS/cookie segura, conexión SQL cifrada y protección de acceso. Añadir pruebas que reproduzcan esos hallazgos en entorno aislado, sin datos reales. Son recomendaciones, no cambios realizados.

**P2 — certificar instalación:** documentar DDL base efectivo y restricciones de visita/DPI/ficha; revisar dependencias R02 y columnas de descuentos; contrastar005/007 con esquema real usando lectura autorizada; respaldar y probar restauración; ejecutar QA de transacciones, sobrepagos, duplicados y reportes en copia controlada.

**P2 — exactitud funcional visible:** sustituir el falso historial vacío del modal administrativo por consulta real o un mensaje inequívoco; confirmar regla económica Fundación, política de mes completo y fecha de vigencia; definir prevención de pérdida de última cuenta Asilo.

**P3 — operación:** verificar estancias y cuotas históricas antes de activar mensualidades; revisar cola/destinatarios y probar un correo controlado antes de habilitar envío; documentar recuperación de resultados inciertos y procedimiento de ajustes/anulaciones.

**P3 — rendimiento y presentación:** medir reportes/lecturas/bloqueos con volumen real; evaluar paginación donde se necesite; completar Rajdhani con fuente validada, QA Firefox/móvil/zoom/teclado y documentos impresos. No afirmar umbral de60s sin medir.

**P3 — mantenimiento:** incorporar versionado Git y esquema base reproducible cuando el desarrollador lo autorice; mantener pruebas y documentación alineadas. No se inició Git ni se modificó configuración en esta tarea.

No se requiere inventar nuevos módulos para declarar funcional el alcance académico actual. Los pendientes de seguridad, fidelidad de interfaz y verificación real sí deben distinguirse de ampliaciones futuras.

## 17. Referencias técnicas y reproducción del diagnóstico

### 17.1 Mapa de fuentes principales

| Fuente | Función/sección | Afirmaciones respaldadas |
|---|---|---|
| package.json | main/scripts/dependencies | Arranque, tecnologías, runner |
| backend/config/db.js:9 | dbConfig | Variables, pool, timeouts, TLS SQL |
| backend/config/errores-db.js | esErrorConexion/responder |503 seguro para conexión/cancelación |
| backend/server.js:66–215 | rolesAnteriores,obtenerEsquema,normalizarUsuario,verificarToken,soloAdmin,soloFundacion | Compatibilidad y autorización |
| backend/server.js:226–338 | login/logout | bcrypt/JWT/cookies |
| backend/server.js:360–950 | rutas Huespedes | Alta/ficha, edición, consulta y retiro |
| backend/server.js:959–1168 | guardarUsuario/bucle catálogo | Usuarios, catálogos y409 |
| backend/server.js:1201–1650 | rutas SolicitudesMedicas | Estados, especialidad, horario y notificación |
| backend/server.js:1667–2100 | POST visitas | Cálculo oficial y transacción clínica/financiera |
| backend/server.js:2110–final | GET visitas/listen | Historial y arranque de trabajos |
| backend/finanzas.js | ruta,operacion,transaccion,bloqueo,cargos,cargoNuevo,registrarVisita,vistaPago,historicos,obligaciones | API financiera e integridad |
| backend/finanzas-calculos.js:3–75 | centavos,distribuir,planPago,conceptoPago,describirPago,clave,huella | Redondeo/validación/distribución/comprobantes |
| backend/mensualidades.js:4–100 | evaluar,vista,generar,cuota,recuperar,iniciar | Estancia, vigencia, lotes y automatización |
| backend/notificaciones-correo.js:2–56 | plantilla,configurado,procesarUna,iniciar | Escape, cola, SMTP e inciertos |
| backend/reportes.js:6–118 | SQL,consulta,ruta,guardar | Fuentes y límites/instantáneas |
| backend/reportes-calculos.js:3–88 | catalogo,permitido,filtros,crear | Reportes, columnas y fórmulas |
| backend/reportes-exportar.js:12 | pdf | Formato y exportación exclusivamente PDF |
| frontend/compartido/formatos.js | dia,fecha,periodo,dinero,hora | Fechas españolas civiles/UTC y moneda |
| frontend/compartido/catalogos.js | configurarCatalogo | Selector/modales secundarios |
| frontend/compartido/cyberdeck.js | confirmar,fetch,observarMensajes | UI global, límites y confirmaciones |
| frontend/css/cyberdeck.css | tokens,modal,tablas,media queries | Paleta, fuente activa y correcciones |
| frontend/residentes/residentes.js:120/130/278 | actualizarEstadisticas,renderizarTabla,verFichaMedica | Contadores, HTML inseguro y ficha actual |
| frontend/finanzas/finanzas.js:96–178 | cargarCuenta,abrirPagoFamiliar,fundacion,abrirMensualidad,notificaciones | Flujos UI y mensajes |
| frontend/reportes/reportes.js | adaptarFiltros,mostrar,exportar,iniciar | Filtros pertinentes, PDF y ámbito |
| sql/001–010 | DDL/consultas y guardas | Modelo documentado y activación manual |
| tests/*.test.js | Casos enumerados en sección13 | Evidencia automatizada simulada |

Los nombres de tablas/columnas y rutas de este informe proceden de consultas y scripts, no de una consulta de catálogo SQL actual. Documentos auxiliares útiles: MIGRACION_CATALOGOS.md, FINANZAS.md, REPORTES.md y ESTABILIDAD_CYBERDECK.md. Sus afirmaciones sobre ejecuciones antiguas se tratan como antecedentes documentales, no resultados de esta auditoría.

### 17.2 Verificaciones realizadas y no realizadas

Realizado: inventario de archivos; lectura de fuentes/DDL/documentación; búsqueda de rutas, funciones, TODO/FIXME y usos de HTML dinámico; lectura selectiva segura de nombre de BD/indicadores; comprobación de ausencia de Git;88 pruebas;38 verificaciones sintácticas. Los tests incluyen recursos locales/IDs, permisos, cálculos, duplicados simulados y PDF.

No realizado: migraciones, DML, conexión SQL, SELECT real, servidor de aplicación, activación automática, SMTP, cambios `.env`, instalación de dependencias, publicación o despliegue. No se reconstruyó el estado de usuarios ni se leyó información personal de la BD.

Comandos de comprobación local reproducibles: `npm test` y `node --check <archivo.js>`. `npm start` es el comando operativo del sistema, **no un comando inocuo de auditoría**, porque el arranque inicia los procesos configurados. Revisar entorno e indicadores antes de usarlo en una prueba real.

**Conclusión técnica:** el código contiene un sistema amplio y probado mediante simulaciones, con separación correcta entre ámbito y cargo, cálculo médico oficial, aplicaciones monetarias trazables y reportes PDF de datos existentes. Su preparación para operación real no puede certificarse solo con esas pruebas: quedan hallazgos concretos de seguridad/interfaz y comprobaciones de esquema, concurrencia, correo y volumen que este informe identifica sin alterar el sistema.
