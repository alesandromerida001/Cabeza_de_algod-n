-- 005. REVISIÓN Y EJECUCIÓN MANUAL. Node detenido y respaldo previo.
-- Metadatos consultados el 2026-10-07: no existían tablas financieras ni correo familiar.
-- No modifica importes médicos, usuarios ni datos históricos. Cada tabla nueva es aditiva.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
-- No reutilizar silenciosamente una tabla homónima de otra implementación.
IF OBJECT_ID('dbo.FinanzasVersion','U') IS NULL AND EXISTS (
    SELECT 1 FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') AND name IN
    ('CargosFamiliares','PagosFamiliares','AplicacionesPagos','ObligacionesFundacion','PagosFundacion','Donaciones','Gastos','OperacionesFinancieras','NotificacionesCorreo','AuditoriaContactoFinanciero'))
    THROW 50002, 'Existen tablas financieras sin versión. Revise su estructura antes de continuar; no se modificaron datos.', 1;
IF OBJECT_ID('dbo.Huespedes','U') IS NULL OR OBJECT_ID('dbo.VisitasMedicas','U') IS NULL
    THROW 50001, 'Faltan tablas base del proyecto.', 1;
IF COL_LENGTH('dbo.Huespedes','correo_responsable') IS NULL
    ALTER TABLE dbo.Huespedes ADD correo_responsable VARCHAR(254) NULL;
IF COL_LENGTH('dbo.Huespedes','correo_responsable') <> 254
    THROW 50003, 'El correo del responsable tiene un tamaño incompatible; revisar manualmente.', 1;
IF OBJECT_ID('dbo.CargosFamiliares','U') IS NULL
CREATE TABLE dbo.CargosFamiliares (id_cargo INT IDENTITY PRIMARY KEY, id_residente INT NOT NULL REFERENCES dbo.Huespedes(id_residente), id_visita INT NULL REFERENCES dbo.VisitasMedicas(id_visita), tipo VARCHAR(20) NOT NULL CHECK(tipo IN ('Mensualidad','Medico','Manual')), periodo CHAR(7) NULL, fecha DATE NOT NULL, concepto NVARCHAR(300) NOT NULL, monto DECIMAL(12,2) NOT NULL CHECK(monto>=0), creado_por INT NULL REFERENCES dbo.Usuarios(id_usuario), creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), CHECK ((tipo='Mensualidad' AND periodo IS NOT NULL AND id_visita IS NULL) OR (tipo='Medico' AND id_visita IS NOT NULL AND periodo IS NULL) OR (tipo='Manual' AND periodo IS NULL AND id_visita IS NULL)));
IF OBJECT_ID('dbo.PagosFamiliares','U') IS NULL
CREATE TABLE dbo.PagosFamiliares (id_pago INT IDENTITY PRIMARY KEY, id_residente INT NOT NULL REFERENCES dbo.Huespedes(id_residente), fecha DATE NOT NULL, monto DECIMAL(12,2) NOT NULL CHECK(monto>0), metodo NVARCHAR(50) NOT NULL, referencia NVARCHAR(150) NULL, observaciones NVARCHAR(1000) NULL, creado_por INT NULL REFERENCES dbo.Usuarios(id_usuario), creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('dbo.AplicacionesPagos','U') IS NULL
CREATE TABLE dbo.AplicacionesPagos (id_aplicacion INT IDENTITY PRIMARY KEY, id_pago INT NOT NULL REFERENCES dbo.PagosFamiliares(id_pago), id_cargo INT NOT NULL REFERENCES dbo.CargosFamiliares(id_cargo), monto DECIMAL(12,2) NOT NULL CHECK(monto>0), UNIQUE(id_pago,id_cargo));
IF OBJECT_ID('dbo.ObligacionesFundacion','U') IS NULL
CREATE TABLE dbo.ObligacionesFundacion (id_obligacion INT IDENTITY PRIMARY KEY, id_visita INT NOT NULL UNIQUE REFERENCES dbo.VisitasMedicas(id_visita), monto DECIMAL(12,2) NOT NULL CHECK(monto>=0), regla VARCHAR(60) NOT NULL DEFAULT 'Neto visita: provisional', creado_por INT NULL REFERENCES dbo.Usuarios(id_usuario), creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('dbo.PagosFundacion','U') IS NULL
CREATE TABLE dbo.PagosFundacion (id_pago_fundacion INT IDENTITY PRIMARY KEY, id_obligacion INT NOT NULL REFERENCES dbo.ObligacionesFundacion(id_obligacion), fecha DATE NOT NULL, monto DECIMAL(12,2) NOT NULL CHECK(monto>0), metodo NVARCHAR(50) NOT NULL, referencia NVARCHAR(150) NULL, observaciones NVARCHAR(1000) NULL, creado_por INT NULL REFERENCES dbo.Usuarios(id_usuario), creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('dbo.Donaciones','U') IS NULL
CREATE TABLE dbo.Donaciones (id_donacion INT IDENTITY PRIMARY KEY, donante NVARCHAR(150) NOT NULL, tipo_donante NVARCHAR(50) NOT NULL CHECK(tipo_donante IN (N'Empresa internacional',N'Empresa nacional',N'Gobierno',N'Particular')), fecha DATE NOT NULL, monto DECIMAL(12,2) NOT NULL CHECK(monto>0), descripcion NVARCHAR(1000) NOT NULL, referencia NVARCHAR(150) NULL, estado VARCHAR(20) NOT NULL DEFAULT 'Confirmada' CHECK(estado IN ('Confirmada','Anulada')), motivo_anulacion NVARCHAR(500) NULL, anulado_por INT NULL REFERENCES dbo.Usuarios(id_usuario), anulado_en DATETIME2 NULL, creado_por INT NULL REFERENCES dbo.Usuarios(id_usuario), creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), CHECK((estado='Confirmada' AND motivo_anulacion IS NULL AND anulado_en IS NULL) OR (estado='Anulada' AND motivo_anulacion IS NOT NULL AND anulado_en IS NOT NULL AND anulado_por IS NOT NULL)));
IF OBJECT_ID('dbo.Gastos','U') IS NULL
CREATE TABLE dbo.Gastos (id_gasto INT IDENTITY PRIMARY KEY, categoria NVARCHAR(50) NOT NULL CHECK(categoria IN (N'Agua',N'Energía eléctrica',N'Alimentación',N'Mantenimiento',N'Transporte',N'Servicios',N'Otros')), concepto NVARCHAR(300) NOT NULL, fecha DATE NOT NULL, monto DECIMAL(12,2) NOT NULL CHECK(monto>0), beneficiario NVARCHAR(150) NULL, referencia NVARCHAR(150) NULL, observaciones NVARCHAR(1000) NULL, estado VARCHAR(20) NOT NULL DEFAULT 'Confirmado' CHECK(estado IN ('Confirmado','Anulado')), motivo_anulacion NVARCHAR(500) NULL, anulado_por INT NULL REFERENCES dbo.Usuarios(id_usuario), anulado_en DATETIME2 NULL, creado_por INT NULL REFERENCES dbo.Usuarios(id_usuario), creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), CHECK((estado='Confirmado' AND motivo_anulacion IS NULL AND anulado_en IS NULL) OR (estado='Anulado' AND motivo_anulacion IS NOT NULL AND anulado_en IS NOT NULL AND anulado_por IS NOT NULL)));
IF OBJECT_ID('dbo.OperacionesFinancieras','U') IS NULL
CREATE TABLE dbo.OperacionesFinancieras (clave UNIQUEIDENTIFIER PRIMARY KEY, tipo VARCHAR(60) NOT NULL, id_usuario INT NOT NULL REFERENCES dbo.Usuarios(id_usuario), huella CHAR(64) NOT NULL, resultado NVARCHAR(MAX) NOT NULL, creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('dbo.NotificacionesCorreo','U') IS NULL
CREATE TABLE dbo.NotificacionesCorreo (id_notificacion INT IDENTITY PRIMARY KEY, evento VARCHAR(20) NOT NULL CHECK(evento IN ('Cita','Cargo','Pago')), id_evento INT NOT NULL, id_residente INT NOT NULL REFERENCES dbo.Huespedes(id_residente), destinatario VARCHAR(254) NULL, asunto NVARCHAR(200) NOT NULL, cuerpo NVARCHAR(MAX) NOT NULL, estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente','Enviando','Enviada','Incierta')), intentos INT NOT NULL DEFAULT 0 CHECK(intentos>=0), creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), ultimo_intento DATETIME2 NULL, enviado_en DATETIME2 NULL, error NVARCHAR(300) NULL, UNIQUE(evento,id_evento));
IF OBJECT_ID('dbo.AuditoriaContactoFinanciero','U') IS NULL
CREATE TABLE dbo.AuditoriaContactoFinanciero (id_cambio INT IDENTITY PRIMARY KEY, id_residente INT NOT NULL REFERENCES dbo.Huespedes(id_residente), correo_anterior VARCHAR(254) NULL, correo_nuevo VARCHAR(254) NULL, creado_por INT NULL REFERENCES dbo.Usuarios(id_usuario), creado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('dbo.FinanzasVersion','U') IS NULL
CREATE TABLE dbo.FinanzasVersion (version INT PRIMARY KEY CHECK(version=1));
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.CargosFamiliares') AND name='UQ_Cargo_Mes')
CREATE UNIQUE INDEX UQ_Cargo_Mes ON dbo.CargosFamiliares(id_residente,periodo) WHERE periodo IS NOT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.CargosFamiliares') AND name='UQ_Cargo_Visita')
CREATE UNIQUE INDEX UQ_Cargo_Visita ON dbo.CargosFamiliares(id_visita) WHERE id_visita IS NOT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.CargosFamiliares') AND name='IX_CargosFamiliares_Consulta') CREATE INDEX IX_CargosFamiliares_Consulta ON dbo.CargosFamiliares(id_residente,fecha,id_cargo);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.PagosFamiliares') AND name='IX_PagosFamiliares_Consulta') CREATE INDEX IX_PagosFamiliares_Consulta ON dbo.PagosFamiliares(id_residente,fecha);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.AplicacionesPagos') AND name='IX_AplicacionesPagos_Consulta') CREATE INDEX IX_AplicacionesPagos_Consulta ON dbo.AplicacionesPagos(id_cargo);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.PagosFundacion') AND name='IX_PagosFundacion_Consulta') CREATE INDEX IX_PagosFundacion_Consulta ON dbo.PagosFundacion(id_obligacion,fecha);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Donaciones') AND name='IX_Donaciones_Consulta') CREATE INDEX IX_Donaciones_Consulta ON dbo.Donaciones(fecha,estado);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Gastos') AND name='IX_Gastos_Consulta') CREATE INDEX IX_Gastos_Consulta ON dbo.Gastos(fecha,estado);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.NotificacionesCorreo') AND name='IX_NotificacionesCorreo_Consulta') CREATE INDEX IX_NotificacionesCorreo_Consulta ON dbo.NotificacionesCorreo(estado,id_notificacion);
IF NOT EXISTS(SELECT 1 FROM dbo.FinanzasVersion WHERE version=1) INSERT dbo.FinanzasVersion(version) VALUES(1);
COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT>0 ROLLBACK;
THROW;
END CATCH;
