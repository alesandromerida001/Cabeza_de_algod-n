-- Ejecutar manualmente en la BD del proyecto. No cambia SolicitudesMedicas.
-- VARCHAR(50) coincide con la columna histórica SolicitudesMedicas.especialidad.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID('dbo.Especialidades', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Especialidades (
            id_especialidad INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Especialidades PRIMARY KEY,
            nombre VARCHAR(50) NOT NULL CONSTRAINT UQ_Especialidades_Nombre UNIQUE,
            estado VARCHAR(20) NOT NULL CONSTRAINT DF_Especialidades_Estado DEFAULT 'Activo',
            CONSTRAINT CK_Especialidades_Estado CHECK (estado IN ('Activo', 'Inactivo')),
            CONSTRAINT CK_Especialidades_Nombre CHECK (LEN(LTRIM(RTRIM(nombre))) > 0)
        );
    END;
    INSERT INTO dbo.Especialidades (nombre, estado)
    SELECT nombre, 'Activo' FROM (
        SELECT CAST('Cardiología' AS VARCHAR(50)) AS nombre
        UNION SELECT 'Medicina Interna'
        UNION SELECT 'Neurología'
        UNION SELECT 'Geriatría'
        UNION SELECT 'Traumatología'
        UNION SELECT LTRIM(RTRIM(especialidad)) FROM dbo.SolicitudesMedicas
              WHERE especialidad IS NOT NULL AND LEN(LTRIM(RTRIM(especialidad))) > 0
    ) iniciales
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Especialidades e WITH (UPDLOCK, HOLDLOCK) WHERE e.nombre = iniciales.nombre);
    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
