// Outbox: solo lee eventos ya confirmados. Nunca forma parte de la transacción financiera.
function plantilla(asunto, cuerpo) {
    const escapar = valor => String(valor ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return `<!doctype html><html lang="es"><body style="margin:0;background:#f3f5f7;color:#243447;font-family:Arial,sans-serif"><main style="max-width:600px;margin:24px auto;background:white;padding:28px;border-top:5px solid #194b79"><p>Asilo Cabeza de Algodón</p><h1 style="font-size:22px">${escapar(asunto)}</h1>${String(cuerpo ?? '').split('\n').map(linea=>`<p>${escapar(linea)}</p>`).join('')}<hr><p style="font-size:13px">Para consultas, comuníquese con la administración del Asilo. Este mensaje no contiene el historial clínico del residente.</p></main></body></html>`;
}
module.exports = function notificaciones({ pool, query, disponible, crearTransporte, entorno = process.env }) {
    const correoValido = valor => /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(valor || '');
    const prueba = () => Boolean(entorno.SMTP_SOLO_NOTIFICACION_ID || entorno.SMTP_DESTINATARIO_PRUEBA);
    const pruebaValida = () => !prueba() || (/^[1-9]\d*$/.test(entorno.SMTP_SOLO_NOTIFICACION_ID || '') && Number(entorno.SMTP_SOLO_NOTIFICACION_ID)<=2147483647 && correoValido(entorno.SMTP_DESTINATARIO_PRUEBA));
    const configurado = () => entorno.CORREO_HABILITADO === 'true'
        && [entorno.SMTP_HOST, entorno.SMTP_USER, entorno.SMTP_PASS, entorno.SMTP_FROM].every(valor => typeof valor === 'string' && valor.trim())
        && /^\d+$/.test(entorno.SMTP_PORT || '587') && Number(entorno.SMTP_PORT || 587) >= 1 && Number(entorno.SMTP_PORT || 587) <= 65535
        && [undefined, '', 'true', 'false'].includes(entorno.SMTP_SECURE) && pruebaValida();
    let ocupado = false, timer;
    async function procesarUna() {
        if (ocupado || !configurado()) return;
        ocupado = true;
        let db, evento;
        try {
            db = await pool();
            if (!await disponible(db)) return;
            // La prueba no modifica contactos ni estados de otros eventos de la cola.
            if (!prueba()) {
                // Una caída tras entregar a SMTP es ambigua: no reenviar automáticamente.
                await query(db, "UPDATE dbo.NotificacionesCorreo SET estado='Incierta',error=N'Proceso interrumpido; verificar entrega en SMTP antes de cualquier reenvío.' WHERE estado='Enviando' AND ultimo_intento<DATEADD(minute,-5,SYSUTCDATETIME())");
                // Un correo antes ausente se toma del contacto actual, sin cambiar los ya enviados.
                await query(db, `UPDATE n SET destinatario=h.correo_responsable FROM dbo.NotificacionesCorreo n JOIN dbo.Huespedes h ON h.id_residente=n.id_residente
                WHERE n.estado='Pendiente' AND n.destinatario IS NULL AND h.correo_responsable IS NOT NULL`);
            }
            evento = (await query(db, `;WITH siguiente AS(SELECT TOP(1) * FROM dbo.NotificacionesCorreo WITH(UPDLOCK,READPAST,READCOMMITTEDLOCK)
                WHERE estado='Pendiente' AND destinatario IS NOT NULL
                AND (@idPrueba IS NULL OR id_notificacion=@idPrueba)
                AND (@destinoPrueba IS NULL OR destinatario=@destinoPrueba) ORDER BY id_notificacion)
                UPDATE siguiente SET estado='Enviando',intentos=intentos+1,ultimo_intento=SYSUTCDATETIME(),error=NULL OUTPUT INSERTED.*;`, {
                    idPrueba: prueba() ? Number(entorno.SMTP_SOLO_NOTIFICACION_ID) : null,
                    destinoPrueba: prueba() ? entorno.SMTP_DESTINATARIO_PRUEBA : null
                })).recordset[0];
            if (!evento) return;
            if (!correoValido(evento.destinatario)) throw new Error('DESTINATARIO_INVALIDO');
            const crear = crearTransporte || require('nodemailer').createTransport;
            const transporte = crear({ host: entorno.SMTP_HOST, port: Number(entorno.SMTP_PORT || 587), secure: entorno.SMTP_SECURE === 'true', requireTLS: true,
                auth: { user: entorno.SMTP_USER, pass: entorno.SMTP_PASS }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, dnsTimeout: 10000,
                disableFileAccess: true, disableUrlAccess: true });
            const resultado = await transporte.sendMail({ from: entorno.SMTP_FROM, to: evento.destinatario, subject: evento.asunto, text: evento.cuerpo, html: plantilla(evento.asunto,evento.cuerpo),
                messageId: `<asilo-evento-${evento.id_notificacion}@${entorno.SMTP_MESSAGE_DOMAIN || 'asilo.local'}>` });
            if (!resultado.accepted?.length) throw new Error('NO_ACEPTADO');
            await query(db, "UPDATE dbo.NotificacionesCorreo SET estado='Enviada',enviado_en=SYSUTCDATETIME(),error=NULL WHERE id_notificacion=@id AND estado='Enviando'", { id: evento.id_notificacion });
        } catch (error) {
            if (evento && db) {
                try { await query(db, "UPDATE dbo.NotificacionesCorreo SET estado='Incierta',error=N'No se pudo confirmar la entrega. Revisar proveedor SMTP; no se reenvía automáticamente.' WHERE id_notificacion=@id AND estado='Enviando'", { id: evento.id_notificacion }); } catch (_) {}
            }
            console.error('Notificaciones: fallo de entrega o persistencia; revisar el registro de notificaciones.');
        } finally { ocupado = false; }
    }
    function iniciar() {
        if (timer) return;
        timer = setInterval(() => { void procesarUna(); }, 30000);
        timer.unref();
    }
    return { configurado, procesarUna, iniciar };
};
module.exports.plantilla = plantilla;
