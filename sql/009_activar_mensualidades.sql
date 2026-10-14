-- OPCIONAL, MANUAL, DESPUÉS DE PRUEBAS. NO genera cargos por sí solo.
-- Revisar primero 010. Requiere también MENSUALIDADES_AUTOMATICAS=true y reiniciar Node.
DECLARE @AutorizarActivacion BIT=0;
DECLARE @Inicio DATE=NULL; -- Ejemplo: primer día del mes aprobado. Nunca anterior a 007.
IF @AutorizarActivacion<>1 OR @Inicio IS NULL
 THROW 51000,'Indique @Inicio y autorice expresamente la activación después de probar.',1;
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRAN;
 DECLARE @r INT;
 EXEC @r=sys.sp_getapplock @Resource='AsiloFinanzas',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @r<0 THROW 51000,'No se pudo reservar la configuración.',1;
 IF EXISTS(SELECT 1 FROM dbo.Huespedes WHERE estado='Activo' AND cuota_mensual>0 AND fecha_ingreso IS NULL)
  THROW 51000,'Hay residentes activos sin fecha de ingreso verificada. Complete las fechas antes de activar.',1;
 IF @Inicio>CONVERT(date,SWITCHOFFSET(SYSUTCDATETIME(),'-06:00')) OR DAY(@Inicio)<>1
  THROW 51000,'El inicio debe ser el primer día de un mes no futuro.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.ConfiguracionMensualidades WHERE id=1 AND inicio IS NULL)
  THROW 51000,'Configuración ausente o ya activada: no se cambia automáticamente el inicio.',1;
 UPDATE dbo.ConfiguracionMensualidades SET inicio=@Inicio WHERE id=1;
 COMMIT;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
