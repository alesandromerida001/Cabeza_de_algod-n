// Generación offline desde metadatos completos, sin conexión ni ejecución SQL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const m=require('./metadatos.json'),q=s=>'['+s.replace(/]/g,']]')+']';
assert.equal(m.database[0].vista_completa,1);
const excluded=['sp_upgraddiagrams','sp_helpdiagrams','sp_helpdiagramdefinition','sp_creatediagram','sp_renamediagram','sp_alterdiagram','sp_dropdiagram','fn_diagramobjects'];
assert(m.modules.every(x=>x.definition&&x.esquema==='dbo'&&excluded.includes(x.name)),'Módulos requieren revisión');
assert(!m.triggers.length&&!m.types.length&&!m.sequences.length);
const tables=m.tables.filter(t=>!(t.esquema==='dbo'&&t.name==='sysdiagrams'));const ids=new Set(tables.map(t=>t.object_id));
assert(tables.every(t=>t.esquema==='dbo'&&!t.temporal_type&&!t.is_memory_optimized&&!t.is_filetable));
const cols=m.columns.filter(c=>ids.has(c.object_id)),indexes=m.indexes.filter(i=>ids.has(i.object_id));
assert(cols.every(c=>!c.is_computed&&!c.is_sparse&&!c.is_user_defined&&!c.generated_always_type));
assert(indexes.every(i=>[1,2].includes(i.type)&&!i.is_disabled));
assert(m.partitions.every(p=>p.partition_number===1&&p.data_compression_desc==='NONE'));
const name=id=>{const t=tables.find(t=>t.object_id===id);assert(t);return q(t.esquema)+'.'+q(t.name);};
const column=(id,cid)=>{const c=cols.find(c=>c.object_id===id&&c.column_id===cid);assert(c);return q(c.name);};
const fks=m.fks.filter(f=>ids.has(f.parent_object_id));assert(fks.every(f=>ids.has(f.referenced_object_id)&&!f.is_disabled&&!f.is_not_trusted&&!f.is_not_for_replication));
const ordered=[];let remaining=[...tables];while(remaining.length){const next=remaining.find(t=>fks.filter(f=>f.parent_object_id===t.object_id&&f.referenced_object_id!==t.object_id).every(f=>ordered.some(p=>p.object_id===f.referenced_object_id)));assert(next,'Ciclo: revisar orden de carga');ordered.push(next);remaining=remaining.filter(t=>t!==next);}
function type(c){let s=q(c.tipo);if(['varchar','char','varbinary','binary','nvarchar','nchar'].includes(c.tipo))s+='('+(c.max_length===-1?'MAX':c.max_length/(['nvarchar','nchar'].includes(c.tipo)?2:1))+')';else if(['decimal','numeric'].includes(c.tipo))s+='('+c.precision+','+c.scale+')';else if(['datetime2','datetimeoffset','time'].includes(c.tipo))s+='('+c.scale+')';return s;}
let sql=`-- Generado de metadatos reales, 16/oct/2026. SOLO esquema; sin datos ni credenciales.
-- Ejecutar MANUALMENTE conectado a una Azure SQL Database VACÍA.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
IF CONVERT(int,SERVERPROPERTY('EngineEdition')) <> 5 THROW 51000,'Solo Azure SQL Database; no ejecutar en la base local.',1;
IF EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0) THROW 51000,'Destino no vacío; no se modifica el esquema existente.',1;
IF CONVERT(nvarchar(128),DATABASEPROPERTYEX(DB_NAME(),'Collation')) <> N'Modern_Spanish_CI_AS' THROW 51000,'Crear destino con collation Modern_Spanish_CI_AS.',1;
BEGIN TRY
BEGIN TRANSACTION;
`;
for(const t of ordered){sql+='\nCREATE TABLE '+name(t.object_id)+' (\n'+cols.filter(c=>c.object_id===t.object_id).map(c=>'    '+q(c.name)+' '+type(c)+(c.collation_name?' COLLATE '+c.collation_name:'')+(c.is_identity?' IDENTITY('+c.semilla+','+c.incremento+')'+(c.is_not_for_replication?' NOT FOR REPLICATION':''):'')+(c.is_rowguidcol?' ROWGUIDCOL':'')+(c.is_nullable?' NULL':' NOT NULL')).join(',\n')+'\n);\n';}
for(const d of m.defaults.filter(d=>ids.has(d.parent_object_id))){assert(d.definition);sql+='ALTER TABLE '+name(d.parent_object_id)+' ADD CONSTRAINT '+q(d.name)+' DEFAULT '+d.definition+' FOR '+column(d.parent_object_id,d.parent_column_id)+';\n';}
for(const c of m.checks.filter(c=>ids.has(c.parent_object_id))){assert(c.definition&&!c.is_disabled&&!c.is_not_trusted&&!c.is_not_for_replication);sql+='ALTER TABLE '+name(c.parent_object_id)+' WITH CHECK ADD CONSTRAINT '+q(c.name)+' CHECK '+c.definition+';\n';}
for(const i of indexes){const ic=m.indexColumns.filter(c=>c.object_id===i.object_id&&c.index_id===i.index_id);const keys=ic.filter(c=>c.key_ordinal>0).sort((a,b)=>a.key_ordinal-b.key_ordinal).map(c=>column(i.object_id,c.column_id)+(c.is_descending_key?' DESC':' ASC')).join(', ');const included=ic.filter(c=>c.is_included_column).map(c=>column(i.object_id,c.column_id));
assert(Number.isInteger(i.fill_factor) && i.fill_factor >= 0 && i.fill_factor <= 100, 'FILLFACTOR fuera de rango');
// sys.indexes usa 0 para el valor predeterminado; no emitirlo como porcentaje en Azure.
const options=` WITH (PAD_INDEX = ${i.is_padded?'ON':'OFF'}${i.fill_factor === 0 ? '' : ', FILLFACTOR = ' + i.fill_factor}, IGNORE_DUP_KEY = ${i.ignore_dup_key?'ON':'OFF'}, ALLOW_ROW_LOCKS = ${i.allow_row_locks?'ON':'OFF'}, ALLOW_PAGE_LOCKS = ${i.allow_page_locks?'ON':'OFF'})`;
if(i.is_primary_key||i.is_unique_constraint)sql+='ALTER TABLE '+name(i.object_id)+' ADD CONSTRAINT '+q(i.name)+' '+(i.is_primary_key?'PRIMARY KEY':'UNIQUE')+' '+i.type_desc+' ('+keys+')'+options+';\n';else sql+='CREATE '+(i.is_unique?'UNIQUE ':'')+i.type_desc+' INDEX '+q(i.name)+' ON '+name(i.object_id)+' ('+keys+')'+(included.length?' INCLUDE ('+included.join(', ')+')':'')+(i.has_filter?' WHERE '+i.filter_definition:'')+options+';\n';}
for(const f of fks){const fc=m.fkColumns.filter(c=>c.constraint_object_id===f.object_id);sql+='ALTER TABLE '+name(f.parent_object_id)+' WITH CHECK ADD CONSTRAINT '+q(f.name)+' FOREIGN KEY ('+fc.map(c=>column(f.parent_object_id,c.parent_column_id)).join(', ')+') REFERENCES '+name(f.referenced_object_id)+' ('+fc.map(c=>column(f.referenced_object_id,c.referenced_column_id)).join(', ')+') ON DELETE '+f.delete_referential_action_desc.replaceAll('_',' ')+' ON UPDATE '+f.on_update.replaceAll('_',' ')+';\n';}
sql+='COMMIT TRANSACTION;\nEND TRY\nBEGIN CATCH\n    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;\n    THROW;\nEND CATCH;\n';
fs.writeFileSync(path.join(__dirname,'001_crear_esquema.sql'),sql);
const summary={tablas:tables.length,columnas:cols.length,identidades:cols.filter(c=>c.is_identity).length,pk:indexes.filter(i=>i.is_primary_key).length,unique:indexes.filter(i=>i.is_unique_constraint).length,indices_adicionales:indexes.filter(i=>!i.is_primary_key&&!i.is_unique_constraint).length,defaults:m.defaults.filter(d=>ids.has(d.parent_object_id)).length,checks:m.checks.filter(c=>ids.has(c.parent_object_id)).length,fk:fks.length,orden_carga:ordered.map(t=>t.name),excluidos:['sysdiagrams',...excluded]};
fs.writeFileSync(path.join(__dirname,'resumen.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
