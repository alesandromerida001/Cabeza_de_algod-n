-- SOLO LECTURA. Ejecutar manualmente después de 001, 002 y 003 en la BD correcta.
SELECT DB_NAME() AS base_actual;

-- Los cuatro IDs comunicados por el desarrollador deben aparecer como presentes.
SELECT esperados.id_usuario, CASE WHEN u.id_usuario IS NULL THEN 'FALTA' ELSE 'Presente' END AS resultado,
    u.rol AS rol_anterior, u.tipo_personal, u.id_rol, r.nombre AS cargo, u.estado
FROM (VALUES (13), (14), (15), (17)) esperados(id_usuario)
LEFT JOIN dbo.Usuarios u ON u.id_usuario = esperados.id_usuario
LEFT JOIN dbo.Roles r ON r.id_rol = u.id_rol;

-- Revisar otros IDs; esta consulta nunca elimina ni recupera cuentas.
SELECT id_usuario, rol, tipo_personal, id_rol, estado
FROM dbo.Usuarios WHERE id_usuario NOT IN (13, 14, 15, 17);

-- Debe devolver cero filas.
SELECT u.id_usuario, u.tipo_personal, u.id_rol
FROM dbo.Usuarios u LEFT JOIN dbo.Roles r ON r.id_rol = u.id_rol
WHERE u.tipo_personal IS NULL OR u.tipo_personal NOT IN ('Asilo', 'Fundacion')
    OR u.id_rol IS NULL OR r.id_rol IS NULL
    OR u.rol IS NULL OR u.rol NOT IN ('Admin', 'MedicoFundacion');

-- Ambas columnas deben tener is_nullable = 0.
SELECT name, TYPE_NAME(user_type_id) AS tipo, max_length, is_nullable
FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Usuarios')
    AND name IN ('tipo_personal', 'id_rol');

-- Ambas restricciones deben existir y mostrar 0 en is_disabled e is_not_trusted.
SELECT name, is_disabled, is_not_trusted, definition
FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.Usuarios')
    AND name = 'CK_Usuarios_TipoPersonal';
SELECT fk.name, fk.is_disabled, fk.is_not_trusted,
    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS columna,
    OBJECT_SCHEMA_NAME(fkc.referenced_object_id) AS esquema_destino,
    OBJECT_NAME(fkc.referenced_object_id) AS tabla_destino,
    COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS columna_destino
FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.Usuarios') AND fk.name = 'FK_Usuarios_Roles';

SELECT id_rol, nombre, estado FROM dbo.Roles ORDER BY nombre;
SELECT id_especialidad, nombre, estado FROM dbo.Especialidades ORDER BY nombre;
-- Deben devolver cero filas: nombres duplicados.
SELECT nombre, COUNT(*) AS cantidad FROM dbo.Roles GROUP BY nombre HAVING COUNT(*) > 1;
SELECT nombre, COUNT(*) AS cantidad FROM dbo.Especialidades GROUP BY nombre HAVING COUNT(*) > 1;
