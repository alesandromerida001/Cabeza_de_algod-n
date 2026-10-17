> CAMBIO DE ALCANCE — 16/oct/2026: Azure comenzará SIN HISTÓRICOS. El procedimiento vigente es INICIO_LIMPIO.md. Las instrucciones siguientes de exportación/copia de datos quedan archivadas y NO deben ejecutarse. Se conserva 001_crear_esquema.sql para la estructura y 002_verificar_esquema.sql para verificación.

# Migración de datos: procedimiento separado, todavía NO ejecutado

No se exportaron filas de negocio, hashes de usuarios, correos ni información clínica. El inventario JSON contiene únicamente metadatos. No hay credenciales en estos archivos.

## Alcance por aprobar

1. El operador debe identificar explícitamente qué residentes y movimientos son ficticios. No deducirlo por nombres ni asumir que todos los datos locales son DEMO. El script 008_datos_demo.sql está descartado y bloqueado por decisión anterior: no reactivarlo ni utilizarlo para sustituir los registros actuales.
2. Elegir copia completa solo si TODOS los registros son demostrativos y su exportación ha sido autorizada. De lo contrario, preparar una copia de trabajo separada con el subconjunto aprobado. No limpiar ni anonimizar la base original.
3. Preparar respaldo local bajo control del operador. Un .bak no se restaura directamente en Azure SQL Database. Para BACPAC, producir una copia consistente sin escrituras durante la exportación; pausar también SMTP y mensualidades en los procesos que apunten a esa copia. No detener procesos ni exportar información automáticamente en esta tarea.

## Cierre de relaciones y conservación

Conservar los IDs explícitos y referencias: Roles → Usuarios; Huespedes → FichaMedica/SolicitudesMedicas → VisitasMedicas → CargosFamiliares/ObligacionesFundacion. Incluir PagosFamiliares y AplicacionesPagos; PagosFundacion; CuotasResidentes, AjustesMensualidades y auditoría. Los autores, anuladores y usuarios referenciados deben existir, aunque no sean usuarios activos. No reasignar autorías para superar una FK.

También preservar los catálogos Especialidades y Roles, la fila de FinanzasVersion y la configuración real de ConfiguracionMensualidades. Un esquema vacío no permite iniciar sesión ni habilita Finanzas por sí solo. No inventar contraseñas, hashes, importes, fechas de ingreso ni configuración de mensualidades.

OperacionesFinancieras contiene claves de idempotencia y respuestas JSON que pueden referirse a IDs. NotificacionesCorreo contiene mensajes y destinatarios: es información potencialmente sensible, aun en una prueba. Una copia completa debe preservar esos registros y sus estados para auditoría, sin reactivar Enviadas o Inciertas. Para una copia parcial se requiere revisión explícita de esas referencias indirectas y del alcance de auditoría; una selección basada únicamente en FKs no basta.

## Dos rutas excluyentes

- BACPAC de una copia aprobada y consistente: importar a una base NUEVA; el paquete ya incluye esquema. No ejecutar previamente el script de creación en ese destino. Validar compatibilidad antes de exportar; no publicar el paquete en Git.
- Script de esquema + carga de datos aprobada: crear el esquema vacío y cargar padres antes que hijos. Utilizar listas explícitas de columnas y conservación de identidades (IDENTITY_INSERT por una tabla a la vez, o herramienta con KeepIdentity). Después ajustar el próximo valor de identidad en el DESTINO a partir de los máximos cargados y comprobar contadores. No reiniciar IDs en origen. Las tablas con referencias circulares requerirían una estrategia específica; consultar el inventario final.

No usar los scripts incrementales 001–009 para inicializar datos encima de una copia completa: podrían sembrar filas o cuotas diferentes. No recalcular costos de visitas, pagos, aplicaciones ni descuentos históricos.

## Verificación y activación

Comparar cantidades por tabla del alcance aprobado, IDs, relaciones huérfanas, FK/CHECK habilitadas y confiables, importes y saldos (cargos menos aplicaciones; obligaciones menos pagos), registros de idempotencia y estados de correo. Hacerlo con autorización de lectura de datos y conservar resultados sin información personal en el repositorio.

En App Service mantener CORREO_HABILITADO=false y MENSUALIDADES_AUTOMATICAS=false durante importación/QA. Nunca ejecutar simultáneamente origen y destino con correo habilitado sobre copias de la misma cola: un pendiente copiado podría enviarse dos veces desde bases independientes. Aprobar destinatarios de la copia antes de activar. No cambiar estados a Enviada ficticiamente para silenciar la cola.

Crear el usuario SQL de la aplicación mediante el mecanismo privado del operador (no migrar logins/passwords del servidor local). Tras comprobar esquema y datos, probar login, residentes, fichas, solicitudes, visitas, finanzas y PDFs. Conservar la base local como alternativa; el cambio de conexión será una operación posterior y autorizada.
