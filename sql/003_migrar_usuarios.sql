-- REVISIÓN MANUAL OBLIGATORIA antes de ejecutar en SSMS, con Node detenido.
-- Esquema inspeccionado: dbo.Usuarios(id_usuario IDENTITY, correo VARCHAR(100),
-- contrasena VARCHAR(100), rol VARCHAR(50) NOT NULL, nombres, apellidos, telefono, estado).
-- Existen estados NULL: se preservan, junto con IDs, hash, correo y columna rol.
-- Solo Admin y MedicoFundacion; cualquier otro rol detiene la migración.
-- Los roles NO otorgan permisos; cualquier usuario Activo de tipo Asilo tiene acceso administrativo.
-- Ejecutar 001_roles.sql primero. Reejecutable: solo completa los campos nuevos vacíos.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL OR OBJECT_ID('dbo.Roles', 'U') IS NULL
        THROW 50001, 'Se requieren dbo.Usuarios y dbo.Roles. Ejecute 001_roles.sql primero.', 1;

    IF COL_LENGTH('dbo.Usuarios', 'tipo_personal') IS NULL
        ALTER TABLE dbo.Usuarios ADD tipo_personal VARCHAR(20) NULL;
    IF COL_LENGTH('dbo.Usuarios', 'id_rol') IS NULL
        ALTER TABLE dbo.Usuarios ADD id_rol INT NULL;

    -- SQL dinámico estático: compilar después de agregar columnas en la misma transacción.
    EXEC sys.sp_executesql N'
        DECLARE @Mapeo TABLE (anterior VARCHAR(50), tipo VARCHAR(20), nombre VARCHAR(100));
        INSERT INTO @Mapeo VALUES
            (''Admin'', ''Asilo'', ''Administrador''),
            (''MedicoFundacion'', ''Fundacion'', ''Médico Fundación'');

        IF EXISTS (SELECT 1 FROM dbo.Usuarios u
            WHERE NOT EXISTS (SELECT 1 FROM @Mapeo m WHERE m.anterior = u.rol))
            THROW 50002, ''Rol histórico inesperado en Usuarios. Solo se admiten Admin y MedicoFundacion; no se aplicó la migración.'', 1;

        UPDATE u SET tipo_personal = COALESCE(u.tipo_personal, m.tipo), id_rol = COALESCE(u.id_rol, r.id_rol)
        FROM dbo.Usuarios u JOIN @Mapeo m ON m.anterior = u.rol
        JOIN dbo.Roles r ON r.nombre = m.nombre
        WHERE u.tipo_personal IS NULL OR u.id_rol IS NULL;

        IF EXISTS (SELECT 1 FROM dbo.Usuarios u LEFT JOIN dbo.Roles r ON r.id_rol = u.id_rol
            WHERE u.tipo_personal IS NULL OR u.tipo_personal NOT IN (''Asilo'', ''Fundacion'')
                OR u.id_rol IS NULL OR r.id_rol IS NULL)
            THROW 50003, ''Usuarios sin tipo o rol válido. Se revierte la migración.'', 1;

        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(''dbo.Usuarios'') AND name = ''tipo_personal'' AND is_nullable = 1)
            ALTER TABLE dbo.Usuarios ALTER COLUMN tipo_personal VARCHAR(20) NOT NULL;
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(''dbo.Usuarios'') AND name = ''id_rol'' AND is_nullable = 1)
            ALTER TABLE dbo.Usuarios ALTER COLUMN id_rol INT NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(''dbo.Usuarios'') AND name = ''CK_Usuarios_TipoPersonal'')
            ALTER TABLE dbo.Usuarios WITH CHECK ADD CONSTRAINT CK_Usuarios_TipoPersonal
                CHECK (tipo_personal IN (''Asilo'', ''Fundacion''));
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(''dbo.Usuarios'') AND name = ''FK_Usuarios_Roles'')
            ALTER TABLE dbo.Usuarios WITH CHECK ADD CONSTRAINT FK_Usuarios_Roles
                FOREIGN KEY (id_rol) REFERENCES dbo.Roles(id_rol);
        ALTER TABLE dbo.Usuarios WITH CHECK CHECK CONSTRAINT CK_Usuarios_TipoPersonal;
        ALTER TABLE dbo.Usuarios WITH CHECK CHECK CONSTRAINT FK_Usuarios_Roles;
    ';
    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;

-- Verificación sin mostrar contraseñas ni información personal.
EXEC sys.sp_executesql N'
    SELECT u.tipo_personal, r.nombre AS rol, u.estado, COUNT(*) AS cantidad
    FROM dbo.Usuarios u JOIN dbo.Roles r ON r.id_rol = u.id_rol
    GROUP BY u.tipo_personal, r.nombre, u.estado;
';
