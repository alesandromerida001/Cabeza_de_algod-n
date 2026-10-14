-- REVISIÓN Y EJECUCIÓN MANUAL. Respaldar; detener Node. No genera cargos.
-- Las fechas antiguas deben verificarse manualmente: NO se inventan ingresos/retiros.
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRAN;
 IF OBJECT_ID('dbo.FinanzasVersion','U') IS NULL THROW 51000,'Primero aplique 005_finanzas.sql.',1;
 IF COL_LENGTH('dbo.Huespedes','fecha_ingreso') IS NULL ALTER TABLE dbo.Huespedes ADD fecha_ingreso DATE NULL;
 IF COL_LENGTH('dbo.Huespedes','fecha_retiro') IS NULL ALTER TABLE dbo.Huespedes ADD fecha_retiro DATE NULL;
 IF OBJECT_ID('dbo.ConfiguracionMensualidades','U') IS NULL
 BEGIN
  CREATE TABLE dbo.ConfiguracionMensualidades (
   id INT NOT NULL PRIMARY KEY CHECK(id=1),
   preparado_el DATE NOT NULL,
   inicio DATE NULL,
   CONSTRAINT CK_Mensualidades_Inicio CHECK(inicio IS NULL OR (DAY(inicio)=1 AND inicio>=DATEFROMPARTS(YEAR(preparado_el),MONTH(preparado_el),1)))
  );
  INSERT dbo.ConfiguracionMensualidades(id,preparado_el,inicio)
  VALUES(1,CONVERT(date,SWITCHOFFSET(SYSUTCDATETIME(),'-06:00')),NULL);
 END;
 IF OBJECT_ID('dbo.CuotasResidentes','U') IS NULL
  CREATE TABLE dbo.CuotasResidentes (
   id_cuota INT IDENTITY PRIMARY KEY,
   id_residente INT NOT NULL REFERENCES dbo.Huespedes(id_residente),
   desde DATE NOT NULL CHECK(DAY(desde)=1),
   monto DECIMAL(10,2) NOT NULL CHECK(monto>=0),
   creado_por INT NULL REFERENCES dbo.Usuarios(id_usuario),
   creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
 -- Varias revisiones del mismo período se preservan: prevalece el último id_cuota.
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_CuotasResidentes_Periodo' AND object_id=OBJECT_ID('dbo.CuotasResidentes'))
  CREATE INDEX IX_CuotasResidentes_Periodo ON dbo.CuotasResidentes(id_residente,desde,id_cuota) INCLUDE(monto);
 DECLARE @mes DATE=DATEFROMPARTS(YEAR(SWITCHOFFSET(SYSUTCDATETIME(),'-06:00')),MONTH(SWITCHOFFSET(SYSUTCDATETIME(),'-06:00')),1);
 INSERT dbo.CuotasResidentes(id_residente,desde,monto)
 SELECT h.id_residente,@mes,h.cuota_mensual FROM dbo.Huespedes h
 WHERE NOT EXISTS(SELECT 1 FROM dbo.CuotasResidentes c WHERE c.id_residente=h.id_residente);
 IF OBJECT_ID('dbo.AjustesMensualidades','U') IS NULL
  CREATE TABLE dbo.AjustesMensualidades (
   id_ajuste INT IDENTITY PRIMARY KEY,
   id_cargo INT NOT NULL REFERENCES dbo.CargosFamiliares(id_cargo),
   importe_anterior DECIMAL(12,2) NOT NULL CHECK(importe_anterior>=0),
   importe_nuevo DECIMAL(12,2) NOT NULL CHECK(importe_nuevo>=0),
   motivo NVARCHAR(500) NOT NULL CHECK(LEN(LTRIM(RTRIM(motivo)))>0),
   creado_por INT NOT NULL REFERENCES dbo.Usuarios(id_usuario),
   creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
   CHECK(importe_anterior<>importe_nuevo)
  );
 IF OBJECT_ID('dbo.CK_Huespedes_FechasEstancia','C') IS NULL
  EXEC('ALTER TABLE dbo.Huespedes WITH CHECK ADD CONSTRAINT CK_Huespedes_FechasEstancia CHECK(fecha_retiro IS NULL OR (fecha_ingreso IS NOT NULL AND fecha_retiro>=fecha_ingreso))');
 COMMIT;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
