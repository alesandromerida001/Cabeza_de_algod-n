# Finanzas — operación, mensualidades y QA manual

## Estado y alcance

Implementación aditiva en Node/Express/mssql y frontend HTML/Bootstrap/JS. No se ejecutaron migraciones ni se generaron movimientos reales. No se modificó `.env`.

La migración 005 ya fue aplicada por el desarrollador. En esta revisión se consultaron únicamente metadatos reales, con autorización: existen las tablas financieras y correo_responsable; faltan fecha_ingreso, fecha_retiro e historial de cuotas. Las definiciones CHECK/índices no fueron visibles con el usuario SQL de la aplicación, y la consulta de disparadores no devolvió filas visibles; esto no certifica su ausencia con permisos elevados. La inspección no ejecutó DDL ni DML. Cualquier modificación SQL corresponde a la revisión manual del desarrollador.

No hay repositorio Git disponible. No se ejecutó ninguna migración, carga de datos, movimiento ni envío de correo. No se modificó .env. Las pruebas usan SQL/SMTP simulados.

## Archivos del módulo

Creados durante la implementación financiera:

- `backend/finanzas-calculos.js`: validaciones e importes en centavos, distribución FIFO, huellas y claves.
- `backend/finanzas.js`: endpoints y transacciones financieras.
- `backend/notificaciones-correo.js`: cola de correo y proceso SMTP independiente.
- `frontend/finanzas/finanzas.html`, `cuentas.html`, `mensualidades.html`, `fundacion.html`, `donaciones.html`, `gastos.html`, `notificaciones.html`.
- `frontend/finanzas/finanzas.js` y `finanzas.css`.
- `.env.example`, `sql/005_finanzas.sql`, `sql/006_verificar_finanzas.sql`, este documento.
- `tests/finanzas.test.js`, `tests/finanzas-frontend.test.js`, `tests/notificaciones.test.js`.

Modificados por integración:

- `backend/server.js`: montaje financiero; transacción de cita y aviso; cargo/obligación dentro de la transacción de visita; inicio del proceso de correo.
- `frontend/principal/admin_dashboard.html` y `dashboard.js`: Estados de Cuenta y Finanzas.
- `frontend/fundacion/fundacion_dashboard.html` y `fundacion_dashboard.js`: consulta de obligaciones/pagos.
- `package.json`, `package-lock.json`: Nodemailer; `npm test` ejecuta Node Test Runner.
- Los cuatro archivos de pruebas previos cargan el módulo financiero local con sus dependencias simuladas. `tests/fundacion.test.js` verifica también la integración transaccional nueva.

## Instalación inicial (005 ya aplicada en este proyecto)

1. Respaldar la base correcta desde SSMS: Tareas → Copia de seguridad → Completa. Usar un archivo nuevo accesible al servicio SQL Server. Verificar el respaldo y probar primero en una copia de la base.
2. Detener Node. Revisar `sql/005_finanzas.sql` y confirmar el nombre de la base en SSMS. Las migraciones 001–003 ya aplicadas no necesitan repetirse.
3. Ejecutar **005_finanzas.sql**. Es una transacción: agrega correo, tablas, FK, restricciones de importes/estados, índices y versión. Reejecutarlo sobre la misma estructura no inserta movimientos. Si encuentra tablas financieras homónimas sin versión, se detiene para revisión; no las reemplaza.
4. Ejecutar **006_verificar_finanzas.sql**. Es solo lectura. Las anomalías deben devolver cero filas. Es normal encontrar visitas históricas pendientes antes de conciliarlas.
5. Iniciar Node desde la raíz con `npm start`, recargar navegador y entrar con personal Asilo.
6. Capturar/verificar el correo del responsable de cada cuenta necesaria. Mantener `CORREO_HABILITADO=false` durante la primera revisión.
7. Para mantenimiento, abrir /finanzas/mensualidades.html?revision=visitas → Revisar visitas anteriores → revisar → confirmar la lista y los importes. No se ejecuta automáticamente al arrancar ni desde 005/006. Repetir la consulta no duplica visitas ya conciliadas.
8. Probar operaciones en una copia de la base. Revisar notificaciones y destinatarios antes de habilitar SMTP en la instalación real. Habilitarlo puede enviar avisos pendientes, incluidos cargos históricos.

Antes de 005, el servidor y los módulos previos pueden iniciar. Finanzas responde 503 con explicación. El flujo clínico previo continúa sin crear cargos/avisos; sus visitas podrán conciliarse después. Una estructura financiera parcial detectada bloquea operaciones en vez de ignorarlas. No volver a un backend antiguo después de iniciar operaciones financieras.

## Modelo e integridad

Tablas: CargosFamiliares, PagosFamiliares, AplicacionesPagos, ObligacionesFundacion, PagosFundacion, Donaciones, Gastos, NotificacionesCorreo, OperacionesFinancieras, AuditoriaContactoFinanciero y FinanzasVersion.

- Importe de cada movimiento: DECIMAL(12,2); cálculos de aplicación en centavos enteros. No se usa FLOAT para almacenar dinero.
- Mensualidades: UNIQUE filtrado residente/período. Cargos médicos: UNIQUE filtrado visita. Obligaciones: una por visita. Notificaciones: UNIQUE evento/referencia.
- Cada mutación tiene una UUID y huella del cuerpo y parámetros, usuario y resultado persistido dentro de la transacción. Reintentar la misma operación devuelve su resultado; reutilizar la clave con otros datos se rechaza.
- Las escrituras toman un bloqueo de aplicación transaccional común. Citas y visitas lo adquieren antes de bloquear la solicitud para mantener el mismo orden que los procesos financieros. Fallar un cargo u obligación revierte también la nueva visita y su finalización.
- Los pagos confirmados son históricos. Los cargos solo admiten corrección explícita de mensualidad, con importe anterior/nuevo, motivo, usuario y fecha; nunca por cambiar una cuota. No hay endpoints DELETE. Donaciones/gastos se corrigen mediante anulación con motivo, usuario y fecha, seguida de un nuevo registro si corresponde.
- No realizar escrituras manuales en las tablas financieras: los límites agregados y la pertenencia pago/cargo al mismo residente se controlan en las operaciones transaccionales. 006 permite comprobarlos después. Las credenciales SQL deben quedar restringidas al servicio.

## Reglas de negocio explícitas

1. **Mensualidades (tras 007):** mes completo, sin prorrateo; estancia verificada que intersecta el mes y cuota positiva. No anticipar ingresos ni generar meses futuros. El lote manual usa activos; la consulta individual admite un residente retirado para meses de su estancia conocida. Períodos anteriores no necesitan autorización especial: siempre requieren revisar importes y confirmar. Si falta historia de cuota para un mes, la mensualidad se omite con explicación visible. Nunca se sustituye por la cuota actual ni se inventa un importe histórico.
2. **Cargos médicos:** total neto oficial ya guardado en VisitasMedicas; nunca se recalculan descuentos históricos. Total cero se conserva como cargo/obligación saldados.
3. **Fundación:** provisionalmente la obligación equivale al total neto descontado de la visita. **Pendiente confirmar con el responsable del proyecto.** Recibir un pago familiar no paga a Fundación.
4. **Pagos familiares:** modalidad general FIFO por fecha/ID de cargo; modalidad de mensualidad específica limitada al cargo elegido; solo cargos con fecha igual o anterior a la del pago. Se revisa la distribución antes de confirmar y se recalcula bajo bloqueo. Excedentes se rechazan, sin crédito automático y sin convertirlos en donaciones. No se cambia cuota_mensual.
5. **Efectivo:** ingresos = pagos familiares + donaciones confirmadas. Egresos = gastos confirmados + pagos a Fundación. Cargos y obligaciones pendientes no son efectivo. Las gráficas usan esos mismos movimientos, sin doble conteo.
6. **Disponible estimado:** parte de cero e incluye todos los movimientos registrados. No representa un saldo bancario conciliado ni incluye un saldo inicial anterior al sistema. Confirmar con el responsable si se necesita migrar un saldo inicial; no se inventa.
7. **Fechas del resumen:** ingresos/egresos/donaciones y tablas se filtran por período; disponible acumulado y cuentas por cobrar/pagar son actuales y así se etiquetan. Anular un registro excluye su importe del resumen actual, pero conserva la fila y su motivo; no es un cierre contable inmutable a una fecha pasada.
8. **Reintentos:** el formulario conserva la clave mientras se reintenta una respuesta perdida. Antes de iniciar un nuevo formulario tras cerrar o recargar una operación incierta, consultar el comprobante: un nuevo formulario es una operación nueva, no una deduplicación por importe/referencia.

## Flujos

**Estado de Cuenta:** buscar residente por nombre/apellido/DPI → seleccionar → responsable, teléfono, correo, cuota y saldos → movimientos cronológicos con saldo acumulado → Ver cargo/recibo → pago parcial → distribución → confirmar. El recibo muestra ID, método, referencia y aplicaciones.

**Fundación:** Asilo y Fundación consultan obligaciones, desglose económico guardado, pagos y saldo. Fundación ve Cobros pendientes del Asilo, saldo que le deben, pagos recibidos, cantidades pendientes/pagadas e historial de cobros. Solo Asilo ve/puede usar Pagar. Fundación no puede leer cuentas familiares, donaciones, gastos ni resumen administrativo. El rol descriptivo nunca autoriza.

**Donaciones y gastos:** registrar únicamente dinero efectivamente recibido/desembolsado. Buscar y filtrar por fechas/tipo o categoría; consultar detalle; anular con motivo. Para corregir, anular y registrar nuevamente. Los pagos a Fundación se registran en su propio módulo, no otra vez como Gastos.

## Endpoints (todos bajo `/api/finanzas`)

Asilo, autenticado:

| Método | Ruta | Uso |
|---|---|---|
| GET | `/residentes?q=` | Autocomplete mínimo |
| GET | `/cuentas/:id` | Datos de responsable, cargos, pagos, aplicaciones, movimientos y saldo |
| PUT | `/cuentas/:id/correo` | Correo del responsable y auditoría |
| POST | `/cargos` | Cargo manual |
| POST | `/mensualidades/previsualizar` | Lista e importes antes de confirmar |
| POST | `/mensualidades` | Generación individual/lote |
| POST | `/mensualidades/:id/ajustar` | Importe corregido con motivo y auditoría; nunca menor que lo abonado |
| GET | `/historicos` | Visitas pendientes de cargo u obligación |
| POST | `/historicos` | Conciliación confirmada e idempotente |
| POST | `/pagos/previsualizar` | Distribución FIFO |
| POST | `/pagos` | Pago familiar y aplicaciones |
| POST | `/fundacion/pagos` | Abono a una obligación |
| GET, POST | `/donaciones` | Listar/registrar |
| POST | `/donaciones/:id/anular` | Anulación con motivo |
| GET, POST | `/gastos` | Listar/registrar |
| POST | `/gastos/:id/anular` | Anulación con motivo |
| GET | `/resumen?desde=&hasta=` | Resumen y movimientos |
| GET | `/notificaciones` | Estado de configuración y últimos 200 eventos |

Asilo **o** Fundación: GET `/fundacion`, solo obligaciones y pagos a Fundación.

Integraciones: PUT `/api/solicitudes/:id/programar` encola cita después de programar, dentro de la misma transacción; POST `/api/visitas` inserta cargo y obligación antes del COMMIT. No cambia las fórmulas médicas.

## Correo y recuperación de errores

Variables nuevas (ejemplo sin secretos en `.env.example`):

- `CORREO_HABILITADO=false` por defecto. Para enviar, configurar y cambiar expresamente a `true`.
- `SMTP_HOST`, `SMTP_PORT` (587 por defecto), `SMTP_SECURE` (`false` para STARTTLS/587; `true` para TLS/465).
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- `SMTP_MESSAGE_DOMAIN`: dominio usado en el identificador estable del mensaje.

No reemplazar el `.env` existente ni cambiar DB/JWT. El desarrollador agrega las variables y reinicia Node. Nodemailer está en package.json/lock; en otra instalación usar `npm ci`.

El proceso revisa una notificación cada 30 segundos y reclama el evento mediante UPDATE con bloqueo. Lee solo filas confirmadas. SMTP no ocurre dentro de una transacción financiera ni durante la respuesta HTTP. Configuración ausente deja Pendiente y muestra configuración pendiente; destinatario ausente deja Pendiente hasta capturar el correo. Los correos llevan cita o concepto/importe/saldo, nunca diagnósticos, alergias, tratamientos ni historial.

TLS requerido, sin acceso a archivos/URL para adjuntos, timeouts de conexión/saludo 10 s y socket 15 s. Referencia técnica: https://nodemailer.com/smtp.

`Enviada` significa aceptada por SMTP, no garantía de lectura/entrega final. Un fallo o caída deja `Incierta` (o Enviando hasta detectarse la interrupción). No se reintenta automáticamente: SMTP no garantiza exactamente una entrega. Verificar logs del proveedor por Message-ID y destinatario antes de que el desarrollador autorice cualquier recuperación manual. No cambiar ese estado a Pendiente sin comprobar que no se entregó. Un fallo SMTP nunca revierte pagos/cargos confirmados.

## Verificaciones y recorrido manual

Desde la raíz: `npm test` (equivale a `node --test`) y `npm start`. No usar el comando de inicio para ejecutar migraciones: no existe migración automática.

Pruebas automatizadas: validación monetaria, FIFO, mensualidades sin duplicar, huellas obsoletas, excedentes, recibos, rollback, históricos, obligaciones parciales, efectivo vs deuda, anulaciones, autorización, integración clínica/cargo, correo desconfigurado, incertidumbre SMTP, duplicados y formularios con reintentos. Se usan SQL y SMTP simulados.

Se probó el arranque real de Express en un puerto temporal, las páginas por HTTP y respuestas 401 sin sesión, con SMTP deshabilitado y sin consultas SQL. Falta verificar la ejecución real de T-SQL y SMTP, además del recorrido visual completo en navegador contra la base migrada.

En una copia de la base:

1. Migrar 005, ejecutar 006, entrar como Asilo y Fundación y comprobar aislamiento.
2. Generar una mensualidad individual y un lote; repetir y verificar ausencia de duplicados. Cambiar cuota después y verificar el importe histórico.
3. Crear una visita; comprobar visita, Finalizada, cargo y obligación juntos. Simular un fallo financiero únicamente en un entorno de prueba y comprobar rollback.
4. Revisar históricos, confirmar y repetir la revisión. Comparar importes contra VisitasMedicas.
5. Abonar parcialmente, revisar aplicaciones y recibo, intentar excedente y reintento. Confirmar que Fundación sigue pendiente.
6. Pagar parcialmente a Fundación y comprobar saldo/estado e ingreso/egreso por separado.
7. Registrar/anular donación y gasto; verificar historial, filtros, gráficas y resumen sin doble conteo.
8. Con cuenta SMTP de pruebas y destinatarios controlados, validar cita/cargo/pago; provocar un fallo de SMTP y comprobar que las operaciones financieras permanecen confirmadas.
9. Revisar móvil, errores dentro de modal, Logout y navegación. Ejecutar nuevamente 006 al finalizar.

Pendientes operativos: revisión de reglas anteriores, migración 007 y pruebas reales SQL/SMTP y visuales. No se implementó Reportes ni rework Cyberpunk.

## Actualización: experiencia simplificada y mensualidades automáticas

Archivos nuevos: backend/mensualidades.js; sql/007_mensualidades.sql, 009_activar_mensualidades.sql, 010_verificar_mensualidades.sql; tests/mensualidades.test.js y tests/finanzas-estructura.test.js.

Archivos modificados en esta actualización: backend/finanzas.js, backend/server.js; frontend/finanzas/finanzas.js y finanzas.css; los siete HTML financieros (únicamente renombre de navegación donde corresponde); frontend/fundacion/fundacion_dashboard.html; frontend/residentes/residentes.html; .env.example; tests/finanzas.test.js y finanzas-frontend.test.js; este documento. No se cambió finanzas-calculos.js, autenticación, pagos clínicos, donaciones/gastos ni sus reglas.

- **Cuenta:** tarjetas, correo editable/auditado y movimientos completos. Se oculta la segunda tabla Cargos y saldos; Ver conserva el detalle de cargo, aplicaciones de cada pago y ajustes. Agregar cargo adicional explica que aumenta la deuda familiar. No se elimina información financiera.
- **Mensualidades:** Mes, Año y Aplicar a; el buscador aparece para un residente específico. La revisión precede a toda confirmación; no hay checkbox para meses anteriores. Años desde 1900 hasta el actual; no se admiten meses futuros. Los importes del historial tienen prioridad sobre la cuota configurada.
- **Fundación:** interfaz de consulta de cobros del Asilo, cuatro resúmenes e historial de pagos recibidos. No tiene escritura ni acceso a cuentas familiares. La obligación permanece igual al neto histórico de la visita; el pago familiar no la liquida.
- **Visitas anteriores:** acceso directo de mantenimiento /finanzas/mensualidades.html?revision=visitas. No está en el menú cotidiano. Consultar la lista entera y confirmar solo tras revisar todas sus filas; el backend vuelve a comprobar la huella y las claves únicas. No modifica visitas ni recalcula importes. Mantener SMTP apagado si se trata de pruebas.

### Aplicar manualmente, sin generar cargos durante la instalación

1. Respaldar desde SSMS (copia completa) y comprobar que se puede restaurar. Preparar una **copia separada** para QA manual.
2. Detener Node. Revisar y ejecutar **007_mensualidades.sql**. No repetir 001–005 ya aplicadas. 007 crea historial de cuotas, auditoría de ajustes y configuración con inicio NULL. Agrega fechas de ingreso/retiro nullable sin inventarlas. La cuota actual se registra como conocida desde el mes de preparación, nunca antes.
3. Revisar **010_verificar_mensualidades.sql** y completar manualmente solo fechas respaldadas por expedientes. fecha_registro no se supone fecha real de ingreso. No asignar fecha de retiro a antiguos inactivos por aproximación. Quien no tenga fecha_ingreso o un inactivo sin fecha_retiro queda excluido. Para nuevos registros desde esta versión, el ingreso es el día de alta; el retiro captura el día de baja si el ingreso está verificado. Este modelo contempla una estancia continua, no reingresos (no existe esa operación en el sistema).
4. Mantener **CORREO_HABILITADO=false** y **MENSUALIDADES_AUTOMATICAS=false** en el entorno de pruebas. No copiar .env.example sobre .env; solo el desarrollador configura las variables necesarias.
5. Ejecutar 006 y 010 (solo lectura). Iniciar con npm start. Crear los residentes y operaciones de QA exclusivamente desde el navegador. No existe ningún paso de carga de datos por SQL.
6. Probar mensualidades manuales, cambios de cuota, ajustes, pagos, interfaz y permisos. Ejecutar npm test desde la raíz para las pruebas simuladas.
7. **Solo después de aprobar las pruebas:** revisar **009_activar_mensualidades.sql**, establecer @Inicio al primer día del mes aprobado (no anterior al mes de 007) y @AutorizarActivacion=1. El script exige fechas de ingreso de activos con cuota positiva. Después configurar MENSUALIDADES_AUTOMATICAS=true y reiniciar Node. 009 por sí solo no genera cargos.

Antes de 007 el servidor continúa arrancando y las funciones financieras anteriores siguen disponibles; generar o previsualizar mensualidades requiere 007 y responde con una explicación si falta. La nueva automatización y los ajustes requieren 007. Aplicar 007 antes de utilizar cambios de cuota con vigencia futura. Si hay una migración 007 parcial, se rechazan las operaciones que dependen de ella.

### Funcionamiento automático y cambios de cuota

Al activar las dos condiciones (variable true + inicio explícito), Node revisa al arrancar y cada hora todos los meses desde inicio hasta el mes actual. Recupera únicamente las mensualidades faltantes de estancias conocidas y cuotas históricas conocidas. Incluye meses pendientes hasta el retiro de un residente actualmente inactivo cuando ambas fechas están verificadas. No reinterpreta ni actualiza cargos ya emitidos.

Cada mes se procesa en una transacción con el mismo sp_getapplock que el resto de Finanzas. La restricción UNIQUE residente/período impide duplicar cargos incluso con reinicios o múltiples procesos. El aviso se inserta junto al cargo y tiene su propia clave única; SMTP sigue independiente y posterior al COMMIT. Una falla revierte ese mes y la revisión siguiente puede recuperarlo. No hay cargos anteriores al mes aprobado ni meses futuros. No se prorratea ingreso/retiro: cualquier estancia durante el mes genera la cuota completa, siempre que el ingreso ya haya ocurrido al procesar.

Cambiar cuota en Editar residente crea una revisión del historial **desde el siguiente mes** y actualiza la cuota configurada; el mensaje de éxito informa el mes en español y el año. Ejemplo: cambiar Q 4,000 a Q 1,000 en octubre conserva octubre y todo cargo ya emitido; noviembre aún no generado usa Q 1,000. Las revisiones posteriores del mismo período se conservan y prevalece la última. Cambiar otros datos sin variar la cuota no crea revisiones.

Para corregir una mensualidad emitida: Cuenta → movimiento del cargo → Ver → Corregir mensualidad. Indicar importe y motivo. Se conserva importe anterior/nuevo, usuario y fecha; ningún pago se modifica. El importe corregido debe ser igual o superior a los abonos ya aplicados. La transacción rechaza una pantalla obsoleta o saldo imposible. Los movimientos muestran el cargo original y cada ajuste como variación separada; la corrección no cuenta como efectivo recibido ni como un pago. Revertir un ajuste requiere otro ajuste motivado. No hay anulación silenciosa.

### QA exclusivamente desde el navegador

La carga SQL de datos ficticios está **cancelada**. sql/008_datos_demo.sql queda archivado como descartado, con THROW y RETURN incondicionales antes de su contenido histórico. No es una migración pendiente ni un paso operativo. El salto de numeración de 007 a 009 es intencional. 010 fue renombrado y ahora verifica todas las cuentas sin depender de nombres, DPI ni escenarios ficticios.

Con CORREO_HABILITADO=false y MENSUALIDADES_AUTOMATICAS=false:

1. Crear un residente de QA en la copia, con responsable y cuota Q 4,000. Revisar ficha automática y actualizar su correo desde Estado de Cuenta. El ingreso nuevo se registra con la fecha local del alta.
2. Generar manualmente el mes actual individual, revisar nombre/importe y confirmar. Repetir para comprobar que no aparece como pendiente de generar. Probar también lote y buscador por nombre, apellido y DPI. Para meses anteriores usar solo una estancia con ingreso histórico verificado manualmente; no falsear fechas de personas reales para probar.
3. Recibir un abono de Q 1,000. Revisar aplicaciones, comprobante, movimientos y saldo Q 3,000. Intentar un importe mayor que el saldo y comprobar que el formulario conserva el error.
4. Cambiar cuota a Q 1,000 en Editar residente. Verificar el mes y año informados. La mensualidad ya emitida sigue en Q 4,000. En Ver cargo, corregir explícitamente a Q 2,500 con motivo: el saldo queda Q 1,500 y aparece un ajuste de -Q 1,500. Intentar una corrección inferior al abono acumulado: debe rechazarse.
5. Crear solicitud, programar con Fundación y registrar visita. Revisar cargo familiar y obligación por el neto guardado. Pagar parcialmente desde Cuenta: la obligación no cambia. Abonar desde Asilo a Fundación: comprobar saldo y el historial en ambos entornos.
6. Entrar como Fundación: Cobros pendientes del Asilo, cuatro resúmenes, detalle y pagos recibidos. No debe aparecer Pagar ni permitirse POST de pagos, consulta familiar o resumen administrativo. Probar Logout y navegación de ambos tipos.
7. Registrar donación y gasto desde sus formularios; comprobar que el resumen usa efectivo recibido/pagado y que las deudas no se cuentan como efectivo.
8. Ejecutar manualmente 006 y 010. Verificar ausencia de duplicados, sobrepagos y aplicaciones incompletas. Los ajustes deben enlazar importe anterior/nuevo y conservar los pagos.
9. Tras aprobar todo, probar 009 y la automatización **solo en la copia**. Reiniciar repetidamente y comprobar que cada residente/período y aviso aparece una sola vez. La recuperación multimes y el cambio de cuota al mes siguiente tienen pruebas simuladas; su comprobación real requiere avanzar naturalmente al siguiente período o un entorno de prueba aislado con reloj controlado. No cambiar reloj/datos de producción.

No habilitar SMTP durante QA. Las operaciones desde la interfaz pueden encolar avisos; Pendiente no significa enviado. Antes de habilitar correo en una instalación real, revisar destinatarios y excluir una cola de prueba: no usar la base de QA como producción ni trasladar su cola. Los datos creados por QA se identifican en su copia y se conservan para revisar; no hay borrado automático ni reinicio de IDs.

### Límites y revisión final

La verificación de estructura usa archivos y metadatos autorizados, no una ejecución de los scripts. Las pruebas automatizadas cubren cálculos, saldos, duplicados, cuotas, recuperación, retiro, permisos, formularios, trazabilidad, integridad clínica y verificación general de los scripts. Falta ejecutar T-SQL manualmente en la copia, revisar visualmente móvil/escritorio y recorrer el flujo manual; no se afirma que los mocks validen el motor real. No se habilitó SMTP, no se generaron cargos reales, no se implementó Reportes ni rework Cyberpunk.

## Cierre de QA: elegibilidad, fechas y notificaciones

Esta revisión no requiere otra migración SQL: usa las tablas de 005 y 007 y las restricciones UNIQUE ya existentes. No se ejecutó SQL ni se modificó .env. Generación automática y SMTP permanecen desactivados por defecto.

**Causas corregidas:** la consulta de mensualidades eliminaba los no elegibles y los cargos existentes antes de responder, por eso una selección anterior al ingreso parecía no hacer nada. Ahora devuelve la lista revisada con período, importe, elegibilidad y motivo; el resumen separa elegibles, existentes y omitidas. Después de confirmar informa generadas, existentes y omitidas. Sin elegibles el modal explica los motivos y no ofrece el botón de confirmar. El backend vuelve a evaluar bajo bloqueo transaccional. Se retiró el fallback a la cuota actual para períodos sin historial verificable; no se infieren cuotas antiguas. Las cuotas cero, fechas de ingreso desconocidas o retiros desconocidos también se explican.

**Presentación de pagos:** los movimientos muestran Mensualidad de octubre 2026 y Abono a mensualidad de octubre 2026; si el recibo aplica a varios cargos, Pago familiar aplicado a varios cargos. Los textos se calculan al consultar a partir de las aplicaciones existentes. No se modifican importes, conceptos almacenados ni distribuciones.

**Fechas compartidas:** frontend/compartido/formatos.js funciona en navegador y Node. Formatos.fecha muestra dd/mmm/aaaa; Formatos.periodo muestra mes y año; Formatos.dia conserva ISO para filtros. DATE y DATETIME civiles de SQL Server conservan el día de calendario, aunque mssql los serialice con Z. Los campos de auditoría creados con SYSUTCDATETIME usan fecha(valor,true) y se convierten explícitamente a America/Guatemala. No se convierten controles date, valores enviados a API, almacenamiento SQL ni claves de períodos. Entradas ambiguas como 09/10/2026 se rechazan como presentación inválida. Usuarios y dashboards sin fechas visibles únicamente cargan la utilidad; no se agregaron columnas nuevas a esas pantallas.

**Correos:** la cola existente guarda texto legible; el proceso SMTP genera una plantilla HTML escapada y envía también text. Cita incluye residente, especialidad, fecha y hora; cargo incluye concepto, importe, fecha, período (mes del cargo si no es mensualidad) y saldo; pago incluye comprobante, importe, fecha y saldo. No se consultan ni incorporan diagnósticos, tratamientos ni resultados para esas plantillas. Los avisos antiguos conservan su texto almacenado; esta revisión no reescribe la cola histórica. Notificaciones muestra ahora último intento además de estado, error y fecha enviada.

El correo se reclama después del COMMIT; las previsualizaciones/consultas no crean avisos. Clave de operación y UNIQUE evento/id_evento impiden duplicados. Fallar SMTP no revierte una operación financiera; una entrega incierta no se reintenta automáticamente.

### Prueba real controlada de un solo aviso (manual, no realizada por el agente)

1. Usar una copia aislada de QA. Detener Node y mantener CORREO_HABILITADO=false y MENSUALIDADES_AUTOMATICAS=false. Configurar el correo del responsable con una dirección controlada y autorizada por el equipo.
2. Iniciar Node; desde el navegador realizar **una operación real de QA**: programar cita, generar un cargo válido o registrar un pago. Verificar su confirmación y saldo. La consulta o previsualización no basta. Abrir Notificaciones y anotar el ID del aviso Pendiente y su destinatario. Detener Node.
3. El desarrollador configura manualmente SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM y SMTP_MESSAGE_DOMAIN según el proveedor. Usar credenciales de prueba; puerto 587 con SMTP_SECURE=false para STARTTLS o 465 con true. Nunca desactivar validación TLS.
4. Establecer **ambos** SMTP_SOLO_NOTIFICACION_ID (el ID anotado) y SMTP_DESTINATARIO_PRUEBA (el correo exacto del aviso). Este modo no redirige correos: únicamente permite reclamar un aviso cuyo ID y destinatario coinciden. Configuración parcial o inválida bloquea el envío. Dejar la automatización mensual apagada.
5. Cambiar CORREO_HABILITADO=true y arrancar Node. El proceso revisa cada 30 segundos. Confirmar recepción en el buzón y estado Enviada, último intento y fecha. Revisar texto plano/HTML, fecha española y cantidades. Otros pendientes no se envían mientras estén los dos filtros.
6. Reiniciar manteniendo los mismos filtros para confirmar que Enviada no se repite. Si aparece Incierta, revisar el Message-ID con el proveedor: no volverlo a Pendiente sin confirmar que no fue entregado.
7. Al terminar, detener Node, volver CORREO_HABILITADO=false y reiniciar. No quitar los filtros dejando el envío activo: eso habilitaría el resto de la cola. Repetir con un nuevo ID explícito para cada tipo de evento. No enviar avisos de QA a familiares reales ni reutilizar su cola en producción.

Variables disponibles en .env.example; el archivo .env real no fue alterado. Los filtros de prueba son opcionales y vacíos por defecto. La activación sin filtros se reserva para una cola y destinatarios revisados para operación normal.

### Archivos de esta intervención y comprobación manual

Backend: mensualidades.js, finanzas.js, notificaciones-correo.js y el mensaje de cambio de cuota en server.js. Frontend: compartido/formatos.js (nuevo); finanzas/finanzas.js; residentes/residentes.js; solicitudes/solicitudes.js; fundacion/solicitudes_fundacion.js y detalle_visita.js; HTML de módulos que cargan la utilidad. Configuración/documentación: .env.example y FINANZAS.md. Pruebas: formatos.test.js (nuevo), mensualidades.test.js, finanzas.test.js, finanzas-frontend.test.js, notificaciones.test.js y pruebas de Fundación/fichas/visitas adaptadas al formato compartido.

Ejecutar npm test y node --check sobre los JS. Probar en navegador enero para un residente ingresado en octubre (omisión explícita), mes posterior a retiro, mes sin cuota histórica, generación válida individual/lote, repetición y resumen. Revisar abonos simples/múltiples y fechas en listas, modales, comprobantes y correos. SQL/SMTP de las pruebas automatizadas son simulaciones; la entrega real y el comportamiento visual completo se verifican manualmente con el procedimiento anterior.

Resultado de esta revisión: 63 pruebas automatizadas satisfactorias; 30 archivos JavaScript comprobados con node --check. No se ejecutaron migraciones ni envíos reales.

## Clasificación y modalidad de pagos familiares

Registrar pago ofrece Pago general (FIFO por fecha e ID) y Mensualidad específica (solo las pendientes de la cuenta seleccionada). Un excedente sobre el cargo elegido se rechaza, aunque existan otros cargos pendientes. No hay un tercer tipo contable: parcial/completo describe cada aplicación según el saldo anterior, no una nueva clase de movimiento. La etiqueta de movimiento visible es Pago.

La previsualización devuelve residente, responsable, modalidad, concepto, importe, período y cada cargo con saldo anterior/resultante. POST /api/finanzas/pagos vuelve a calcular en la transacción bajo el bloqueo compartido, compara la huella y conserva la UUID de reintento. No se cambian las rutas ni la distribución general. No se alteran PagosFamiliares ni AplicacionesPagos históricos.

La modalidad, concepto y aplicaciones con sus saldos se guardan en el JSON resultado de OperacionesFinancieras, dentro de la misma transacción. El historial y el recibo utilizan esa instantánea; un ajuste posterior de la mensualidad no cambia la clasificación del pago nuevo. Para recibos anteriores sin instantánea se reconstruye la clasificación con aplicaciones previas por ID y ajustes vigentes al momento de registro; no se reescriben filas. Los correos nuevos indican modalidad y concepto; la cola y la protección contra duplicados permanecen iguales. No hace falta migración adicional.

Mensajes del formulario de pago: errores magenta #FF315D, confirmaciones amarillo #FCEE0A y éxitos cian sobre fondo oscuro. Se reutilizan el modal y los contenedores existentes; no hay alert/confirm nativos ni rediseño de otros módulos.

Archivos de esta intervención: backend/finanzas-calculos.js, backend/finanzas.js, frontend/finanzas/finanzas.js, frontend/finanzas/finanzas.css, tests/finanzas.test.js, tests/finanzas-frontend.test.js y FINANZAS.md.

### QA manual de pagos

En la copia de QA, mantener CORREO_HABILITADO=false y MENSUALIDADES_AUTOMATICAS=false. No usar cargos reales para pruebas.

1. Buscar una cuenta con mensualidad pendiente de Q 1,000 y otro cargo pendiente. Registrar pago → Mensualidad específica → elegir el período → monto Q 400 → revisar residente/familiar, saldo anterior Q 1,000, aplicación Q 400, resultado Q 600 → confirmar.
2. Ver historial y recibo: Abono a mensualidad del período, sin aplicación al otro cargo. Verificar un aviso Pago Pendiente con el concepto correspondiente.
3. Pagar Q 600 a la misma mensualidad: debe indicar Pago completo de mensualidad y saldo cero. Ya no debe aparecer en el selector de pendientes.
4. Probar otra mensualidad sin abonos: pagar su saldo completo en una operación. Después intentar un importe superior al saldo de una mensualidad pendiente: debe mostrar el error sin cerrar el formulario ni distribuir el excedente.
5. Elegir Pago general por un importe que cubra más de un cargo: comprobar orden fecha/ID, cada saldo y concepto Pago general aplicado a varios cargos. Comparar aplicaciones de previsualización y comprobante.
6. Abrir la misma cuenta en dos ventanas: previsualizar en ambas, confirmar una y después la otra. Si cambió el saldo, debe rechazarse o exigir nueva revisión. Doble clic/reintento del mismo formulario no debe generar otro recibo ni otro aviso.
7. Revisar totales, historial y fecha dd/mmm/aaaa. Opcionalmente ajustar una mensualidad después del pago: comprobar que el concepto del recibo nuevo conserva su clasificación original. No cambiar ni activar SMTP durante esta comprobación.

Pruebas de esta intervención: 68 satisfactorias, incluyendo generales, completos, parciales, segundo abono, excesos, selección inválida, concurrencia, idempotencia, recibos, avisos y formulario. SQL y SMTP simulados; falta el recorrido manual en navegador/SQL Server. No se ejecutaron migraciones ni se modificó .env.
