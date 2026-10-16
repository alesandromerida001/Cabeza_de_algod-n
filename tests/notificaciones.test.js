const test = require('node:test');
const assert = require('node:assert/strict');
const crear = require('../backend/notificaciones-correo');
const configuracion = { CORREO_HABILITADO:'true',SMTP_HOST:'smtp.example.test',SMTP_USER:'test',SMTP_PASS:'simulado',SMTP_FROM:'asilo@example.test' };
function entorno(falla = false, config = configuracion) {
    const evento = { id_notificacion:1, destinatario:'familiar@example.test', asunto:'Pago recibido', cuerpo:'Monto: Q 50.00. Saldo: Q 25.00.', estado:'Pendiente', intentos:0 };
    const consultas = [], envios = [];
    const worker = crear({ entorno:config, pool:async()=>({}), disponible:async()=>true,
        query:async(db,q,parametros={})=>{
            consultas.push(q);
            if(q.includes('WITH siguiente')) {
                if(parametros.idPrueba && (parametros.idPrueba!==evento.id_notificacion || parametros.destinoPrueba!==evento.destinatario))return {recordset:[]};
                if(evento.estado!=='Pendiente')return {recordset:[]};
                evento.estado='Enviando';evento.intentos++;return {recordset:[{...evento}]};
            }
            if(q.includes("SET estado='Enviada'"))evento.estado='Enviada';
            if(q.includes("SET estado='Incierta'")&&q.includes('id_notificacion=@id'))evento.estado='Incierta';
            return {recordset:[]};
        },
        crearTransporte:opciones=>{
            assert.equal(opciones.requireTLS,true);assert.equal(opciones.socketTimeout,15000);
            return { async sendMail(mensaje){envios.push(mensaje);if(falla)throw new Error('SMTP no responde');return {accepted:[evento.destinatario]};} };
        }
    });
    return {worker,evento,consultas,envios};
}
test('sin SMTP configurado no intenta enviar ni afirma entrega',async()=>{
    const e=entorno(false,{});await e.worker.procesarUna();assert.equal(e.worker.configurado(),false);assert.equal(e.envios.length,0);assert.equal(e.consultas.length,0);assert.equal(e.evento.estado,'Pendiente');
});
test('correo entregado una sola vez con identificador de evento estable',async()=>{
    const e=entorno();await e.worker.procesarUna();await e.worker.procesarUna();assert.equal(e.envios.length,1);assert.equal(e.evento.intentos,1);assert.equal(e.evento.estado,'Enviada');assert.match(e.envios[0].messageId,/asilo-evento-1/);
});
test('plantilla HTML escapa datos y mantiene la versión de texto plano',async()=>{
    const e=entorno();e.evento.cuerpo='Fecha: 09/oct/2026\nImporte: Q 1,250.00\n<script>alert(1)</script>';
    await e.worker.procesarUna();const m=e.envios[0];assert.equal(m.text,e.evento.cuerpo);
    assert.match(m.html,/09\/oct\/2026/);assert.match(m.html,/Q 1,250.00/);assert.match(m.html,/&lt;script&gt;/);assert.doesNotMatch(m.html,/<script>/);
});
test('prueba controlada requiere ID y destinatario coincidentes; configuración incompleta no envía',async()=>{
    for(const [id,destino,esperados] of [['1','familiar@example.test',1],['2','familiar@example.test',0],['1','otro@example.test',0],['1','',0],['invalido','familiar@example.test',0]]){
        const e=entorno(false,{...configuracion,SMTP_SOLO_NOTIFICACION_ID:id,SMTP_DESTINATARIO_PRUEBA:destino});
        await e.worker.procesarUna();await e.worker.procesarUna();assert.equal(e.envios.length,esperados);
    }
});
test('fallo SMTP deja estado incierto, no repite y no afecta tablas financieras',async()=>{
    const e=entorno(true);await e.worker.procesarUna();await e.worker.procesarUna();assert.equal(e.evento.estado,'Incierta');assert.equal(e.envios.length,1);assert.ok(e.consultas.every(q=>!/(CargosFamiliares|PagosFamiliares|ObligacionesFundacion|ROLLBACK)/.test(q)));
});
test('procesamientos simultáneos en el mismo proceso no duplican envíos',async()=>{
    const e=entorno();await Promise.all([e.worker.procesarUna(),e.worker.procesarUna()]);assert.equal(e.envios.length,1);
});

test('correo desactivado o configuración inválida no accede a la cola',async()=>{
    for(const cambio of [{CORREO_HABILITADO:'false'}, {SMTP_PORT:'abc'}, {SMTP_PORT:'0'}, {SMTP_PORT:'65536'}, {SMTP_PORT:'1.5'}, {SMTP_SECURE:'verdadero'}, {SMTP_HOST:'   '}]) {
        const e=entorno(false,{...configuracion,...cambio});
        await e.worker.procesarUna();
        assert.equal(e.worker.configurado(),false);assert.equal(e.consultas.length,0);assert.equal(e.envios.length,0);
        assert.equal(e.evento.estado,'Pendiente');
    }
});

test('prueba seleccionada no ejecuta mantenimiento global ni modifica otras notificaciones',async()=>{
    const e=entorno(false,{...configuracion,SMTP_SOLO_NOTIFICACION_ID:'1',SMTP_DESTINATARIO_PRUEBA:'familiar@example.test'});
    await e.worker.procesarUna();await e.worker.procesarUna();
    assert.equal(e.envios.length,1);
    assert.ok(e.consultas.every(q=>q.includes('WITH siguiente') || q.includes('WHERE id_notificacion=@id')));
    assert.ok(e.consultas.filter(q=>q.includes('WITH siguiente')).every(q=>q.includes('id_notificacion=@idPrueba') && q.includes('destinatario=@destinoPrueba')));
});

test('fallo de persistencia después de aceptación SMTP no provoca reenvío',async()=>{
    let estado='Pendiente',envios=0;
    const worker=crear({entorno:configuracion,pool:async()=>({}),disponible:async()=>true,
        query:async(db,q)=>{
            if(q.includes('WITH siguiente') && estado==='Pendiente'){
                estado='Enviando';return {recordset:[{id_notificacion:5,destinatario:'familiar@example.test',asunto:'Pago',cuerpo:'Recibido'}]};
            }
            if(q.includes("SET estado='Enviada'"))throw new Error('Fallo simulado de persistencia');
            if(q.includes("SET estado='Incierta'") && q.includes('id_notificacion=@id'))estado='Incierta';
            return {recordset:[]};
        },crearTransporte:()=>({sendMail:async()=>{envios++;return {accepted:['familiar@example.test']};}})});
    await worker.procesarUna();await worker.procesarUna();
    assert.equal(estado,'Incierta');assert.equal(envios,1);
});
