> CAMBIO DE ALCANCE — 16/oct/2026: Azure comenzará SIN HISTÓRICOS. El procedimiento vigente es INICIO_LIMPIO.md. Las instrucciones siguientes de exportación/copia de datos quedan archivadas y NO deben ejecutarse. Se conserva 001_crear_esquema.sql para la estructura y 002_verificar_esquema.sql para verificación.

# Esquema de CabezaDeAlgodon para Azure SQL — 16/oct/2026

Inventario completo obtenido con VIEW DEFINITION=1. Ninguna definición permanece oculta. Se consultaron únicamente catálogos de SQL Server; no se exportaron registros, hashes de contraseñas ni credenciales.

## Archivos y alcance

- `metadatos.json`: fotografía completa de los metadatos reales, incluidas las definiciones de diagramas excluidas del despliegue.
- `inspeccionar.cjs`: recolector manual de metadatos de solo lectura. Usa la conexión privada existente, no inicia el backend ni SMTP.
- `generar.cjs`: generador offline; se detiene si aparecen características u objetos fuera del alcance comprobado. No ejecuta SQL.
- `001_crear_esquema.sql`: estructura completa de la aplicación, sin filas iniciales, usuarios SQL ni credenciales.
- `002_verificar_esquema.sql`: consultas de solo lectura para contrastar columnas, restricciones, índices e identidades en destino.
- `resumen.json`: conteos, exclusiones y orden topológico para la carga de datos.
- `CONTRASTE_BACKEND.md`: referencias de tablas y contraste de 115 columnas de INSERT explícitos, sin faltantes. No sustituye ejecución de consultas dinámicas en destino.
- `DATOS_DEMOSTRACION.md`: autorización, exportación consistente y carga preservando identidades/relaciones.
- `INVENTARIO_PARCIAL.md` y `metadatos-parciales.json`: evidencia de la inspección anterior sin permiso completo; quedan SUPERADOS por metadatos.json. No usar para generar ni verificar la migración.

## Objetos verificados

Local: 22 tablas, 186 columnas, 42 índices, 33 DEFAULT, 36 CHECK, 27 FK; siete procedimientos y una función. No hay vistas, triggers, secuencias ni tipos definidos por el usuario en el inventario completo.

Destino: 21 tablas, 181 columnas, 18 identidades, 21 PK, 9 restricciones UNIQUE y 10 índices adicionales (incluidos dos índices únicos filtrados), 33 DEFAULT, 36 CHECK y 27 FK. Se preservan nombres reales, longitudes, precisión/escala, nulabilidad, collation por columna, semillas/incrementos, acciones referenciales, columnas incluidas y filtros de índices. Todas las FK/CHECK locales están habilitadas y confiables. No se identificaron ciclos entre tablas; las PK/UNIQUE se crean antes de agregar las FK.

Únicas exclusiones: dbo.sysdiagrams y sus dos índices, sp_upgraddiagrams, sp_helpdiagrams, sp_helpdiagramdefinition, sp_creatediagram, sp_renamediagram, sp_alterdiagram, sp_dropdiagram y fn_diagramobjects. Son utilidades de diagramas de SSMS, sin referencias en backend. No hay módulos SQL de negocio que copiar. El permiso VIEW DEFINITION permitió descubrir sp_upgraddiagrams, antes oculto.

## Compatibilidad y límites

El DDL usa tipos y sentencias estándar soportados por Azure SQL Database: sin USE, CREATE DATABASE, archivos MDF/LDF, filegroups locales, logins de Windows ni procedimientos auxiliares de diagramas. No hay tablas temporales del sistema temporal, memoria optimizada, columnas calculadas, tipos CLR, particionamiento múltiple ni compresión que requieran adaptación. Se conserva collation Modern_Spanish_CI_AS. La base local usa compatibilidad 170 y READ_COMMITTED_SNAPSHOT=OFF; comprobar los valores del destino, especialmente el aislamiento de transacciones y la toma de cola, antes de activar la aplicación. No cambiar aislamiento automáticamente ni confundir coincidencia de esquema con igualdad de planes de ejecución.

Compatibilidad revisada de forma estática, NO certificada mediante ejecución en Azure. No se ejecutó este DDL ni siquiera contra la base local. Los índices no incluyen ubicaciones físicas locales; Azure administra almacenamiento. Los permisos de acceso SQL se asignan por separado con mínimo privilegio: no migrar el login local ni otorgar db_owner por comodidad.

## Pasos exactos pendientes

1. Crear manualmente una Azure SQL Database vacía con collation Modern_Spanish_CI_AS. Configurar conectividad/TLS y acceso del operador. Mantener los procesadores de correo y mensualidades desactivados en destino.
2. Revisar `001_crear_esquema.sql` y conectarse expresamente a la base destino desde SSMS. Ejecutarlo completo: tiene transacción con rollback ante error, exige EngineEdition=5 y rechaza destinos con tablas existentes. No es un script incremental ni debe ejecutarse en origen.
3. Ejecutar `002_verificar_esquema.sql`. La comparación de columnas debe dar cero diferencias; revisar conteos/nombres contra resumen.json y definiciones contra metadatos.json. No iniciar QA funcional hasta completar la carga de datos.
4. Aprobar expresamente qué registros DEMO se pueden exportar y seguir DATOS_DEMOSTRACION.md. Preservar IDs, hashes de usuarios aprobados, referencias, estados y saldos. Migrar las filas reales de catálogos, FinanzasVersion y ConfiguracionMensualidades. La estructura por sí sola no crea usuarios ni habilita Finanzas.
5. Si se elige BACPAC, usar una base NUEVA distinta: el paquete contiene su esquema, por lo que NO se combina con los pasos de creación anteriores. Nunca exportar un BACPAC con información sensible sin autorización.
6. Tras cargar datos, verificar relaciones, identidades, contadores, saldos e idempotencia; ejecutar QA de login, residentes, solicitudes, visitas, finanzas y PDFs. Probar concurrencia con el aislamiento real de Azure. No ejecutar automáticamente los scripts incrementales ni el antiguo script DEMO bloqueado.
7. Cambiar la conexión de App Service solo después de aprobar la copia; conservar la base local intacta. Mantener SMTP desactivado hasta revisar la cola copiada para no reenviar pendientes desde dos bases distintas.

Fuentes oficiales de referencia: https://learn.microsoft.com/en-us/data-migration/sql-server/database/guide y https://learn.microsoft.com/en-us/sql/t-sql/statements/alter-database-transact-sql-compatibility-level
