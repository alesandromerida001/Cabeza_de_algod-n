-- Inicialización manual SOLO Azure vacío. No importa datos locales.
SET XACT_ABORT ON;
IF CONVERT(int,SERVERPROPERTY('EngineEdition'))<>5 THROW 51000,'Solo Azure SQL Database.',1;
BEGIN TRY
 BEGIN TRAN;
 IF EXISTS(SELECT 1 FROM dbo.Usuarios WITH(UPDLOCK,HOLDLOCK)) THROW 51000,'Ya existen usuarios; revisar inicialización.',1;
 INSERT dbo.Roles(nombre,estado)
 SELECT nombre,'Activo' FROM (VALUES(N'Administrador'),(N'Médico Fundación')) v(nombre)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.Roles r WITH(UPDLOCK,HOLDLOCK) WHERE r.nombre=v.nombre);
 INSERT dbo.Especialidades(nombre,estado)
 SELECT nombre,'Activo' FROM (VALUES(N'Cardiología'),(N'Medicina Interna'),(N'Neurología'),(N'Geriatría'),(N'Traumatología')) v(nombre)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.Especialidades e WITH(UPDLOCK,HOLDLOCK) WHERE e.nombre=v.nombre);
 IF NOT EXISTS(SELECT 1 FROM dbo.FinanzasVersion WITH(UPDLOCK,HOLDLOCK) WHERE version=1)
 INSERT dbo.FinanzasVersion(version) VALUES(1);
 IF NOT EXISTS(SELECT 1 FROM dbo.ConfiguracionMensualidades WITH(UPDLOCK,HOLDLOCK) WHERE id=1)
 INSERT dbo.ConfiguracionMensualidades(id,preparado_el,inicio)
 VALUES(1,CONVERT(date,SWITCHOFFSET(SYSUTCDATETIME(),'-06:00')),NULL);
 COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
