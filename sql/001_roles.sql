-- Ejecutar manualmente en la BD del proyecto, antes de 003_migrar_usuarios.sql.
-- No elimina ni reemplaza roles existentes. Se puede volver a ejecutar.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID('dbo.Roles', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Roles (
            id_rol INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL CONSTRAINT UQ_Roles_Nombre UNIQUE,
            estado VARCHAR(20) NOT NULL CONSTRAINT DF_Roles_Estado DEFAULT 'Activo',
            CONSTRAINT CK_Roles_Estado CHECK (estado IN ('Activo', 'Inactivo')),
            CONSTRAINT CK_Roles_Nombre CHECK (LEN(LTRIM(RTRIM(nombre))) > 0)
        );
    END;
    INSERT INTO dbo.Roles (nombre, estado)
    SELECT nombre, 'Activo'
    FROM (VALUES (CAST('Administrador' AS VARCHAR(100))), ('Médico Fundación')) iniciales(nombre)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Roles r WITH (UPDLOCK, HOLDLOCK) WHERE r.nombre = iniciales.nombre);
    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
