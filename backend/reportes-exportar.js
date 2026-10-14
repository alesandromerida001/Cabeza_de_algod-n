const PDFDocument = require('pdfkit');
const path = require('node:path');
const F = require('../frontend/compartido/formatos');
function visible(value,type) {
    if(value == null || value === '')return 'No registrado';
    if(type==='fecha')return F.fecha(value);
    if(type==='moneda')return F.dinero(value);
    if(type==='porcentaje')return Number.isFinite(Number(value))?`${Number(value).toFixed(2)} %`:'No registrado';
    return String(value);
}
function filtros(r){return [r.codigo==='R05'?null:`Paciente: ${r.filtros.paciente}`,r.filtros.desde?`Desde: ${F.fecha(r.filtros.desde)}`:null,r.filtros.hasta?`Hasta: ${F.fecha(r.filtros.hasta)}`:null,!r.filtros.desde&&!r.filtros.hasta?'Historial completo':null].filter(Boolean).join(' | ');}
async function pdf(r) {
    return new Promise((resolve,reject)=>{
        const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,info:{Title:r.titulo,Author:'Asilo Cabeza de Algodón'}}),chunks=[];
        doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
        const fuentes=path.join(__dirname,'../frontend/reportes/fuentes');
        doc.registerFont('Contenido',path.join(fuentes,'IBMPlexSans-Regular.ttf'));
        doc.registerFont('Encabezado',path.join(fuentes,'IBMPlexSans-SemiBold.ttf'));
        const ancho=doc.page.width-84;
        const linea=(text,bold=false,size=10)=>{doc.font(bold?'Encabezado':'Contenido').fontSize(size).fillColor('#172a3d').text(text,{width:ancho,lineGap:3});doc.moveDown(.3);};
        linea('ASILO CABEZA DE ALGODÓN',true,16);linea(`${r.codigo} · ${r.titulo}`,true,14);
        linea(`Generado: ${F.fecha(r.generado,true)} (Guatemala)`);linea(filtros(r));
        for(const aviso of r.avisos)linea('Nota: '+aviso);
        linea('Resumen',true,12);for(const t of r.totales)linea(`${t.label}: ${visible(t.value,t.type)}`,true);
        for(const s of r.secciones){
            if(doc.y>doc.page.height-120)doc.addPage();linea(s.titulo,true,13);
            if(!s.filas.length)linea('Sin registros para los filtros seleccionados.');
            // Tabla campo/detalle por registro: mantiene legibles los textos clínicos extensos.
            s.filas.forEach((fila,i)=>{
                if(doc.y>doc.page.height-130)doc.addPage();linea(`Registro ${i+1}`,true,11);
                doc.font('Contenido').fontSize(10);
                doc.table({columnStyles:[{width:160},{width:ancho-160}],defaultStyle:{padding:6,border:0.5,borderColor:'#bac7d2'},data:[['Campo','Detalle'],...s.columnas.map(c=>[c.label,visible(fila[c.key],c.type)])]});
                doc.moveDown(.4);
            });
        }
        const paginas=doc.bufferedPageRange();
        for(let i=0;i<paginas.count;i++){
            doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;
            doc.font('Contenido').fontSize(8).fillColor('#555555').text(`${r.codigo} · Uso autorizado · Página ${i+1} de ${paginas.count}`,42,doc.page.height-25,{width:ancho,align:'center',lineBreak:false});doc.page.margins.bottom=bottom;
        }
        doc.end();
    });
}
module.exports={pdf,visible,filtros};
