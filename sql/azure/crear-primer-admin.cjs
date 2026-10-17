// Ejecutar manualmente con variables de proceso privadas. NO carga .env local.
const sql = require('mssql');
const bcrypt = require('bcrypt');
async function main({ verificar = false } = {}) {
    const e = process.env;
    const requeridas = ['AZURE_DB_SERVER','AZURE_DB_DATABASE','AZURE_DB_USER','AZURE_DB_PASSWORD'];
    if (!verificar) requeridas.push('ADMIN_NOMBRES','ADMIN_APELLIDOS','ADMIN_CORREO','ADMIN_PASSWORD');
    for (const k of requeridas) {
        if (!e[k]?.trim()) throw Object.assign(new Error('CONFIGURACION_INCOMPLETA'), { campo: k });
    }
    if (e.CONFIRMAR_BASE_AZURE !== e.AZURE_DB_DATABASE) throw new Error('CONFIRMACION_REQUERIDA');
    if (!verificar) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.ADMIN_CORREO.trim()) || e.ADMIN_CORREO.trim().length>100) throw new Error('CORREO_INVALIDO');
        if (e.ADMIN_NOMBRES.trim().length>100 || e.ADMIN_APELLIDOS.trim().length>100) throw new Error('NOMBRE_LARGO');
        if (e.ADMIN_PASSWORD.length<12 || Buffer.byteLength(e.ADMIN_PASSWORD,'utf8')>72) throw new Error('PASSWORD_LONGITUD');
    }
    const db = await new sql.ConnectionPool({server:e.AZURE_DB_SERVER,database:e.AZURE_DB_DATABASE,user:e.AZURE_DB_USER,password:e.AZURE_DB_PASSWORD,port:1433,options:{encrypt:true,trustServerCertificate:false}}).connect();
    let tx;
    try {
        const check=await db.request().query("SELECT CONVERT(int,SERVERPROPERTY('EngineEdition')) motor,DB_NAME() base");
        if(check.recordset[0].motor!==5 || check.recordset[0].base!==e.CONFIRMAR_BASE_AZURE)throw new Error('DESTINO_RECHAZADO');
        const previo = await db.request().query(`SELECT COUNT(*) usuarios FROM dbo.Usuarios;
            SELECT COUNT(*) roles FROM dbo.Roles WHERE nombre=N'Administrador' AND estado='Activo';
            SELECT t.name tabla,c.name columna,ty.name tipo,c.max_length,c.is_nullable,c.is_identity
            FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
            JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
            WHERE s.name='dbo' AND t.name IN('Usuarios','Roles') ORDER BY t.name,c.column_id;`);
        console.log('Usuarios existentes:', previo.recordsets[0][0].usuarios);
        console.log('Roles Administrador activos:', previo.recordsets[1][0].roles);
        if (verificar) {
            console.table(previo.recordsets[2]);
            console.log('Verificación de solo lectura completada. No se creó ningún usuario.');
            return;
        }
        if (previo.recordsets[0][0].usuarios !== 0) throw new Error('USUARIOS_EXISTENTES');
        if (previo.recordsets[1][0].roles !== 1) throw new Error('ROL_NO_DISPONIBLE');
        const hash=await bcrypt.hash(e.ADMIN_PASSWORD,10);
        tx=new sql.Transaction(db);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        await new sql.Request(tx)
            .input('nombres',sql.VarChar(100),e.ADMIN_NOMBRES.trim())
            .input('apellidos',sql.VarChar(100),e.ADMIN_APELLIDOS.trim())
            .input('correo',sql.VarChar(100),e.ADMIN_CORREO.trim().toLowerCase())
            .input('hash',sql.VarChar(100),hash)
            .query(`IF EXISTS(SELECT 1 FROM dbo.Usuarios WITH(TABLOCKX,HOLDLOCK)) THROW 51000,'Ya existen usuarios; no se crea ni cambia ninguna cuenta.',1;
                DECLARE @rol INT=(SELECT id_rol FROM dbo.Roles WHERE nombre=N'Administrador' AND estado='Activo');
                IF @rol IS NULL THROW 51000,'Inicialice el catálogo de roles.',1;
                INSERT dbo.Usuarios(nombres,apellidos,correo,telefono,contrasena,rol,estado,tipo_personal,id_rol)
                VALUES(@nombres,@apellidos,@correo,NULL,@hash,'Admin','Activo','Asilo',@rol);`);
        await tx.commit();tx=null;
        console.log('Primer administrador creado. No se imprimen credenciales.');
    } finally {
        if(tx)await tx.rollback().catch(()=>{});
        await db.close();
    }
}
function diagnostico(error) {
    const mensajes = {
        CONFIGURACION_INCOMPLETA: 'Falta una variable requerida.',
        CONFIRMACION_REQUERIDA: 'CONFIRMAR_BASE_AZURE debe coincidir exactamente con AZURE_DB_DATABASE.',
        DESTINO_RECHAZADO: 'La conexión no corresponde a Azure SQL Database o al nombre confirmado.',
        CORREO_INVALIDO: 'El correo debe tener formato válido y máximo 100 caracteres.',
        NOMBRE_LARGO: 'Nombres y apellidos admiten máximo 100 caracteres cada uno.',
        PASSWORD_LONGITUD: 'La contraseña del administrador requiere mínimo 12 caracteres y máximo 72 bytes UTF-8.',
        USUARIOS_EXISTENTES: 'Ya existen usuarios. No se creará ni modificará ninguna cuenta.',
        ROL_NO_DISPONIBLE: 'Debe existir exactamente un rol Administrador Activo; revise 003_datos_minimos.sql.'
    };
    if (Object.hasOwn(mensajes, error.message)) return mensajes[error.message] + (error.message==='CONFIGURACION_INCOMPLETA' && /^(AZURE_DB_(SERVER|DATABASE|USER|PASSWORD)|ADMIN_(NOMBRES|APELLIDOS|CORREO|PASSWORD))$/.test(error.campo || '') ? ' Variable: '+error.campo : '');
    const codigos = { ELOGIN:'Autenticación SQL rechazada. Revise usuario SQL y contraseña (no autenticación Entra).', ESOCKET:'Conexión/TLS fallida. Revise DNS, firewall Azure, puerto 1433 y certificado.', ETIMEOUT:'Tiempo de conexión o consulta agotado.', EREQUEST:'SQL rechazó la operación.', EABORT:'Transacción cancelada.' };
    const numeros = {18456:'Inicio de sesión SQL rechazado.',4060:'La base solicitada no está accesible.',40615:'Firewall Azure bloqueó la conexión.',229:'Permisos SQL insuficientes.',208:'Tabla requerida inexistente o no accesible.',207:'Columna requerida inexistente.',515:'Una columna obligatoria recibió NULL.',547:'Violación de CHECK o FK.',2601:'Valor duplicado en índice único.',2627:'Valor duplicado en restricción única.',2628:'Un valor excede la longitud de columna.',1205:'Conflicto concurrente; transacción elegida como víctima.',51000:'Protección SQL activada: usuario existente o rol ausente. Ejecute --verificar.'};
    const numero = error.number ?? error.originalError?.info?.number;
    return (codigos[error.code] || 'Fallo técnico no clasificado; no se muestra el mensaje original.') + (Number.isInteger(numero) ? ' SQL '+numero+': '+(numeros[numero] || 'Revisar diagnóstico privado en Azure.') : '');
}
if(require.main===module)main({verificar:process.argv.includes('--verificar')}).catch(error=>{console.error(diagnostico(error));console.error('Si se intentó el alta, comprobar --verificar antes de repetir: un fallo de conexión puede ocurrir después del commit.');process.exitCode=1;});
module.exports=main;
module.exports.diagnostico=diagnostico;
