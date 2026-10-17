-- Generado de metadatos reales, 16/oct/2026. SOLO esquema; sin datos ni credenciales.
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

CREATE TABLE [dbo].[Roles] (
    [id_rol] [int] IDENTITY(1,1) NOT NULL,
    [nombre] [varchar](100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [estado] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL
);

CREATE TABLE [dbo].[Especialidades] (
    [id_especialidad] [int] IDENTITY(1,1) NOT NULL,
    [nombre] [varchar](50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [estado] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL
);

CREATE TABLE [dbo].[Usuarios] (
    [id_usuario] [int] IDENTITY(1,1) NOT NULL,
    [correo] [varchar](100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [contrasena] [varchar](100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [rol] [varchar](50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [nombres] [varchar](100) COLLATE Modern_Spanish_CI_AS NULL,
    [apellidos] [varchar](100) COLLATE Modern_Spanish_CI_AS NULL,
    [telefono] [varchar](20) COLLATE Modern_Spanish_CI_AS NULL,
    [estado] [varchar](20) COLLATE Modern_Spanish_CI_AS NULL,
    [tipo_personal] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [id_rol] [int] NOT NULL
);

CREATE TABLE [dbo].[Donaciones] (
    [id_donacion] [int] IDENTITY(1,1) NOT NULL,
    [donante] [nvarchar](150) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [tipo_donante] [nvarchar](50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha] [date] NOT NULL,
    [monto] [decimal](12,2) NOT NULL,
    [descripcion] [nvarchar](1000) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [referencia] [nvarchar](150) COLLATE Modern_Spanish_CI_AS NULL,
    [estado] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [motivo_anulacion] [nvarchar](500) COLLATE Modern_Spanish_CI_AS NULL,
    [anulado_por] [int] NULL,
    [anulado_en] [datetime2](7) NULL,
    [creado_por] [int] NULL,
    [creado_en] [datetime2](7) NOT NULL
);

CREATE TABLE [dbo].[Gastos] (
    [id_gasto] [int] IDENTITY(1,1) NOT NULL,
    [categoria] [nvarchar](50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [concepto] [nvarchar](300) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha] [date] NOT NULL,
    [monto] [decimal](12,2) NOT NULL,
    [beneficiario] [nvarchar](150) COLLATE Modern_Spanish_CI_AS NULL,
    [referencia] [nvarchar](150) COLLATE Modern_Spanish_CI_AS NULL,
    [observaciones] [nvarchar](1000) COLLATE Modern_Spanish_CI_AS NULL,
    [estado] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [motivo_anulacion] [nvarchar](500) COLLATE Modern_Spanish_CI_AS NULL,
    [anulado_por] [int] NULL,
    [anulado_en] [datetime2](7) NULL,
    [creado_por] [int] NULL,
    [creado_en] [datetime2](7) NOT NULL
);

CREATE TABLE [dbo].[OperacionesFinancieras] (
    [clave] [uniqueidentifier] NOT NULL,
    [tipo] [varchar](60) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [id_usuario] [int] NOT NULL,
    [huella] [char](64) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [resultado] [nvarchar](MAX) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [creado_en] [datetime2](7) NOT NULL
);

CREATE TABLE [dbo].[Huespedes] (
    [id_residente] [int] IDENTITY(1,1) NOT NULL,
    [nombres] [varchar](100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [apellidos] [varchar](100) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [dpi] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha_nacimiento] [date] NOT NULL,
    [genero] [varchar](10) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [tipo_sangre] [varchar](5) COLLATE Modern_Spanish_CI_AS NULL,
    [alergias] [varchar](MAX) COLLATE Modern_Spanish_CI_AS NULL,
    [diagnostico] [varchar](MAX) COLLATE Modern_Spanish_CI_AS NULL,
    [requiere_asistencia_especial] [bit] NOT NULL,
    [descripcion_asistencia] [varchar](255) COLLATE Modern_Spanish_CI_AS NULL,
    [nombre_responsable] [varchar](150) COLLATE Modern_Spanish_CI_AS NULL,
    [parentesco] [varchar](50) COLLATE Modern_Spanish_CI_AS NULL,
    [telefono_emergencia] [varchar](20) COLLATE Modern_Spanish_CI_AS NULL,
    [estado] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha_registro] [datetime] NOT NULL,
    [cuota_mensual] [decimal](10,2) NOT NULL,
    [correo_responsable] [varchar](254) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_ingreso] [date] NULL,
    [fecha_retiro] [date] NULL
);

CREATE TABLE [dbo].[SolicitudesMedicas] (
    [id_solicitud] [int] IDENTITY(1,1) NOT NULL,
    [id_residente] [int] NOT NULL,
    [motivo] [varchar](500) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [especialidad] [varchar](50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [enfermero] [varchar](150) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [fecha_solicitud] [datetime] NOT NULL,
    [estado] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [medico] [varchar](150) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_cita] [date] NULL,
    [hora_cita] [time](7) NULL
);

CREATE TABLE [dbo].[VisitasMedicas] (
    [id_visita] [int] IDENTITY(1,1) NOT NULL,
    [id_solicitud] [int] NOT NULL,
    [diagnostico] [varchar](1000) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [examenes] [varchar](1000) COLLATE Modern_Spanish_CI_AS NULL,
    [resultados_examenes] [varchar](1500) COLLATE Modern_Spanish_CI_AS NULL,
    [costo_examenes] [decimal](10,2) NOT NULL,
    [medicamentos] [varchar](1000) COLLATE Modern_Spanish_CI_AS NULL,
    [cantidad_medicamentos] [varchar](300) COLLATE Modern_Spanish_CI_AS NULL,
    [indicaciones] [varchar](1000) COLLATE Modern_Spanish_CI_AS NULL,
    [costo_medicamentos] [decimal](10,2) NOT NULL,
    [costo_consulta] [decimal](10,2) NOT NULL,
    [subtotal] [decimal](10,2) NOT NULL,
    [porcentaje_descuento] [decimal](5,2) NOT NULL,
    [descuento] [decimal](10,2) NOT NULL,
    [total] [decimal](10,2) NOT NULL,
    [observaciones] [varchar](1500) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_visita] [datetime] NOT NULL,
    [descuento_consulta_porcentaje] [decimal](5,2) NOT NULL,
    [descuento_examenes_porcentaje] [decimal](5,2) NOT NULL,
    [descuento_medicamentos_porcentaje] [decimal](5,2) NOT NULL
);

CREATE TABLE [dbo].[CargosFamiliares] (
    [id_cargo] [int] IDENTITY(1,1) NOT NULL,
    [id_residente] [int] NOT NULL,
    [id_visita] [int] NULL,
    [tipo] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [periodo] [char](7) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha] [date] NOT NULL,
    [concepto] [nvarchar](300) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [monto] [decimal](12,2) NOT NULL,
    [creado_por] [int] NULL,
    [creado_en] [datetime2](7) NOT NULL
);

CREATE TABLE [dbo].[PagosFamiliares] (
    [id_pago] [int] IDENTITY(1,1) NOT NULL,
    [id_residente] [int] NOT NULL,
    [fecha] [date] NOT NULL,
    [monto] [decimal](12,2) NOT NULL,
    [metodo] [nvarchar](50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [referencia] [nvarchar](150) COLLATE Modern_Spanish_CI_AS NULL,
    [observaciones] [nvarchar](1000) COLLATE Modern_Spanish_CI_AS NULL,
    [creado_por] [int] NULL,
    [creado_en] [datetime2](7) NOT NULL
);

CREATE TABLE [dbo].[AplicacionesPagos] (
    [id_aplicacion] [int] IDENTITY(1,1) NOT NULL,
    [id_pago] [int] NOT NULL,
    [id_cargo] [int] NOT NULL,
    [monto] [decimal](12,2) NOT NULL
);

CREATE TABLE [dbo].[ObligacionesFundacion] (
    [id_obligacion] [int] IDENTITY(1,1) NOT NULL,
    [id_visita] [int] NOT NULL,
    [monto] [decimal](12,2) NOT NULL,
    [regla] [varchar](60) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [creado_por] [int] NULL,
    [creado_en] [datetime2](7) NOT NULL
);

CREATE TABLE [dbo].[PagosFundacion] (
    [id_pago_fundacion] [int] IDENTITY(1,1) NOT NULL,
    [id_obligacion] [int] NOT NULL,
    [fecha] [date] NOT NULL,
    [monto] [decimal](12,2) NOT NULL,
    [metodo] [nvarchar](50) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [referencia] [nvarchar](150) COLLATE Modern_Spanish_CI_AS NULL,
    [observaciones] [nvarchar](1000) COLLATE Modern_Spanish_CI_AS NULL,
    [creado_por] [int] NULL,
    [creado_en] [datetime2](7) NOT NULL
);

CREATE TABLE [dbo].[NotificacionesCorreo] (
    [id_notificacion] [int] IDENTITY(1,1) NOT NULL,
    [evento] [varchar](20) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [id_evento] [int] NOT NULL,
    [id_residente] [int] NOT NULL,
    [destinatario] [varchar](254) COLLATE Modern_Spanish_CI_AS NULL,
    [asunto] [nvarchar](200) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [cuerpo] [nvarchar](MAX) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [estado] [varchar](30) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [intentos] [int] NOT NULL,
    [creado_en] [datetime2](7) NOT NULL,
    [ultimo_intento] [datetime2](7) NULL,
    [enviado_en] [datetime2](7) NULL,
    [error] [nvarchar](300) COLLATE Modern_Spanish_CI_AS NULL
);

CREATE TABLE [dbo].[AuditoriaContactoFinanciero] (
    [id_cambio] [int] IDENTITY(1,1) NOT NULL,
    [id_residente] [int] NOT NULL,
    [correo_anterior] [varchar](254) COLLATE Modern_Spanish_CI_AS NULL,
    [correo_nuevo] [varchar](254) COLLATE Modern_Spanish_CI_AS NULL,
    [creado_por] [int] NULL,
    [creado_en] [datetime2](7) NOT NULL
);

CREATE TABLE [dbo].[FinanzasVersion] (
    [version] [int] NOT NULL
);

CREATE TABLE [dbo].[ConfiguracionMensualidades] (
    [id] [int] NOT NULL,
    [preparado_el] [date] NOT NULL,
    [inicio] [date] NULL
);

CREATE TABLE [dbo].[CuotasResidentes] (
    [id_cuota] [int] IDENTITY(1,1) NOT NULL,
    [id_residente] [int] NOT NULL,
    [desde] [date] NOT NULL,
    [monto] [decimal](10,2) NOT NULL,
    [creado_por] [int] NULL,
    [creado_en] [datetime2](7) NOT NULL
);

CREATE TABLE [dbo].[FichaMedica] (
    [id_ficha] [int] IDENTITY(1,1) NOT NULL,
    [id_residente] [int] NOT NULL,
    [psicopatologias] [varchar](500) COLLATE Modern_Spanish_CI_AS NULL,
    [padecimientos] [varchar](500) COLLATE Modern_Spanish_CI_AS NULL,
    [medicamentos_habituales] [varchar](500) COLLATE Modern_Spanish_CI_AS NULL,
    [antecedentes] [varchar](500) COLLATE Modern_Spanish_CI_AS NULL,
    [observaciones] [varchar](500) COLLATE Modern_Spanish_CI_AS NULL,
    [fecha_actualizacion] [datetime] NOT NULL
);

CREATE TABLE [dbo].[AjustesMensualidades] (
    [id_ajuste] [int] IDENTITY(1,1) NOT NULL,
    [id_cargo] [int] NOT NULL,
    [importe_anterior] [decimal](12,2) NOT NULL,
    [importe_nuevo] [decimal](12,2) NOT NULL,
    [motivo] [nvarchar](500) COLLATE Modern_Spanish_CI_AS NOT NULL,
    [creado_por] [int] NOT NULL,
    [creado_en] [datetime2](7) NOT NULL
);
ALTER TABLE [dbo].[SolicitudesMedicas] ADD CONSTRAINT [DF__Solicitud__fecha__02FC7413] DEFAULT (getdate()) FOR [fecha_solicitud];
ALTER TABLE [dbo].[SolicitudesMedicas] ADD CONSTRAINT [DF__Solicitud__estad__03F0984C] DEFAULT ('Pendiente') FOR [estado];
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [DF__VisitasMe__costo__09A971A2] DEFAULT ((0)) FOR [costo_examenes];
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [DF__VisitasMe__costo__0A9D95DB] DEFAULT ((0)) FOR [costo_medicamentos];
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [DF__VisitasMe__costo__0B91BA14] DEFAULT ((0)) FOR [costo_consulta];
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [DF__VisitasMe__porce__0C85DE4D] DEFAULT ((20.00)) FOR [porcentaje_descuento];
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [DF__VisitasMe__fecha__0D7A0286] DEFAULT (getdate()) FOR [fecha_visita];
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [DF__VisitasMe__descu__10566F31] DEFAULT ((20)) FOR [descuento_consulta_porcentaje];
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [DF__VisitasMe__descu__114A936A] DEFAULT ((20)) FOR [descuento_examenes_porcentaje];
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [DF__VisitasMe__descu__123EB7A3] DEFAULT ((20)) FOR [descuento_medicamentos_porcentaje];
ALTER TABLE [dbo].[Roles] ADD CONSTRAINT [DF_Roles_Estado] DEFAULT ('Activo') FOR [estado];
ALTER TABLE [dbo].[Especialidades] ADD CONSTRAINT [DF_Especialidades_Estado] DEFAULT ('Activo') FOR [estado];
ALTER TABLE [dbo].[CargosFamiliares] ADD CONSTRAINT [DF__CargosFam__cread__2739D489] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[PagosFamiliares] ADD CONSTRAINT [DF__PagosFami__cread__2DE6D218] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[ObligacionesFundacion] ADD CONSTRAINT [DF__Obligacio__regla__395884C4] DEFAULT ('Neto visita: provisional') FOR [regla];
ALTER TABLE [dbo].[ObligacionesFundacion] ADD CONSTRAINT [DF__Obligacio__cread__3B40CD36] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[PagosFundacion] ADD CONSTRAINT [DF__PagosFund__cread__40F9A68C] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[Donaciones] ADD CONSTRAINT [DF__Donacione__estad__45BE5BA9] DEFAULT ('Confirmada') FOR [estado];
ALTER TABLE [dbo].[Donaciones] ADD CONSTRAINT [DF__Donacione__cread__498EEC8D] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[Gastos] ADD CONSTRAINT [DF__Gastos__estado__4F47C5E3] DEFAULT ('Confirmado') FOR [estado];
ALTER TABLE [dbo].[Gastos] ADD CONSTRAINT [DF__Gastos__creado_e__531856C7] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[OperacionesFinancieras] ADD CONSTRAINT [DF__Operacion__cread__57DD0BE4] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[NotificacionesCorreo] ADD CONSTRAINT [DF__Notificac__estad__5D95E53A] DEFAULT ('Pendiente') FOR [estado];
ALTER TABLE [dbo].[Huespedes] ADD CONSTRAINT [DF__Huespedes__requi__5DCAEF64] DEFAULT ((0)) FOR [requiere_asistencia_especial];
ALTER TABLE [dbo].[Huespedes] ADD CONSTRAINT [DF__Huespedes__estad__5EBF139D] DEFAULT ('Activo') FOR [estado];
ALTER TABLE [dbo].[NotificacionesCorreo] ADD CONSTRAINT [DF__Notificac__inten__5F7E2DAC] DEFAULT ((0)) FOR [intentos];
ALTER TABLE [dbo].[Huespedes] ADD CONSTRAINT [DF__Huespedes__fecha__5FB337D6] DEFAULT (getdate()) FOR [fecha_registro];
ALTER TABLE [dbo].[NotificacionesCorreo] ADD CONSTRAINT [DF__Notificac__cread__6166761E] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[Huespedes] ADD CONSTRAINT [DF__Huespedes__cuota__619B8048] DEFAULT ((0.00)) FOR [cuota_mensual];
ALTER TABLE [dbo].[AuditoriaContactoFinanciero] ADD CONSTRAINT [DF__Auditoria__cread__662B2B3B] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[FichaMedica] ADD CONSTRAINT [DF__FichaMedi__fecha__70DDC3D8] DEFAULT (getdate()) FOR [fecha_actualizacion];
ALTER TABLE [dbo].[CuotasResidentes] ADD CONSTRAINT [DF__CuotasRes__cread__73852659] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[AjustesMensualidades] ADD CONSTRAINT [DF__AjustesMe__cread__7B264821] DEFAULT (sysutcdatetime()) FOR [creado_en];
ALTER TABLE [dbo].[SolicitudesMedicas] WITH CHECK ADD CONSTRAINT [CK_SolicitudesMedicas_Estado] CHECK ([estado]='Cancelada' OR [estado]='Finalizada' OR [estado]='Programada' OR [estado]='Pendiente');
ALTER TABLE [dbo].[VisitasMedicas] WITH CHECK ADD CONSTRAINT [CK_VisitasMedicas_Costos] CHECK ([costo_examenes]>=(0) AND [costo_medicamentos]>=(0) AND [costo_consulta]>=(0) AND [subtotal]>=(0) AND [descuento]>=(0) AND [total]>=(0));
ALTER TABLE [dbo].[Roles] WITH CHECK ADD CONSTRAINT [CK_Roles_Estado] CHECK ([estado]='Inactivo' OR [estado]='Activo');
ALTER TABLE [dbo].[Roles] WITH CHECK ADD CONSTRAINT [CK_Roles_Nombre] CHECK (len(ltrim(rtrim([nombre])))>(0));
ALTER TABLE [dbo].[Especialidades] WITH CHECK ADD CONSTRAINT [CK_Especialidades_Estado] CHECK ([estado]='Inactivo' OR [estado]='Activo');
ALTER TABLE [dbo].[Especialidades] WITH CHECK ADD CONSTRAINT [CK_Especialidades_Nombre] CHECK (len(ltrim(rtrim([nombre])))>(0));
ALTER TABLE [dbo].[Usuarios] WITH CHECK ADD CONSTRAINT [CK_Usuarios_TipoPersonal] CHECK ([tipo_personal]='Fundacion' OR [tipo_personal]='Asilo');
ALTER TABLE [dbo].[CargosFamiliares] WITH CHECK ADD CONSTRAINT [CK__CargosFami__tipo__245D67DE] CHECK ([tipo]='Manual' OR [tipo]='Medico' OR [tipo]='Mensualidad');
ALTER TABLE [dbo].[CargosFamiliares] WITH CHECK ADD CONSTRAINT [CK__CargosFam__monto__25518C17] CHECK ([monto]>=(0));
ALTER TABLE [dbo].[CargosFamiliares] WITH CHECK ADD CONSTRAINT [CK__CargosFamiliares__282DF8C2] CHECK ([tipo]='Mensualidad' AND [periodo] IS NOT NULL AND [id_visita] IS NULL OR [tipo]='Medico' AND [id_visita] IS NOT NULL AND [periodo] IS NULL OR [tipo]='Manual' AND [periodo] IS NULL AND [id_visita] IS NULL);
ALTER TABLE [dbo].[PagosFamiliares] WITH CHECK ADD CONSTRAINT [CK__PagosFami__monto__2BFE89A6] CHECK ([monto]>(0));
ALTER TABLE [dbo].[AplicacionesPagos] WITH CHECK ADD CONSTRAINT [CK__Aplicacio__monto__339FAB6E] CHECK ([monto]>(0));
ALTER TABLE [dbo].[ObligacionesFundacion] WITH CHECK ADD CONSTRAINT [CK__Obligacio__monto__3864608B] CHECK ([monto]>=(0));
ALTER TABLE [dbo].[PagosFundacion] WITH CHECK ADD CONSTRAINT [CK__PagosFund__monto__3F115E1A] CHECK ([monto]>(0));
ALTER TABLE [dbo].[Donaciones] WITH CHECK ADD CONSTRAINT [CK__Donacione__tipo___43D61337] CHECK ([tipo_donante]=N'Particular' OR [tipo_donante]=N'Gobierno' OR [tipo_donante]=N'Empresa nacional' OR [tipo_donante]=N'Empresa internacional');
ALTER TABLE [dbo].[Donaciones] WITH CHECK ADD CONSTRAINT [CK__Donacione__monto__44CA3770] CHECK ([monto]>(0));
ALTER TABLE [dbo].[Donaciones] WITH CHECK ADD CONSTRAINT [CK__Donacione__estad__46B27FE2] CHECK ([estado]='Anulada' OR [estado]='Confirmada');
ALTER TABLE [dbo].[Donaciones] WITH CHECK ADD CONSTRAINT [CK__Donaciones__4A8310C6] CHECK ([estado]='Confirmada' AND [motivo_anulacion] IS NULL AND [anulado_en] IS NULL OR [estado]='Anulada' AND [motivo_anulacion] IS NOT NULL AND [anulado_en] IS NOT NULL AND [anulado_por] IS NOT NULL);
ALTER TABLE [dbo].[Gastos] WITH CHECK ADD CONSTRAINT [CK__Gastos__categori__4D5F7D71] CHECK ([categoria]=N'Otros' OR [categoria]=N'Servicios' OR [categoria]=N'Transporte' OR [categoria]=N'Mantenimiento' OR [categoria]=N'Alimentación' OR [categoria]=N'Energía eléctrica' OR [categoria]=N'Agua');
ALTER TABLE [dbo].[Gastos] WITH CHECK ADD CONSTRAINT [CK__Gastos__monto__4E53A1AA] CHECK ([monto]>(0));
ALTER TABLE [dbo].[Gastos] WITH CHECK ADD CONSTRAINT [CK__Gastos__estado__503BEA1C] CHECK ([estado]='Anulado' OR [estado]='Confirmado');
ALTER TABLE [dbo].[Gastos] WITH CHECK ADD CONSTRAINT [CK__Gastos__540C7B00] CHECK ([estado]='Confirmado' AND [motivo_anulacion] IS NULL AND [anulado_en] IS NULL OR [estado]='Anulado' AND [motivo_anulacion] IS NOT NULL AND [anulado_en] IS NOT NULL AND [anulado_por] IS NOT NULL);
ALTER TABLE [dbo].[NotificacionesCorreo] WITH CHECK ADD CONSTRAINT [CK__Notificac__event__5BAD9CC8] CHECK ([evento]='Pago' OR [evento]='Cargo' OR [evento]='Cita');
ALTER TABLE [dbo].[NotificacionesCorreo] WITH CHECK ADD CONSTRAINT [CK__Notificac__estad__5E8A0973] CHECK ([estado]='Incierta' OR [estado]='Enviada' OR [estado]='Enviando' OR [estado]='Pendiente');
ALTER TABLE [dbo].[NotificacionesCorreo] WITH CHECK ADD CONSTRAINT [CK__Notificac__inten__607251E5] CHECK ([intentos]>=(0));
ALTER TABLE [dbo].[Huespedes] WITH CHECK ADD CONSTRAINT [CK_Residentes_Genero] CHECK ([genero]='Femenino' OR [genero]='Masculino');
ALTER TABLE [dbo].[FinanzasVersion] WITH CHECK ADD CONSTRAINT [CK__FinanzasV__versi__690797E6] CHECK ([version]=(1));
ALTER TABLE [dbo].[ConfiguracionMensualidades] WITH CHECK ADD CONSTRAINT [CK__Configuracio__id__6BE40491] CHECK ([id]=(1));
ALTER TABLE [dbo].[ConfiguracionMensualidades] WITH CHECK ADD CONSTRAINT [CK_Mensualidades_Inicio] CHECK ([inicio] IS NULL OR datepart(day,[inicio])=(1) AND [inicio]>=datefromparts(datepart(year,[preparado_el]),datepart(month,[preparado_el]),(1)));
ALTER TABLE [dbo].[CuotasResidentes] WITH CHECK ADD CONSTRAINT [CK__CuotasRes__desde__70A8B9AE] CHECK (datepart(day,[desde])=(1));
ALTER TABLE [dbo].[CuotasResidentes] WITH CHECK ADD CONSTRAINT [CK__CuotasRes__monto__719CDDE7] CHECK ([monto]>=(0));
ALTER TABLE [dbo].[AjustesMensualidades] WITH CHECK ADD CONSTRAINT [CK__AjustesMe__impor__7755B73D] CHECK ([importe_anterior]>=(0));
ALTER TABLE [dbo].[AjustesMensualidades] WITH CHECK ADD CONSTRAINT [CK__AjustesMe__impor__7849DB76] CHECK ([importe_nuevo]>=(0));
ALTER TABLE [dbo].[AjustesMensualidades] WITH CHECK ADD CONSTRAINT [CK__AjustesMe__motiv__793DFFAF] CHECK (len(ltrim(rtrim([motivo])))>(0));
ALTER TABLE [dbo].[AjustesMensualidades] WITH CHECK ADD CONSTRAINT [CK__AjustesMensualid__7C1A6C5A] CHECK ([importe_anterior]<>[importe_nuevo]);
ALTER TABLE [dbo].[Huespedes] WITH CHECK ADD CONSTRAINT [CK_Huespedes_FechasEstancia] CHECK ([fecha_retiro] IS NULL OR [fecha_ingreso] IS NOT NULL AND [fecha_retiro]>=[fecha_ingreso]);
ALTER TABLE [dbo].[SolicitudesMedicas] ADD CONSTRAINT [PK__Solicitu__5C0C31F3E5E5CB55] PRIMARY KEY CLUSTERED ([id_solicitud] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [PK__VisitasM__8336658D9737E104] PRIMARY KEY CLUSTERED ([id_visita] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[VisitasMedicas] ADD CONSTRAINT [UQ_VisitasMedicas_Solicitud] UNIQUE NONCLUSTERED ([id_solicitud] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Roles] ADD CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED ([id_rol] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Roles] ADD CONSTRAINT [UQ_Roles_Nombre] UNIQUE NONCLUSTERED ([nombre] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Especialidades] ADD CONSTRAINT [PK_Especialidades] PRIMARY KEY CLUSTERED ([id_especialidad] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Especialidades] ADD CONSTRAINT [UQ_Especialidades_Nombre] UNIQUE NONCLUSTERED ([nombre] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[CargosFamiliares] ADD CONSTRAINT [PK__CargosFa__D3C09EC530ADE37A] PRIMARY KEY CLUSTERED ([id_cargo] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Cargo_Mes] ON [dbo].[CargosFamiliares] ([id_residente] ASC, [periodo] ASC) WHERE ([periodo] IS NOT NULL) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Cargo_Visita] ON [dbo].[CargosFamiliares] ([id_visita] ASC) WHERE ([id_visita] IS NOT NULL) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE NONCLUSTERED INDEX [IX_CargosFamiliares_Consulta] ON [dbo].[CargosFamiliares] ([id_residente] ASC, [fecha] ASC, [id_cargo] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[PagosFamiliares] ADD CONSTRAINT [PK__PagosFam__0941B07411267D81] PRIMARY KEY CLUSTERED ([id_pago] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE NONCLUSTERED INDEX [IX_PagosFamiliares_Consulta] ON [dbo].[PagosFamiliares] ([id_residente] ASC, [fecha] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[AplicacionesPagos] ADD CONSTRAINT [PK__Aplicaci__D3D4F74AE66D1F1C] PRIMARY KEY CLUSTERED ([id_aplicacion] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[AplicacionesPagos] ADD CONSTRAINT [UQ__Aplicaci__447DB999F64C2A11] UNIQUE NONCLUSTERED ([id_pago] ASC, [id_cargo] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE NONCLUSTERED INDEX [IX_AplicacionesPagos_Consulta] ON [dbo].[AplicacionesPagos] ([id_cargo] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[ObligacionesFundacion] ADD CONSTRAINT [PK__Obligaci__B96D1214B3F30D4E] PRIMARY KEY CLUSTERED ([id_obligacion] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[ObligacionesFundacion] ADD CONSTRAINT [UQ__Obligaci__8336658C82A944D9] UNIQUE NONCLUSTERED ([id_visita] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[PagosFundacion] ADD CONSTRAINT [PK__PagosFun__93E5A02CB7AEF3EE] PRIMARY KEY CLUSTERED ([id_pago_fundacion] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE NONCLUSTERED INDEX [IX_PagosFundacion_Consulta] ON [dbo].[PagosFundacion] ([id_obligacion] ASC, [fecha] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Donaciones] ADD CONSTRAINT [PK__Donacion__931F75CC43F981A0] PRIMARY KEY CLUSTERED ([id_donacion] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE NONCLUSTERED INDEX [IX_Donaciones_Consulta] ON [dbo].[Donaciones] ([fecha] ASC, [estado] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Usuarios] ADD CONSTRAINT [PK__Usuarios__4E3E04AD6CC03A37] PRIMARY KEY CLUSTERED ([id_usuario] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Usuarios] ADD CONSTRAINT [UQ__Usuarios__2A586E0B9EECFA66] UNIQUE NONCLUSTERED ([correo] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Gastos] ADD CONSTRAINT [PK__Gastos__ECB8FB80DF9EE52B] PRIMARY KEY CLUSTERED ([id_gasto] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE NONCLUSTERED INDEX [IX_Gastos_Consulta] ON [dbo].[Gastos] ([fecha] ASC, [estado] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[OperacionesFinancieras] ADD CONSTRAINT [PK__Operacio__71DCA3DAE568E5D6] PRIMARY KEY CLUSTERED ([clave] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[NotificacionesCorreo] ADD CONSTRAINT [PK__Notifica__8270F9A593F6BF3E] PRIMARY KEY CLUSTERED ([id_notificacion] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[NotificacionesCorreo] ADD CONSTRAINT [UQ__Notifica__378139409654A3AB] UNIQUE NONCLUSTERED ([evento] ASC, [id_evento] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE NONCLUSTERED INDEX [IX_NotificacionesCorreo_Consulta] ON [dbo].[NotificacionesCorreo] ([estado] ASC, [id_notificacion] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Huespedes] ADD CONSTRAINT [PK__Huespede__A63BAD21F19E4E99] PRIMARY KEY CLUSTERED ([id_residente] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[Huespedes] ADD CONSTRAINT [UQ__Huespede__D8761965B5664094] UNIQUE NONCLUSTERED ([dpi] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[AuditoriaContactoFinanciero] ADD CONSTRAINT [PK__Auditori__CA32984F1D613BD6] PRIMARY KEY CLUSTERED ([id_cambio] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[FinanzasVersion] ADD CONSTRAINT [PK__Finanzas__79B5C94CB0D25E5D] PRIMARY KEY CLUSTERED ([version] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[ConfiguracionMensualidades] ADD CONSTRAINT [PK__Configur__3213E83F761A9AFE] PRIMARY KEY CLUSTERED ([id] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[CuotasResidentes] ADD CONSTRAINT [PK__CuotasRe__5EFF6F7ECADE2641] PRIMARY KEY CLUSTERED ([id_cuota] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
CREATE NONCLUSTERED INDEX [IX_CuotasResidentes_Periodo] ON [dbo].[CuotasResidentes] ([id_residente] ASC, [desde] ASC, [id_cuota] ASC) INCLUDE ([monto]) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[FichaMedica] ADD CONSTRAINT [PK__FichaMed__427B0F8A65221531] PRIMARY KEY CLUSTERED ([id_ficha] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[FichaMedica] ADD CONSTRAINT [UQ__FichaMed__A63BAD20AD729F65] UNIQUE NONCLUSTERED ([id_residente] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[AjustesMensualidades] ADD CONSTRAINT [PK__AjustesM__7B0665B782DA4C6B] PRIMARY KEY CLUSTERED ([id_ajuste] ASC) WITH (PAD_INDEX = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON);
ALTER TABLE [dbo].[SolicitudesMedicas] WITH CHECK ADD CONSTRAINT [FK_SolicitudesMedicas_Huespedes] FOREIGN KEY ([id_residente]) REFERENCES [dbo].[Huespedes] ([id_residente]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[VisitasMedicas] WITH CHECK ADD CONSTRAINT [FK_VisitasMedicas_Solicitudes] FOREIGN KEY ([id_solicitud]) REFERENCES [dbo].[SolicitudesMedicas] ([id_solicitud]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Usuarios] WITH CHECK ADD CONSTRAINT [FK_Usuarios_Roles] FOREIGN KEY ([id_rol]) REFERENCES [dbo].[Roles] ([id_rol]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CargosFamiliares] WITH CHECK ADD CONSTRAINT [FK__CargosFam__id_re__22751F6C] FOREIGN KEY ([id_residente]) REFERENCES [dbo].[Huespedes] ([id_residente]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CargosFamiliares] WITH CHECK ADD CONSTRAINT [FK__CargosFam__id_vi__236943A5] FOREIGN KEY ([id_visita]) REFERENCES [dbo].[VisitasMedicas] ([id_visita]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CargosFamiliares] WITH CHECK ADD CONSTRAINT [FK__CargosFam__cread__2645B050] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PagosFamiliares] WITH CHECK ADD CONSTRAINT [FK__PagosFami__id_re__2B0A656D] FOREIGN KEY ([id_residente]) REFERENCES [dbo].[Huespedes] ([id_residente]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PagosFamiliares] WITH CHECK ADD CONSTRAINT [FK__PagosFami__cread__2CF2ADDF] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AplicacionesPagos] WITH CHECK ADD CONSTRAINT [FK__Aplicacio__id_pa__31B762FC] FOREIGN KEY ([id_pago]) REFERENCES [dbo].[PagosFamiliares] ([id_pago]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AplicacionesPagos] WITH CHECK ADD CONSTRAINT [FK__Aplicacio__id_ca__32AB8735] FOREIGN KEY ([id_cargo]) REFERENCES [dbo].[CargosFamiliares] ([id_cargo]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ObligacionesFundacion] WITH CHECK ADD CONSTRAINT [FK__Obligacio__id_vi__37703C52] FOREIGN KEY ([id_visita]) REFERENCES [dbo].[VisitasMedicas] ([id_visita]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ObligacionesFundacion] WITH CHECK ADD CONSTRAINT [FK__Obligacio__cread__3A4CA8FD] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PagosFundacion] WITH CHECK ADD CONSTRAINT [FK__PagosFund__id_ob__3E1D39E1] FOREIGN KEY ([id_obligacion]) REFERENCES [dbo].[ObligacionesFundacion] ([id_obligacion]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PagosFundacion] WITH CHECK ADD CONSTRAINT [FK__PagosFund__cread__40058253] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Donaciones] WITH CHECK ADD CONSTRAINT [FK__Donacione__anula__47A6A41B] FOREIGN KEY ([anulado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Donaciones] WITH CHECK ADD CONSTRAINT [FK__Donacione__cread__489AC854] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Gastos] WITH CHECK ADD CONSTRAINT [FK__Gastos__anulado___51300E55] FOREIGN KEY ([anulado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Gastos] WITH CHECK ADD CONSTRAINT [FK__Gastos__creado_p__5224328E] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[OperacionesFinancieras] WITH CHECK ADD CONSTRAINT [FK__Operacion__id_us__56E8E7AB] FOREIGN KEY ([id_usuario]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[NotificacionesCorreo] WITH CHECK ADD CONSTRAINT [FK__Notificac__id_re__5CA1C101] FOREIGN KEY ([id_residente]) REFERENCES [dbo].[Huespedes] ([id_residente]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AuditoriaContactoFinanciero] WITH CHECK ADD CONSTRAINT [FK__Auditoria__id_re__6442E2C9] FOREIGN KEY ([id_residente]) REFERENCES [dbo].[Huespedes] ([id_residente]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AuditoriaContactoFinanciero] WITH CHECK ADD CONSTRAINT [FK__Auditoria__cread__65370702] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CuotasResidentes] WITH CHECK ADD CONSTRAINT [FK__CuotasRes__id_re__6FB49575] FOREIGN KEY ([id_residente]) REFERENCES [dbo].[Huespedes] ([id_residente]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[FichaMedica] WITH CHECK ADD CONSTRAINT [FK_FichaMedica_Huesped] FOREIGN KEY ([id_residente]) REFERENCES [dbo].[Huespedes] ([id_residente]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CuotasResidentes] WITH CHECK ADD CONSTRAINT [FK__CuotasRes__cread__72910220] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AjustesMensualidades] WITH CHECK ADD CONSTRAINT [FK__AjustesMe__id_ca__76619304] FOREIGN KEY ([id_cargo]) REFERENCES [dbo].[CargosFamiliares] ([id_cargo]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AjustesMensualidades] WITH CHECK ADD CONSTRAINT [FK__AjustesMe__cread__7A3223E8] FOREIGN KEY ([creado_por]) REFERENCES [dbo].[Usuarios] ([id_usuario]) ON DELETE NO ACTION ON UPDATE NO ACTION;
COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
