# Centro de Reportes

Implementación de consulta y exportación. No crea datos, no ejecuta migraciones ni inicia procesos financieros o correo. Acceso desde ambos dashboards a `/reportes/reportes.html`.

## Alcance y datos disponibles

| Reporte | Resultado | Asilo | Fundación |
|---|---|---|---|
| R01 Costos de citas | Visitas, costos, porcentajes y descuento monetario almacenados; estadísticas por paciente/período | Sí | Sí |
| R02 Ficha y análisis | Identificación, ingreso registrado, ficha actual e historial de visitas del período | Sí | Sí |
| R03 Cobros | Apertura, cargos, ajustes, pagos, aplicaciones y cierre; desglose médico informativo | Sí | No |
| R04 Pagos a Fundación | Obligaciones, pagos parciales efectivos del período y saldo al cierre | Sí | Sí |
| R05 Entradas | Pagos familiares y donaciones confirmadas, separados y sumados como efectivo | Sí | No |
| R06 Exámenes registrados | Texto, resultados y costo conjunto de exámenes por visita | Sí | Sí |
| R07 Medicamentos registrados | Texto, cantidad, indicaciones y costo conjunto por visita | Sí | Sí |

**Limitaciones clínicas, visibles también en PDF:**

- No existe campo de motivo de ingreso/reclusión. No se usa diagnóstico ni motivo de solicitud en su lugar. `fecha_ingreso` puede faltar; nunca se sustituye por `fecha_registro`.
- R02 no es una ficha histórica a una fecha: refleja la ficha actual y filtra las visitas por fecha.
- R06 no certifica realización. Exámenes/resultados son textos agrupados, sin estado verificado ni costo individual por examen.
- R07 no certifica medicamentos administrados ni dispensados. No hay dosis estructurada ni constancia de administración; conserva literalmente cantidad e indicaciones. Completar esas evidencias exigiría un flujo clínico posterior, fuera de esta tarea.
- Los valores faltantes dicen «No registrado». Ningún importe histórico de visita se recalcula usando sus porcentajes.

## Fechas y contabilidad

R01/R04/R06/R07: residente opcional y rango obligatorio. R02: residente obligatorio, fechas opcionales e independientes para el historial. R03: residente y rango obligatorios. R05: solo rango, sin filtro de residente. Los filtros ocultos no se envían y el backend rechaza un residente en R05.

Rango inclusivo de fechas civiles, siempre parametrizado. Fechas visibles dd/mmm/aaaa en español; moneda Q con dos decimales. Los campos DATE y fechas de visitas conservan el día registrado. Los timestamps UTC de auditoría se convierten a Guatemala (UTC−6).

- R01/R06/R07 filtran por fecha de visita. R01 incluye fecha de cita cuando existe.
- R03 lee cargos/pagos anteriores al inicio para la apertura. Reconstruye el cargo original desde el primer ajuste y presenta cada diferencia en su fecha de auditoría. Incluye ajustes posteriores solo para reconstruir el importe original; no los suma en el período anterior. Los pagos conservan su fecha contable. Saldo inicial + cargos/ajustes − pagos = saldo final. El saldo de cada fila es del paciente, mientras las tarjetas totalizan la selección. Desglose médico y aplicaciones **no se suman otra vez**.
- La descripción de pagos reutiliza `describirPago` de Finanzas: comprobante existente si lo hay; en registros anteriores, aplicaciones y revisiones del cargo. No se actualizan pagos ni cargos.
- R04 fecha obligaciones por creación y muestra aparte la fecha de atención. Incluye obligaciones anteriores hasta el cierre y solo pagos hasta el cierre para su saldo. La tabla de efectivo muestra pagos del rango, incluso si fueron fechados antes de crear su obligación; ese caso lleva una advertencia explícita. No liquida deuda con pagos familiares.
- R05 usa pagos familiares y donaciones **actualmente confirmadas**, siguiendo Finanzas. No es reconstrucción del estado histórico de una donación anulada posteriormente. No admite filtro de residente; separa donaciones y pagos familiares en dos tablas. No cuenta cargos ni obligaciones como efectivo.

## Endpoints y seguridad

- `GET /api/reportes`: catálogo autorizado y tipo de personal.
- `GET /api/reportes/:codigo?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&id_residente=ID`: consulta; ID opcional.
- `GET /api/reportes/exportar/:token/pdf`

Todos usan `verificarToken` existente; no se cambió autenticación. Autorización adicional por `tipo_personal`, nunca por nombre de Rol. Cambiar manualmente URL o token no amplía acceso. El autocomplete reutiliza `/api/finanzas/residentes?q=...` para Asilo y `/api/huespedes/buscar?q=...` para Fundación, conservando sus permisos.

Consultas en lote, sin consultas por cada fila. Una transacción de lectura SERIALIZABLE mantiene coherencia entre cargos, aplicaciones y ajustes; no utiliza NOLOCK. Puede bloquear brevemente escrituras concurrentes; medir con el volumen real antes de producción. Timeout de consulta 30 segundos, máximo 4 consultas simultáneas de Reportes. El objetivo de 60 segundos **no se ha medido contra SQL Server real**.

Cada conjunto se limita a 5000 filas; si se excede se rechaza toda la consulta, sin truncar silenciosamente totales. Para reportes de saldo es necesario leer movimientos anteriores; reducir el rango por sí solo puede no bastar y conviene seleccionar un paciente.

Exportaciones a partir de una copia privada del resultado validado por servidor: misma consulta, datos y totales de pantalla. Caduca a los 10 minutos, al reiniciar Node o si el límite de memoria desplaza la copia. Máximo 3 copias por usuario, 5 MiB por informe y 30 MiB totales. Cabeceras `no-store`. Al cambiar filtros se deshabilita la exportación hasta consultar de nuevo. El estado de usuario/permisos vuelve a comprobarse al descargar. No se reciben filas ni totales desde el navegador.

Máximo 2 exportaciones simultáneas. PDF con más de 30000 celdas se rechaza solicitando acotar filtros. PDFKit genera tablas Campo/Detalle por registro para preservar textos clínicos extensos, totales y numeración de páginas. Fuentes IBM Plex Sans incrustadas. Rajdhani permanece como archivo original, pero no se utiliza: se encontraron discrepancias de límites en 85 glifos; se usa IBM Plex Sans SemiBold como alternativa segura. No existe exportación Excel, XLSX ni CSV.

## Archivos de esta entrega

Nuevos:

- `backend/reportes.js`
- `backend/reportes-calculos.js`
- `backend/reportes-exportar.js`
- `frontend/reportes/reportes.html`, `reportes.js`, `reportes.css`
- `tests/reportes.test.js`
- `REPORTES.md`

Modificados:

- `backend/server.js`: montaje del módulo, sin modificar rutas anteriores.
- `backend/finanzas-calculos.js`, `backend/finanzas.js`: extracción pequeña de descripción de pagos compartida con Reportes; mismo cálculo y flujo de escritura.
- `frontend/principal/admin_dashboard.html`, `frontend/fundacion/fundacion_dashboard.html`: enlaces al Centro de Reportes.
- `package.json`, `package-lock.json`: PDFKit. ExcelJS y su override fueron retirados del manifiesto y lockfile.
- `tests/catalogos.test.js`, `fundacion.test.js`, `visitas_realizadas.test.js`, `fichas_medicas.test.js`, `mensualidades.test.js`: reconocer el nuevo módulo en los entornos VM existentes.

## Instalación y migraciones

No hay nuevas migraciones. Requiere el esquema clínico y las migraciones de Finanzas ya aplicadas (005 y 007). No volver a ejecutarlas por esta entrega. Si faltan columnas/tablas se devuelve un mensaje genérico, conservando el detalle solo en el log del servidor.

En otro equipo, instalar el lockfile con `npm ci`. Ejecutar `npm test`; después reiniciar el servidor con `npm start`. Revisar primero la configuración de procesos ya existente: Reportes no modifica `.env` ni activa SMTP/mensualidades.

La auditoría previa de dependencias señaló avisos de proxy-addr y mssql/tedious/sprintf-js. No se realizaron actualizaciones ajenas de Express/SQL Server. Revisarlos por separado antes de despliegue.

## Verificación y QA manual

Las pruebas automatizadas no conectan a SQL Server ni SMTP. Cubren los siete reportes, vacíos, entradas inválidas, parámetros, permisos, límites, aislamiento de copias, totales, abonos, cambios de cuota, doble conteo, fechas Guatemala y exportaciones PDF reales con fixtures en memoria. Se revisaron PDF renderizado y pantalla escritorio/móvil con respuestas simuladas; no se insertó ningún fixture en la BD.

Resultado actualizado: 88 pruebas aprobadas; los siete reportes recorren sus rutas con SQL simulado y generan PDF reales. Se verificaron filtros dinámicos en navegador, incluidas fechas opcionales de R02 y ausencia de residente en R05. La única consulta ejecutada contra SQL Server real fue SELECT 1 para diagnóstico; las consultas completas requieren QA manual.

1. Iniciar sesión Asilo → Centro de Reportes; comprobar siete opciones y regreso al menú.
2. Buscar un residente por nombre y DPI, seleccionarlo, elegir rango y consultar. Cambiar filtros: la descarga debe quedar deshabilitada hasta volver a consultar. Probar rango invertido y sin datos.
3. R01: contrastar costos/descuento/total contra Visitas realizadas. Cambiar paciente y comprobar agrupación.
4. R02/R06/R07: contrastar ficha y textos clínicos. Comprobar avisos y «No registrado», sin afirmar administración ni realización.
5. R03: seleccionar una cuenta con saldo anterior, abonos y, si existe, ajuste. Comparar apertura + cargos/ajustes − pagos = cierre con el estado de cuenta. Comprobar referencias de aplicaciones y que el desglose médico no aumente los totales.
6. R04: comprobar una obligación con pago parcial anterior y otro dentro del período. Comparar efectivo del rango y saldo al cierre. Revisar cualquier aviso de fechas de pago anteriores a la creación de obligación.
7. R05: comparar pagos familiares y donaciones confirmadas con Finanzas para el mismo rango. No debe aparecer selector de residente; las tablas y subtotales deben separar donaciones y pagos familiares.
8. Descargar PDF de cada reporte: comparar filtros y totales contra pantalla; verificar tildes, tablas, paginación y fechas. La misma copia debe producir los mismos datos aunque cambie la BD después de consultar.
9. Iniciar sesión Fundación: solo R01/R02/R04/R06/R07. Intentar directamente R03/R05 debe devolver 403. Sesión cerrada debe devolver 401; token de otro usuario no descarga.
10. Probar con el volumen real y operaciones concurrentes. Medir consulta + exportación; revisar índices/planes antes de proponer cambios SQL si supera 60 segundos.

Pendiente: QA contra SQL Server real, medición con su volumen y evidencias clínicas que el esquema aún no captura. No se modificaron datos, autenticación, registro de visitas, algoritmos de aplicación de pagos ni procesos de correo/mensualidades.
