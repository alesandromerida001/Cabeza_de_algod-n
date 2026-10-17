// Solo metadatos: no lee filas de negocio ni ejecuta DDL. Ejecución manual.
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ quiet: true });
const sql = require('mssql');
async function main() {
    const db = await new sql.ConnectionPool(require('../../backend/config/db')).connect();
    try {
        const queries = {
            database: `SELECT DB_NAME() nombre, DATABASEPROPERTYEX(DB_NAME(),'Collation') collation, compatibility_level, is_read_committed_snapshot_on, HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION') vista_completa FROM sys.databases WHERE name=DB_NAME()`,
            objects: `SELECT o.object_id,s.name esquema,o.name,o.type,o.type_desc FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE o.is_ms_shipped=0 ORDER BY s.name,o.name`,
            tables: `SELECT t.object_id,s.name esquema,t.name,t.temporal_type,t.is_memory_optimized,t.is_filetable FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0`,
            columns: `SELECT c.object_id,c.column_id,c.name,ty.name tipo,ty.is_user_defined,c.max_length,c.precision,c.scale,c.is_nullable,c.collation_name,c.is_identity,c.is_computed,c.is_rowguidcol,c.is_sparse,c.generated_always_type,CONVERT(varchar(80),ic.seed_value) semilla,CONVERT(varchar(80),ic.increment_value) incremento,ic.is_not_for_replication,cc.definition calculada,cc.is_persisted FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.identity_columns ic ON ic.object_id=c.object_id AND ic.column_id=c.column_id LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id WHERE c.object_id IN(SELECT object_id FROM sys.tables WHERE is_ms_shipped=0) ORDER BY c.object_id,c.column_id`,
            defaults: `SELECT parent_object_id,parent_column_id,name,definition FROM sys.default_constraints WHERE is_ms_shipped=0`,
            checks: `SELECT parent_object_id,name,definition,is_disabled,is_not_trusted,is_not_for_replication FROM sys.check_constraints WHERE is_ms_shipped=0`,
            fks: `SELECT object_id,parent_object_id,referenced_object_id,name,delete_referential_action_desc,on_update=update_referential_action_desc,is_disabled,is_not_trusted,is_not_for_replication FROM sys.foreign_keys WHERE is_ms_shipped=0`,
            fkColumns: `SELECT constraint_object_id,constraint_column_id,parent_column_id,referenced_column_id FROM sys.foreign_key_columns ORDER BY constraint_object_id,constraint_column_id`,
            indexes: `SELECT i.object_id,i.index_id,i.name,i.type,i.type_desc,i.is_unique,i.is_primary_key,i.is_unique_constraint,i.is_disabled,i.has_filter,i.filter_definition,i.fill_factor,i.is_padded,i.ignore_dup_key,i.allow_row_locks,i.allow_page_locks FROM sys.indexes i JOIN sys.tables t ON t.object_id=i.object_id WHERE t.is_ms_shipped=0 AND i.index_id>0`,
            indexColumns: `SELECT ic.object_id,ic.index_id,ic.column_id,ic.key_ordinal,ic.is_descending_key,ic.is_included_column FROM sys.index_columns ic JOIN sys.tables t ON t.object_id=ic.object_id WHERE t.is_ms_shipped=0 ORDER BY ic.object_id,ic.index_id,ic.key_ordinal,ic.index_column_id`,
            modules: `SELECT o.object_id,s.name esquema,o.name,o.type,m.definition,m.uses_ansi_nulls,m.uses_quoted_identifier FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE o.is_ms_shipped=0 AND o.type IN('V','P','FN','IF','TF','TR','PC','FS','FT','AF')`,
            triggers: `SELECT name,parent_class_desc,parent_id,is_disabled,is_instead_of_trigger FROM sys.triggers WHERE is_ms_shipped=0`,
            sequences: `SELECT s.name esquema,q.name FROM sys.sequences q JOIN sys.schemas s ON s.schema_id=q.schema_id`,
            types: `SELECT s.name esquema,t.name,t.is_table_type,t.is_assembly_type FROM sys.types t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_user_defined=1`,
            dependencies: `SELECT referencing_id,referenced_id,referenced_database_name,referenced_server_name,referenced_schema_name,referenced_entity_name FROM sys.sql_expression_dependencies`,
            partitions: `SELECT p.object_id,p.index_id,p.partition_number,p.data_compression_desc FROM sys.partitions p JOIN sys.tables t ON t.object_id=p.object_id WHERE t.is_ms_shipped=0`
        };
        const metadata = {};
        for (const [key, query] of Object.entries(queries)) metadata[key] = (await db.request().query(query)).recordset;
        console.log(JSON.stringify(metadata.database));
        if (metadata.database[0]?.nombre !== 'CabezaDeAlgodon') throw new Error('Base inesperada.');
        const completo = metadata.database[0]?.vista_completa === 1;
        fs.writeFileSync(path.join(__dirname, completo ? 'metadatos.json' : 'metadatos-parciales.json'), JSON.stringify(metadata, null, 2) + '\n');
        if (!completo) console.log('ADVERTENCIA: inventario parcial; no generar esquema definitivo.');
        console.log(JSON.stringify(Object.fromEntries(Object.entries(metadata).map(([k,v])=>[k,v.length]))));
    } finally { await db.close(); }
}
main().catch(error => { console.error('Inspección fallida:', error.code || error.name); process.exitCode=1; });
