-- SOLO LECTURA. Verificación general después de 007 y del QA manual.
-- No depende de residentes de demostración. 006 continúa siendo válido.
SELECT * FROM dbo.ConfiguracionMensualidades;
SELECT id_residente,nombres,apellidos,estado,fecha_ingreso,fecha_retiro
FROM dbo.Huespedes WHERE fecha_ingreso IS NULL OR (estado='Inactivo' AND fecha_retiro IS NULL);
SELECT id_residente,periodo,COUNT(*) duplicados FROM dbo.CargosFamiliares
WHERE tipo='Mensualidad' GROUP BY id_residente,periodo HAVING COUNT(*)>1;
SELECT c.id_cargo,c.monto,SUM(a.monto) abonado FROM dbo.CargosFamiliares c
JOIN dbo.AplicacionesPagos a ON a.id_cargo=c.id_cargo GROUP BY c.id_cargo,c.monto HAVING SUM(a.monto)>c.monto;
SELECT a.* FROM dbo.AjustesMensualidades a ORDER BY id_ajuste;
-- Cada salto debe enlazar el importe nuevo anterior; la última revisión debe coincidir con el cargo.
WITH revisiones AS (
 SELECT a.*,LAG(importe_nuevo) OVER(PARTITION BY id_cargo ORDER BY id_ajuste) previo,
 ROW_NUMBER() OVER(PARTITION BY id_cargo ORDER BY id_ajuste DESC) ultimo FROM dbo.AjustesMensualidades a
)
SELECT r.*,c.monto FROM revisiones r JOIN dbo.CargosFamiliares c ON c.id_cargo=r.id_cargo
WHERE (r.previo IS NOT NULL AND r.importe_anterior<>r.previo) OR (r.ultimo=1 AND r.importe_nuevo<>c.monto);
-- Saldos por residente: contrastar con Estado de Cuenta y pagos a Fundación.
SELECT h.id_residente,h.dpi,h.nombres,h.apellidos,c.cargos,p.pagos,c.cargos-p.pagos saldo_familiar,
       o.obligaciones,f.abonos,o.obligaciones-f.abonos saldo_fundacion
FROM dbo.Huespedes h
CROSS APPLY(SELECT COALESCE(SUM(monto),0) cargos FROM dbo.CargosFamiliares WHERE id_residente=h.id_residente)c
CROSS APPLY(SELECT COALESCE(SUM(monto),0) pagos FROM dbo.PagosFamiliares WHERE id_residente=h.id_residente)p
CROSS APPLY(SELECT COALESCE(SUM(ob.monto),0) obligaciones FROM dbo.ObligacionesFundacion ob JOIN dbo.VisitasMedicas v ON v.id_visita=ob.id_visita JOIN dbo.SolicitudesMedicas s ON s.id_solicitud=v.id_solicitud WHERE s.id_residente=h.id_residente)o
CROSS APPLY(SELECT COALESCE(SUM(pf.monto),0) abonos FROM dbo.PagosFundacion pf JOIN dbo.ObligacionesFundacion ob ON ob.id_obligacion=pf.id_obligacion JOIN dbo.VisitasMedicas v ON v.id_visita=ob.id_visita JOIN dbo.SolicitudesMedicas s ON s.id_solicitud=v.id_solicitud WHERE s.id_residente=h.id_residente)f
ORDER BY h.id_residente;
-- Debe devolver cero filas: pagos que no se aplicaron íntegramente.
SELECT p.id_pago,p.monto,COALESCE(SUM(a.monto),0) aplicado FROM dbo.PagosFamiliares p
LEFT JOIN dbo.AplicacionesPagos a ON a.id_pago=p.id_pago GROUP BY p.id_pago,p.monto
HAVING p.monto<>COALESCE(SUM(a.monto),0);
-- Debe devolver cero filas: obligaciones sobrepagadas.
SELECT o.id_obligacion,o.monto,COALESCE(SUM(p.monto),0) pagado FROM dbo.ObligacionesFundacion o
LEFT JOIN dbo.PagosFundacion p ON p.id_obligacion=o.id_obligacion GROUP BY o.id_obligacion,o.monto
HAVING COALESCE(SUM(p.monto),0)>o.monto;
-- Debe devolver cero filas: eventos de correo duplicados.
SELECT evento,id_evento,COUNT(*) cantidad FROM dbo.NotificacionesCorreo GROUP BY evento,id_evento HAVING COUNT(*)>1;
-- Pendiente no significa enviado. Mantener CORREO_HABILITADO=false durante QA.
SELECT estado,COUNT(*) cantidad FROM dbo.NotificacionesCorreo GROUP BY estado;
