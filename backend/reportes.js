// Consultas de solo lectura. Ningún trabajo se ejecuta al montar este módulo.
const crypto = require('node:crypto');
const C = require('./finanzas-calculos');
const R = require('./reportes-calculos');
const MAX_FILAS = 5000;
const pacientes = `SELECT TOP(5001) h.id_residente,CONCAT(h.nombres,' ',h.apellidos) paciente,h.dpi,
    CONVERT(varchar(10),h.fecha_nacimiento,23) fecha_nacimiento,h.genero,h.tipo_sangre,h.alergias,h.diagnostico,
    CONVERT(varchar(10),h.fecha_ingreso,23) fecha_ingreso,
    CASE WHEN h.requiere_asistencia_especial=1 THEN COALESCE(h.descripcion_asistencia,'Requiere asistencia; descripción no registrada') ELSE 'No requiere asistencia especial' END asistencia,
    f.antecedentes,f.psicopatologias,f.padecimientos,f.medicamentos_habituales,f.observaciones
    FROM dbo.Huespedes h LEFT JOIN dbo.FichaMedica f ON f.id_residente=h.id_residente
    WHERE (@id IS NULL OR h.id_residente=@id) ORDER BY h.id_residente;`;
const identidad = `SELECT TOP(5001) h.id_residente,CONCAT(h.nombres,' ',h.apellidos) paciente
    FROM dbo.Huespedes h WHERE (@id IS NULL OR h.id_residente=@id) ORDER BY h.id_residente;`;
const visitas = `SELECT TOP(5001) v.*,s.id_residente,CONCAT(h.nombres,' ',h.apellidos) paciente,
    s.especialidad,s.medico,CONVERT(varchar(10),s.fecha_cita,23) fecha_cita,
    CONVERT(varchar(10),v.fecha_visita,23) fecha
    FROM dbo.VisitasMedicas v JOIN dbo.SolicitudesMedicas s ON s.id_solicitud=v.id_solicitud
    JOIN dbo.Huespedes h ON h.id_residente=s.id_residente
    WHERE (@id IS NULL OR s.id_residente=@id)
    AND (@desde IS NULL OR CONVERT(date,v.fecha_visita)>=@desde)
    AND (@hasta IS NULL OR CONVERT(date,v.fecha_visita)<=@hasta)
    ORDER BY v.fecha_visita,v.id_visita;`;
const cobros = `
    SELECT TOP(5001) c.*,v.costo_consulta,v.costo_examenes,v.costo_medicamentos,v.subtotal,v.descuento,v.total
    FROM dbo.CargosFamiliares c LEFT JOIN dbo.VisitasMedicas v ON v.id_visita=c.id_visita
    WHERE (@id IS NULL OR c.id_residente=@id) AND c.fecha<=@hasta ORDER BY c.fecha,c.id_cargo;
    SELECT TOP(5001) p.* FROM dbo.PagosFamiliares p WHERE (@id IS NULL OR p.id_residente=@id) AND p.fecha<=@hasta ORDER BY p.fecha,p.id_pago;
    SELECT TOP(5001) a.* FROM dbo.AplicacionesPagos a JOIN dbo.PagosFamiliares p ON p.id_pago=a.id_pago
    WHERE (@id IS NULL OR p.id_residente=@id) ORDER BY a.id_aplicacion;
    SELECT TOP(5001) a.*,c.id_residente,CONVERT(varchar(10),DATEADD(hour,-6,a.creado_en),23) fecha
    FROM dbo.AjustesMensualidades a JOIN dbo.CargosFamiliares c ON c.id_cargo=a.id_cargo
    WHERE (@id IS NULL OR c.id_residente=@id) AND c.fecha<=@hasta ORDER BY a.id_ajuste;
    SELECT TOP(5001) o.resultado FROM dbo.OperacionesFinancieras o JOIN dbo.PagosFamiliares p
    ON p.id_pago=TRY_CONVERT(int,JSON_VALUE(o.resultado,'$.pago.id_pago'))
    WHERE o.tipo='pago-familiar' AND (@id IS NULL OR p.id_residente=@id) AND p.fecha<=@hasta ORDER BY p.id_pago;`;
const fundacion = `
    SELECT TOP(5001) o.id_obligacion,o.id_visita,o.monto,CONCAT(h.nombres,' ',h.apellidos) paciente,
    CONVERT(varchar(10),DATEADD(hour,-6,o.creado_en),23) fecha,CONVERT(varchar(10),v.fecha_visita,23) fecha_visita
    FROM dbo.ObligacionesFundacion o JOIN dbo.VisitasMedicas v ON v.id_visita=o.id_visita
    JOIN dbo.SolicitudesMedicas s ON s.id_solicitud=v.id_solicitud JOIN dbo.Huespedes h ON h.id_residente=s.id_residente
    WHERE (@id IS NULL OR s.id_residente=@id) AND CONVERT(date,DATEADD(hour,-6,o.creado_en))<=@hasta ORDER BY o.id_obligacion;
    SELECT TOP(5001) p.id_pago_fundacion,p.id_obligacion,o.id_visita,p.monto,p.metodo,p.referencia,
    CONVERT(varchar(10),p.fecha,23) fecha,CONCAT(h.nombres,' ',h.apellidos) paciente
    FROM dbo.PagosFundacion p JOIN dbo.ObligacionesFundacion o ON o.id_obligacion=p.id_obligacion
    JOIN dbo.VisitasMedicas v ON v.id_visita=o.id_visita JOIN dbo.SolicitudesMedicas s ON s.id_solicitud=v.id_solicitud
    JOIN dbo.Huespedes h ON h.id_residente=s.id_residente
    WHERE (@id IS NULL OR s.id_residente=@id) AND p.fecha<=@hasta ORDER BY p.fecha,p.id_pago_fundacion;`;
const entradas = `SELECT TOP(5001) * FROM (
    SELECT CONVERT(varchar(10),p.fecha,23) fecha,N'Pago familiar' categoria,p.id_pago id,
    CONCAT(h.nombres,' ',h.apellidos) origen,COALESCE(JSON_VALUE(o.resultado,'$.concepto'),N'Pago familiar recibido') concepto,p.monto
    FROM dbo.PagosFamiliares p JOIN dbo.Huespedes h ON h.id_residente=p.id_residente
    OUTER APPLY (SELECT TOP(1) resultado FROM dbo.OperacionesFinancieras
        WHERE tipo='pago-familiar' AND TRY_CONVERT(int,JSON_VALUE(resultado,'$.pago.id_pago'))=p.id_pago ORDER BY creado_en,clave) o
    WHERE (@id IS NULL OR p.id_residente=@id) AND p.fecha BETWEEN @desde AND @hasta
    UNION ALL SELECT CONVERT(varchar(10),fecha,23),N'Donación',id_donacion,donante,descripcion,monto
    FROM dbo.Donaciones WHERE @id IS NULL AND estado='Confirmada' AND fecha BETWEEN @desde AND @hasta
    ) e ORDER BY fecha,categoria,id;`;
function consulta(codigo) {
    if(['R01','R02','R06','R07'].includes(codigo))return {sql:(codigo==='R02'?pacientes:identidad)+visitas,nombres:['pacientes','visitas']};
    if(codigo==='R03')return {sql:identidad+cobros,nombres:['pacientes','cargos','pagos','aplicaciones','ajustes','operaciones']};
    if(codigo==='R04')return {sql:identidad+fundacion,nombres:['pacientes','obligaciones','pagosFundacion']};
    return {sql:identidad+entradas,nombres:['pacientes','entradas']};
}
module.exports = function montar({app,sql,dbConfig,verificarToken}) {
    // Snapshots privados: exportar exactamente lo consultado, sin aceptar datos del navegador.
    const copias=new Map();let bytes=0,activas=0,exportaciones=0;
    function purgar() {for(const [id,c] of copias)if(c.vence<Date.now()){bytes-=c.bytes;copias.delete(id);}}
    function guardar(usuario,informe) {
        purgar();const size=Buffer.byteLength(JSON.stringify(informe));
        if(size>5*1024*1024)C.fallo('El reporte es demasiado grande. Reduzca el período o seleccione un paciente.',413);
        const propias=[...copias].filter(([,c])=>c.usuario===usuario);
        while(propias.length>=3){const [id,c]=propias.shift();copias.delete(id);bytes-=c.bytes;}
        while(bytes+size>30*1024*1024&&copias.size){const [id,c]=copias.entries().next().value;copias.delete(id);bytes-=c.bytes;}
        const token=crypto.randomUUID();copias.set(token,{usuario,informe,bytes:size,vence:Date.now()+10*60*1000});bytes+=size;return token;
    }
    function ruta(path,accion) { app.get(path,verificarToken,async(req,res)=>{
        res.set('Cache-Control','no-store');
        try {if(!['Asilo','Fundacion'].includes(req.usuario.tipo_personal))C.fallo('No tiene acceso a Reportes.',403);await accion(req,res);}
        catch(e){if(require('./config/errores-db').responder(e,res))return;if(!e.status)console.error('Reportes:',e);res.status(e.status||500).json({success:false,message:e.status?e.message:'No se pudo generar el reporte. Verifique las migraciones existentes o intente un período menor.'});}
    }); }
    ruta('/api/reportes',async(req,res)=>res.json({success:true,tipo_personal:req.usuario.tipo_personal,reportes:Object.entries(R.catalogo).filter(([id])=>R.permitido(req.usuario.tipo_personal,id)).map(([id,nombre])=>({id,nombre}))}));
    ruta('/api/reportes/exportar/:token/:formato',async(req,res)=>{
        purgar();const c=copias.get(req.params.token);
        if(!c||c.usuario!==req.usuario.id_usuario)C.fallo('La consulta expiró o no está disponible. Vuelva a consultar.',410);
        if(!R.permitido(req.usuario.tipo_personal,c.informe.codigo))C.fallo('No tiene acceso a este reporte.',403);
        if(req.params.formato!=='pdf')C.fallo('Únicamente está disponible la exportación PDF.');
        if(exportaciones>=2)C.fallo('Hay exportaciones en curso. Intente nuevamente en unos segundos.',503);
        if(c.informe.secciones.reduce((n,s)=>n+s.filas.length*s.columnas.length,0)>30000)C.fallo('Para un PDF legible y de tamaño razonable, reduzca el período o seleccione un paciente cuando corresponda.',413);
        exportaciones++;
        try {
            const E=require('./reportes-exportar'), buffer=await E.pdf(c.informe);
            res.set('Content-Type','application/pdf');
            res.set('Content-Disposition',`attachment; filename="${c.informe.codigo}-${c.informe.filtros.desde||'inicio'}-${c.informe.filtros.hasta||'actual'}.pdf"`);res.send(buffer);
        } finally {exportaciones--;}
    });
    ruta('/api/reportes/:codigo',async(req,res)=>{
        const codigo=req.params.codigo;
        if(!R.permitido(req.usuario.tipo_personal,codigo))C.fallo('No tiene acceso a este reporte.',403);
        const f=R.filtros(req.query,codigo),plan=consulta(codigo);
        if(activas>=4)C.fallo('Hay varias consultas en curso. Intente nuevamente en unos segundos.',503);
        activas++;let tx;
        try {
            const pool=await sql.connect(dbConfig);tx=new sql.Transaction(pool);
            // Una lectura consistente entre cargos/aplicaciones/ajustes, sin NOLOCK.
            await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const request=new sql.Request(tx,{requestTimeout:30000});
            const resultado=await request.input('id',sql.Int,f.idResidente).input('desde',sql.Date,f.desde).input('hasta',sql.Date,f.hasta).query(plan.sql);
            if(resultado.recordsets.some(rows=>rows.length>MAX_FILAS))C.fallo('Hay demasiados registros. Seleccione un paciente o reduzca el período. No se muestran resultados parciales.',413);
            await tx.commit();tx=null;
            const datos=Object.fromEntries(plan.nombres.map((n,i)=>[n,resultado.recordsets[i]]));
            if(f.idResidente&&!datos.pacientes.length)C.fallo('Residente no encontrado.',404);
            const informe=R.crear(codigo,datos,f),token=guardar(req.usuario.id_usuario,informe);
            res.json({success:true,informe,token});
        } finally {if(tx)try{await tx.rollback();}catch{}activas--;}
    });
};
module.exports.consulta=consulta;
