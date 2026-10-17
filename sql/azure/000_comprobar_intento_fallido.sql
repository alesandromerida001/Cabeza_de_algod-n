-- SOLO LECTURA. Ejecutar en la MISMA ventana SSMS del intento fallido.
SELECT DB_NAME() base_actual, CONVERT(int,SERVERPROPERTY('EngineEdition')) motor,
       @@TRANCOUNT transacciones_abiertas, XACT_STATE() estado_transaccion,
       HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION') puede_ver_definiciones;
SELECT s.name esquema,o.name objeto,o.type_desc
FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id
WHERE o.is_ms_shipped=0 ORDER BY o.type_desc,s.name,o.name;
SELECT COUNT(*) tablas_usuario FROM sys.tables WHERE is_ms_shipped=0;
-- Para reejecutar: base destino correcta, motor=5, transacciones=0,
-- permiso de metadatos completo y cero tablas/objetos de la aplicación.
-- Si hay transacción abierta u objetos, NO reejecutar ni borrar automáticamente.
-- Revisar con el operador; una consulta desde otra sesión no revela @@TRANCOUNT de esta sesión.
