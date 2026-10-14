-- SOLO SELECT. Ejecutar manualmente después de 005, en la base del proyecto.
SELECT DB_NAME() base_actual;
SELECT version FROM dbo.FinanzasVersion;
SELECT name FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') AND name IN
('CargosFamiliares','PagosFamiliares','AplicacionesPagos','ObligacionesFundacion','PagosFundacion','Donaciones','Gastos','OperacionesFinancieras','NotificacionesCorreo','AuditoriaContactoFinanciero','FinanzasVersion');
-- Todas las siguientes consultas de anomalías deben devolver cero filas.
SELECT id_residente,periodo,COUNT(*) cantidad FROM dbo.CargosFamiliares WHERE periodo IS NOT NULL GROUP BY id_residente,periodo HAVING COUNT(*)>1;
SELECT id_visita,COUNT(*) cantidad FROM dbo.CargosFamiliares WHERE id_visita IS NOT NULL GROUP BY id_visita HAVING COUNT(*)>1;
SELECT c.id_cargo,c.monto,SUM(a.monto) aplicado FROM dbo.CargosFamiliares c JOIN dbo.AplicacionesPagos a ON a.id_cargo=c.id_cargo GROUP BY c.id_cargo,c.monto HAVING SUM(a.monto)>c.monto;
SELECT p.id_pago,p.monto,COALESCE(SUM(a.monto),0) aplicado FROM dbo.PagosFamiliares p LEFT JOIN dbo.AplicacionesPagos a ON a.id_pago=p.id_pago GROUP BY p.id_pago,p.monto HAVING COALESCE(SUM(a.monto),0)<>p.monto;
SELECT a.id_aplicacion FROM dbo.AplicacionesPagos a JOIN dbo.PagosFamiliares p ON p.id_pago=a.id_pago JOIN dbo.CargosFamiliares c ON c.id_cargo=a.id_cargo WHERE c.id_residente<>p.id_residente;
SELECT o.id_obligacion,o.monto,SUM(p.monto) pagado FROM dbo.ObligacionesFundacion o JOIN dbo.PagosFundacion p ON p.id_obligacion=o.id_obligacion GROUP BY o.id_obligacion,o.monto HAVING SUM(p.monto)>o.monto;
SELECT c.id_cargo,c.monto,v.total FROM dbo.CargosFamiliares c JOIN dbo.VisitasMedicas v ON v.id_visita=c.id_visita WHERE c.monto<>v.total;
SELECT o.id_obligacion,o.monto,v.total FROM dbo.ObligacionesFundacion o JOIN dbo.VisitasMedicas v ON v.id_visita=o.id_visita WHERE o.monto<>v.total;
SELECT evento,id_evento,COUNT(*) cantidad FROM dbo.NotificacionesCorreo GROUP BY evento,id_evento HAVING COUNT(*)>1;
-- Pendientes históricos: revisar en la interfaz, nunca insertar aquí automáticamente.
SELECT v.id_visita,v.id_solicitud,v.total,v.fecha_visita FROM dbo.VisitasMedicas v
WHERE NOT EXISTS(SELECT 1 FROM dbo.CargosFamiliares c WHERE c.id_visita=v.id_visita)
OR NOT EXISTS(SELECT 1 FROM dbo.ObligacionesFundacion o WHERE o.id_visita=v.id_visita);
SELECT estado,COUNT(*) cantidad FROM dbo.NotificacionesCorreo GROUP BY estado;
-- Incierta/Enviando no deben reenviarse sin verificar antes con el proveedor SMTP.
