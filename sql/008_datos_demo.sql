-- DESCARTADO POR DECISIÓN DEL USUARIO. NO FORMA PARTE DEL PROCESO.
-- Conservado únicamente como archivo histórico. QA se realiza desde el navegador.
-- Bloqueo incondicional: este archivo no puede cargar datos al ejecutarse por accidente.
THROW 51000,'Script 008 descartado. Cree los datos de QA manualmente desde el navegador.',1;
RETURN;
-- VERSIÓN HISTÓRICA NO UTILIZADA:
-- SOLO EN COPIA DE DEMOSTRACIÓN. NO EJECUTAR EN PRODUCCIÓN.
-- Detener Node. CORREO_HABILITADO=false y MENSUALIDADES_AUTOMATICAS=false.
-- Requiere 005 y 007. No inserta notificaciones. No crea usuarios.
-- Cambiar deliberadamente a 1 después de revisar la base, respaldo y este archivo.
DECLARE @AutorizarCarga BIT=0;
IF @AutorizarCarga<>1 THROW 51000,'Carga DEMO sin autorizar. Revise y cambie @AutorizarCarga a 1.',1;
IF DB_NAME() NOT LIKE '%DEMO%' THROW 51000,'Use exclusivamente una copia cuyo nombre contenga DEMO.',1;
IF HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION')<>1
 THROW 51000,'Se requiere VIEW DEFINITION para comprobar todos los disparadores.',1;
IF EXISTS(SELECT 1 FROM sys.triggers WHERE is_disabled=0)
 THROW 51000,'Hay disparadores habilitados. Revisarlos antes de cargar; este script no los desactiva.',1;
IF OBJECT_ID('dbo.ConfiguracionMensualidades','U') IS NULL THROW 51000,'Primero ejecute 007_mensualidades.sql.',1;
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRAN;
 DECLARE @lock INT;
 EXEC @lock=sys.sp_getapplock @Resource='AsiloFinanzas',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @lock<0 THROW 51000,'No se pudo reservar la carga DEMO.',1;
 -- Identificación permanente: DPI DEMO-CCA-A/B/C; conceptos, referencias y observaciones DEMO-CCA-2026.
 -- Detectar una carga previa incluso parcial: no tocar ni completar registros existentes.
 IF EXISTS(SELECT 1 FROM dbo.Huespedes WHERE dpi IN('DEMO-CCA-A','DEMO-CCA-B','DEMO-CCA-C'))
  THROW 51000,'Ya existen residentes DEMO-CCA. No se insertó nada. Revise la carga anterior.',1;
 IF EXISTS(SELECT 1 FROM dbo.Donaciones WHERE referencia LIKE 'DEMO-CCA-2026-%')
  OR EXISTS(SELECT 1 FROM dbo.Gastos WHERE referencia LIKE 'DEMO-CCA-2026-%')
  THROW 51000,'Ya existen movimientos DEMO-CCA. Revise antes de repetir la carga.',1;
 DECLARE @hoy DATE=CONVERT(date,SWITCHOFFSET(SYSUTCDATETIME(),'-06:00')),
         @mes DATE,@anterior DATE,@visita DATE;
 SET @mes=DATEFROMPARTS(YEAR(@hoy),MONTH(@hoy),1);
 SET @anterior=DATEADD(month,-1,@mes);
 SET @visita=DATEADD(day,-1,@hoy);
 DECLARE @escenarios TABLE(codigo CHAR(1) PRIMARY KEY,nombres VARCHAR(100),apellidos VARCHAR(100),cuota DECIMAL(10,2),pago DECIMAL(12,2),pago_fundacion DECIMAL(12,2));
 INSERT @escenarios VALUES
 ('A','Alba DEMO','Nube Ficticia',1000,1840,840),
 ('B','Bruno DEMO','Bosque Ficticio',1500,1200,300),
 ('C','Celina DEMO','Luna Ficticia',2000,0,0);
 DECLARE @codigo CHAR(1),@nombres VARCHAR(100),@apellidos VARCHAR(100),@cuota DECIMAL(10,2),@pago DECIMAL(12,2),@pagoFundacion DECIMAL(12,2);
 DECLARE @ids TABLE(codigo CHAR(1),id_residente INT,id_visita INT,id_obligacion INT);
 DECLARE residentes CURSOR LOCAL FAST_FORWARD FOR SELECT codigo,nombres,apellidos,cuota,pago,pago_fundacion FROM @escenarios ORDER BY codigo;
 OPEN residentes;
 FETCH NEXT FROM residentes INTO @codigo,@nombres,@apellidos,@cuota,@pago,@pagoFundacion;
 WHILE @@FETCH_STATUS=0
 BEGIN
  DECLARE @r INT,@s INT,@v INT,@o INT,@p INT,@cMedico INT,@cMes INT,@cAnterior INT=NULL;
  INSERT dbo.Huespedes(nombres,apellidos,dpi,fecha_nacimiento,genero,tipo_sangre,alergias,diagnostico,requiere_asistencia_especial,descripcion_asistencia,nombre_responsable,parentesco,telefono_emergencia,estado,fecha_registro,cuota_mensual,correo_responsable,fecha_ingreso)
  VALUES(@nombres,@apellidos,CONCAT('DEMO-CCA-',@codigo),'1950-01-15',CASE WHEN @codigo='B' THEN 'Masculino' ELSE 'Femenino' END,'O+','Ninguna en escenario ficticio','DEMO-CCA-2026: control preventivo ficticio',1,'Acompañamiento ficticio; sin prescripción real',CONCAT('Responsable ficticio DEMO ',@codigo),'Familiar DEMO','00000000','Activo',@anterior,@cuota,'alesandromerida001@gmail.com',@anterior);
  SET @r=CONVERT(INT,SCOPE_IDENTITY());
  INSERT dbo.CuotasResidentes(id_residente,desde,monto) VALUES(@r,@anterior,@cuota);
  INSERT dbo.FichaMedica(id_residente,psicopatologias,padecimientos,medicamentos_habituales,antecedentes,observaciones,fecha_actualizacion)
  VALUES(@r,'DEMO: sin antecedentes psicológicos','DEMO: control general','DEMO: suplemento ficticio, sin uso clínico','Persona completamente ficticia','DEMO-CCA-2026. No utilizar para decisiones médicas.',@anterior);
  INSERT dbo.SolicitudesMedicas(id_residente,motivo,especialidad,enfermero,fecha_solicitud,estado,medico,fecha_cita,hora_cita)
  VALUES(@r,'DEMO-CCA-2026: consulta preventiva ficticia','Medicina Interna','Enfermería DEMO',@anterior,'Finalizada','Profesional ficticio DEMO',@visita,'09:00');
  SET @s=CONVERT(INT,SCOPE_IDENTITY());
  INSERT dbo.VisitasMedicas(id_solicitud,diagnostico,examenes,resultados_examenes,costo_examenes,medicamentos,cantidad_medicamentos,indicaciones,costo_medicamentos,costo_consulta,subtotal,porcentaje_descuento,descuento,total,observaciones,fecha_visita,descuento_consulta_porcentaje,descuento_examenes_porcentaje,descuento_medicamentos_porcentaje)
  VALUES(@s,'Evaluación ficticia DEMO, sin diagnóstico real','Hemograma ficticio DEMO','Valores simulados dentro de referencia',300,'Suplemento ficticio DEMO','30 unidades ficticias','Indicaciones demostrativas; no administrar',200,500,1000,0,160,840,'DEMO-CCA-2026: datos clínicos ficticios',@visita,20,10,15);
  SET @v=CONVERT(INT,SCOPE_IDENTITY());
  INSERT dbo.CargosFamiliares(id_residente,id_visita,tipo,periodo,fecha,concepto,monto)
  VALUES(@r,NULL,'Mensualidad',CONVERT(CHAR(7),@mes,126),@mes,'DEMO-CCA-2026: mensualidad actual',@cuota);
  SET @cMes=CONVERT(INT,SCOPE_IDENTITY());
  IF @codigo IN('B','C')
  BEGIN
   INSERT dbo.CargosFamiliares(id_residente,tipo,periodo,fecha,concepto,monto)
   VALUES(@r,'Mensualidad',CONVERT(CHAR(7),@anterior,126),@anterior,'DEMO-CCA-2026: mensualidad anterior',@cuota);
   SET @cAnterior=CONVERT(INT,SCOPE_IDENTITY());
  END;
  INSERT dbo.CargosFamiliares(id_residente,id_visita,tipo,fecha,concepto,monto)
  VALUES(@r,@v,'Medico',@visita,'DEMO-CCA-2026: atención médica',840);
  SET @cMedico=CONVERT(INT,SCOPE_IDENTITY());
  INSERT dbo.ObligacionesFundacion(id_visita,monto) VALUES(@v,840);
  SET @o=CONVERT(INT,SCOPE_IDENTITY());
  IF @pago>0
  BEGIN
   INSERT dbo.PagosFamiliares(id_residente,fecha,monto,metodo,referencia,observaciones)
   VALUES(@r,@hoy,@pago,'Efectivo',CONCAT('DEMO-CCA-2026-FAMILIA-',@codigo),'Pago ficticio; no representa efectivo real');
   SET @p=CONVERT(INT,SCOPE_IDENTITY());
   IF @codigo='A'
    INSERT dbo.AplicacionesPagos(id_pago,id_cargo,monto) VALUES(@p,@cMes,1000),(@p,@cMedico,840);
   ELSE
    -- Distribución de demostración deliberada: ambas mensualidades y visita con abonos.
    -- La interfaz ordinaria mantiene su distribución FIFO.
    INSERT dbo.AplicacionesPagos(id_pago,id_cargo,monto) VALUES(@p,@cAnterior,500),(@p,@cMes,500),(@p,@cMedico,200);
  END;
  IF @pagoFundacion>0
   INSERT dbo.PagosFundacion(id_obligacion,fecha,monto,metodo,referencia,observaciones)
   VALUES(@o,@hoy,@pagoFundacion,'Transferencia',CONCAT('DEMO-CCA-2026-FUNDACION-',@codigo),'Pago ficticio; no representa desembolso real');
  IF @codigo='C'
   INSERT dbo.SolicitudesMedicas(id_residente,motivo,especialidad,enfermero,fecha_solicitud,estado,medico,fecha_cita,hora_cita)
   VALUES(@r,'DEMO-CCA-2026: revisión programada ficticia','Medicina Interna','Enfermería DEMO',@hoy,'Programada','Profesional ficticio DEMO',DATEADD(day,7,@hoy),'14:00');
  INSERT @ids VALUES(@codigo,@r,@v,@o);
  FETCH NEXT FROM residentes INTO @codigo,@nombres,@apellidos,@cuota,@pago,@pagoFundacion;
 END;
 CLOSE residentes;
 DEALLOCATE residentes;
 INSERT dbo.Donaciones(donante,tipo_donante,fecha,monto,descripcion,referencia)
 VALUES('Empresa ficticia DEMO Aurora','Empresa nacional',@hoy,5000,'DEMO-CCA-2026: donación ficticia','DEMO-CCA-2026-DON-1'),
       ('Particular ficticio DEMO Sol','Particular',@hoy,2000,'DEMO-CCA-2026: donación ficticia','DEMO-CCA-2026-DON-2');
 INSERT dbo.Gastos(categoria,concepto,fecha,monto,beneficiario,referencia,observaciones)
 VALUES('Alimentación','DEMO-CCA-2026: alimentos ficticios',@hoy,800,'Proveedor ficticio DEMO','DEMO-CCA-2026-GAS-1','No corresponde a gasto real'),
       ('Mantenimiento','DEMO-CCA-2026: reparación ficticia',@hoy,500,'Proveedor ficticio DEMO','DEMO-CCA-2026-GAS-2','No corresponde a gasto real');
 IF (SELECT COUNT(*) FROM @ids)<>3 THROW 51000,'Deben existir exactamente tres residentes nuevos DEMO.',1;
 IF EXISTS(SELECT 1 FROM dbo.NotificacionesCorreo n JOIN @ids d ON d.id_residente=n.id_residente)
  THROW 51000,'Se generaron avisos inesperados: se revierte toda la carga.',1;
 IF EXISTS(SELECT 1 FROM dbo.CargosFamiliares c JOIN @ids d ON d.id_residente=c.id_residente
  CROSS APPLY(SELECT COALESCE(SUM(monto),0) pagado FROM dbo.AplicacionesPagos WHERE id_cargo=c.id_cargo) a WHERE a.pagado>c.monto)
  THROW 51000,'Un abono supera el cargo: se revierte la carga.',1;
 IF (SELECT SUM(c.monto) FROM dbo.CargosFamiliares c JOIN @ids d ON d.id_residente=c.id_residente)<>10520
  OR (SELECT SUM(p.monto) FROM dbo.PagosFamiliares p JOIN @ids d ON d.id_residente=p.id_residente)<>3040
  THROW 51000,'Totales familiares DEMO inconsistentes.',1;
 IF (SELECT SUM(monto) FROM dbo.PagosFundacion WHERE id_obligacion IN(SELECT id_obligacion FROM @ids))<>1140
  THROW 51000,'Pagos Fundación DEMO inconsistentes.',1;
 COMMIT;
 SELECT * FROM @ids;
 PRINT 'DEMO insertado: cargos 10520; pagos familiares 3040; saldo familiar 7480; deuda Fundación 1380. Sin notificaciones.';
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
