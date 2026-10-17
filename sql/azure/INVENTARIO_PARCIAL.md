# Inventario parcial — 16/oct/2026

NO es un esquema listo para migrar. VIEW DEFINITION=0: faltan definiciones de DEFAULT, CHECK y módulos; puede haber otros objetos ocultos. No se exportaron filas.

Base: CabezaDeAlgodon. Collation: Modern_Spanish_CI_AS. Compatibilidad: 170. READ_COMMITTED_SNAPSHOT: OFF.

## dbo.SolicitudesMedicas

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_solicitud | int | 4 | 10/0 | false | 1,1 |
| id_residente | int | 4 | 10/0 | false | No |
| motivo | varchar | 500 | 0/0 | false | No |
| especialidad | varchar | 50 | 0/0 | false | No |
| enfermero | varchar | 150 | 0/0 | false | No |
| fecha_solicitud | datetime | 8 | 23/3 | false | No |
| estado | varchar | 20 | 0/0 | false | No |
| medico | varchar | 150 | 0/0 | true | No |
| fecha_cita | date | 3 | 10/0 | true | No |
| hora_cita | time | 5 | 16/7 | true | No |

Índices: PK__Solicitu__5C0C31F3E5E5CB55 (PK CLUSTERED).

## dbo.VisitasMedicas

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_visita | int | 4 | 10/0 | false | 1,1 |
| id_solicitud | int | 4 | 10/0 | false | No |
| diagnostico | varchar | 1000 | 0/0 | false | No |
| examenes | varchar | 1000 | 0/0 | true | No |
| resultados_examenes | varchar | 1500 | 0/0 | true | No |
| costo_examenes | decimal | 9 | 10/2 | false | No |
| medicamentos | varchar | 1000 | 0/0 | true | No |
| cantidad_medicamentos | varchar | 300 | 0/0 | true | No |
| indicaciones | varchar | 1000 | 0/0 | true | No |
| costo_medicamentos | decimal | 9 | 10/2 | false | No |
| costo_consulta | decimal | 9 | 10/2 | false | No |
| subtotal | decimal | 9 | 10/2 | false | No |
| porcentaje_descuento | decimal | 5 | 5/2 | false | No |
| descuento | decimal | 9 | 10/2 | false | No |
| total | decimal | 9 | 10/2 | false | No |
| observaciones | varchar | 1500 | 0/0 | true | No |
| fecha_visita | datetime | 8 | 23/3 | false | No |
| descuento_consulta_porcentaje | decimal | 5 | 5/2 | false | No |
| descuento_examenes_porcentaje | decimal | 5 | 5/2 | false | No |
| descuento_medicamentos_porcentaje | decimal | 5 | 5/2 | false | No |

Índices: PK__VisitasM__8336658D9737E104 (PK CLUSTERED); UQ_VisitasMedicas_Solicitud (UNIQUE NONCLUSTERED).

## dbo.sysdiagrams

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| name | sysname | 256 | 0/0 | false | No |
| principal_id | int | 4 | 10/0 | false | No |
| diagram_id | int | 4 | 10/0 | false | 1,1 |
| version | int | 4 | 10/0 | true | No |
| definition | varbinary | -1 | 0/0 | true | No |

Índices: PK__sysdiagr__C2B05B61061FAFEB (PK CLUSTERED); UK_principal_name (UNIQUE NONCLUSTERED).

## dbo.Roles

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_rol | int | 4 | 10/0 | false | 1,1 |
| nombre | varchar | 100 | 0/0 | false | No |
| estado | varchar | 20 | 0/0 | false | No |

Índices: PK_Roles (PK CLUSTERED); UQ_Roles_Nombre (UNIQUE NONCLUSTERED).

## dbo.Especialidades

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_especialidad | int | 4 | 10/0 | false | 1,1 |
| nombre | varchar | 50 | 0/0 | false | No |
| estado | varchar | 20 | 0/0 | false | No |

Índices: PK_Especialidades (PK CLUSTERED); UQ_Especialidades_Nombre (UNIQUE NONCLUSTERED).

## dbo.CargosFamiliares

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_cargo | int | 4 | 10/0 | false | 1,1 |
| id_residente | int | 4 | 10/0 | false | No |
| id_visita | int | 4 | 10/0 | true | No |
| tipo | varchar | 20 | 0/0 | false | No |
| periodo | char | 7 | 0/0 | true | No |
| fecha | date | 3 | 10/0 | false | No |
| concepto | nvarchar | 600 | 0/0 | false | No |
| monto | decimal | 9 | 12/2 | false | No |
| creado_por | int | 4 | 10/0 | true | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__CargosFa__D3C09EC530ADE37A (PK CLUSTERED); UQ_Cargo_Mes (NONCLUSTERED); UQ_Cargo_Visita (NONCLUSTERED); IX_CargosFamiliares_Consulta (NONCLUSTERED).

## dbo.PagosFamiliares

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_pago | int | 4 | 10/0 | false | 1,1 |
| id_residente | int | 4 | 10/0 | false | No |
| fecha | date | 3 | 10/0 | false | No |
| monto | decimal | 9 | 12/2 | false | No |
| metodo | nvarchar | 100 | 0/0 | false | No |
| referencia | nvarchar | 300 | 0/0 | true | No |
| observaciones | nvarchar | 2000 | 0/0 | true | No |
| creado_por | int | 4 | 10/0 | true | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__PagosFam__0941B07411267D81 (PK CLUSTERED); IX_PagosFamiliares_Consulta (NONCLUSTERED).

## dbo.AplicacionesPagos

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_aplicacion | int | 4 | 10/0 | false | 1,1 |
| id_pago | int | 4 | 10/0 | false | No |
| id_cargo | int | 4 | 10/0 | false | No |
| monto | decimal | 9 | 12/2 | false | No |

Índices: PK__Aplicaci__D3D4F74AE66D1F1C (PK CLUSTERED); UQ__Aplicaci__447DB999F64C2A11 (UNIQUE NONCLUSTERED); IX_AplicacionesPagos_Consulta (NONCLUSTERED).

## dbo.ObligacionesFundacion

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_obligacion | int | 4 | 10/0 | false | 1,1 |
| id_visita | int | 4 | 10/0 | false | No |
| monto | decimal | 9 | 12/2 | false | No |
| regla | varchar | 60 | 0/0 | false | No |
| creado_por | int | 4 | 10/0 | true | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__Obligaci__B96D1214B3F30D4E (PK CLUSTERED); UQ__Obligaci__8336658C82A944D9 (UNIQUE NONCLUSTERED).

## dbo.PagosFundacion

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_pago_fundacion | int | 4 | 10/0 | false | 1,1 |
| id_obligacion | int | 4 | 10/0 | false | No |
| fecha | date | 3 | 10/0 | false | No |
| monto | decimal | 9 | 12/2 | false | No |
| metodo | nvarchar | 100 | 0/0 | false | No |
| referencia | nvarchar | 300 | 0/0 | true | No |
| observaciones | nvarchar | 2000 | 0/0 | true | No |
| creado_por | int | 4 | 10/0 | true | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__PagosFun__93E5A02CB7AEF3EE (PK CLUSTERED); IX_PagosFundacion_Consulta (NONCLUSTERED).

## dbo.Donaciones

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_donacion | int | 4 | 10/0 | false | 1,1 |
| donante | nvarchar | 300 | 0/0 | false | No |
| tipo_donante | nvarchar | 100 | 0/0 | false | No |
| fecha | date | 3 | 10/0 | false | No |
| monto | decimal | 9 | 12/2 | false | No |
| descripcion | nvarchar | 2000 | 0/0 | false | No |
| referencia | nvarchar | 300 | 0/0 | true | No |
| estado | varchar | 20 | 0/0 | false | No |
| motivo_anulacion | nvarchar | 1000 | 0/0 | true | No |
| anulado_por | int | 4 | 10/0 | true | No |
| anulado_en | datetime2 | 8 | 27/7 | true | No |
| creado_por | int | 4 | 10/0 | true | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__Donacion__931F75CC43F981A0 (PK CLUSTERED); IX_Donaciones_Consulta (NONCLUSTERED).

## dbo.Usuarios

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_usuario | int | 4 | 10/0 | false | 1,1 |
| correo | varchar | 100 | 0/0 | false | No |
| contrasena | varchar | 100 | 0/0 | false | No |
| rol | varchar | 50 | 0/0 | false | No |
| nombres | varchar | 100 | 0/0 | true | No |
| apellidos | varchar | 100 | 0/0 | true | No |
| telefono | varchar | 20 | 0/0 | true | No |
| estado | varchar | 20 | 0/0 | true | No |
| tipo_personal | varchar | 20 | 0/0 | false | No |
| id_rol | int | 4 | 10/0 | false | No |

Índices: PK__Usuarios__4E3E04AD6CC03A37 (PK CLUSTERED); UQ__Usuarios__2A586E0B9EECFA66 (UNIQUE NONCLUSTERED).

## dbo.Gastos

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_gasto | int | 4 | 10/0 | false | 1,1 |
| categoria | nvarchar | 100 | 0/0 | false | No |
| concepto | nvarchar | 600 | 0/0 | false | No |
| fecha | date | 3 | 10/0 | false | No |
| monto | decimal | 9 | 12/2 | false | No |
| beneficiario | nvarchar | 300 | 0/0 | true | No |
| referencia | nvarchar | 300 | 0/0 | true | No |
| observaciones | nvarchar | 2000 | 0/0 | true | No |
| estado | varchar | 20 | 0/0 | false | No |
| motivo_anulacion | nvarchar | 1000 | 0/0 | true | No |
| anulado_por | int | 4 | 10/0 | true | No |
| anulado_en | datetime2 | 8 | 27/7 | true | No |
| creado_por | int | 4 | 10/0 | true | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__Gastos__ECB8FB80DF9EE52B (PK CLUSTERED); IX_Gastos_Consulta (NONCLUSTERED).

## dbo.OperacionesFinancieras

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| clave | uniqueidentifier | 16 | 0/0 | false | No |
| tipo | varchar | 60 | 0/0 | false | No |
| id_usuario | int | 4 | 10/0 | false | No |
| huella | char | 64 | 0/0 | false | No |
| resultado | nvarchar | -1 | 0/0 | false | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__Operacio__71DCA3DAE568E5D6 (PK CLUSTERED).

## dbo.NotificacionesCorreo

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_notificacion | int | 4 | 10/0 | false | 1,1 |
| evento | varchar | 20 | 0/0 | false | No |
| id_evento | int | 4 | 10/0 | false | No |
| id_residente | int | 4 | 10/0 | false | No |
| destinatario | varchar | 254 | 0/0 | true | No |
| asunto | nvarchar | 400 | 0/0 | false | No |
| cuerpo | nvarchar | -1 | 0/0 | false | No |
| estado | varchar | 30 | 0/0 | false | No |
| intentos | int | 4 | 10/0 | false | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |
| ultimo_intento | datetime2 | 8 | 27/7 | true | No |
| enviado_en | datetime2 | 8 | 27/7 | true | No |
| error | nvarchar | 600 | 0/0 | true | No |

Índices: PK__Notifica__8270F9A593F6BF3E (PK CLUSTERED); UQ__Notifica__378139409654A3AB (UNIQUE NONCLUSTERED); IX_NotificacionesCorreo_Consulta (NONCLUSTERED).

## dbo.Huespedes

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_residente | int | 4 | 10/0 | false | 1,1 |
| nombres | varchar | 100 | 0/0 | false | No |
| apellidos | varchar | 100 | 0/0 | false | No |
| dpi | varchar | 20 | 0/0 | false | No |
| fecha_nacimiento | date | 3 | 10/0 | false | No |
| genero | varchar | 10 | 0/0 | false | No |
| tipo_sangre | varchar | 5 | 0/0 | true | No |
| alergias | varchar | -1 | 0/0 | true | No |
| diagnostico | varchar | -1 | 0/0 | true | No |
| requiere_asistencia_especial | bit | 1 | 1/0 | false | No |
| descripcion_asistencia | varchar | 255 | 0/0 | true | No |
| nombre_responsable | varchar | 150 | 0/0 | true | No |
| parentesco | varchar | 50 | 0/0 | true | No |
| telefono_emergencia | varchar | 20 | 0/0 | true | No |
| estado | varchar | 20 | 0/0 | false | No |
| fecha_registro | datetime | 8 | 23/3 | false | No |
| cuota_mensual | decimal | 9 | 10/2 | false | No |
| correo_responsable | varchar | 254 | 0/0 | true | No |
| fecha_ingreso | date | 3 | 10/0 | true | No |
| fecha_retiro | date | 3 | 10/0 | true | No |

Índices: PK__Huespede__A63BAD21F19E4E99 (PK CLUSTERED); UQ__Huespede__D8761965B5664094 (UNIQUE NONCLUSTERED).

## dbo.AuditoriaContactoFinanciero

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_cambio | int | 4 | 10/0 | false | 1,1 |
| id_residente | int | 4 | 10/0 | false | No |
| correo_anterior | varchar | 254 | 0/0 | true | No |
| correo_nuevo | varchar | 254 | 0/0 | true | No |
| creado_por | int | 4 | 10/0 | true | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__Auditori__CA32984F1D613BD6 (PK CLUSTERED).

## dbo.FinanzasVersion

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| version | int | 4 | 10/0 | false | No |

Índices: PK__Finanzas__79B5C94CB0D25E5D (PK CLUSTERED).

## dbo.ConfiguracionMensualidades

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id | int | 4 | 10/0 | false | No |
| preparado_el | date | 3 | 10/0 | false | No |
| inicio | date | 3 | 10/0 | true | No |

Índices: PK__Configur__3213E83F761A9AFE (PK CLUSTERED).

## dbo.CuotasResidentes

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_cuota | int | 4 | 10/0 | false | 1,1 |
| id_residente | int | 4 | 10/0 | false | No |
| desde | date | 3 | 10/0 | false | No |
| monto | decimal | 9 | 10/2 | false | No |
| creado_por | int | 4 | 10/0 | true | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__CuotasRe__5EFF6F7ECADE2641 (PK CLUSTERED); IX_CuotasResidentes_Periodo (NONCLUSTERED).

## dbo.FichaMedica

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_ficha | int | 4 | 10/0 | false | 1,1 |
| id_residente | int | 4 | 10/0 | false | No |
| psicopatologias | varchar | 500 | 0/0 | true | No |
| padecimientos | varchar | 500 | 0/0 | true | No |
| medicamentos_habituales | varchar | 500 | 0/0 | true | No |
| antecedentes | varchar | 500 | 0/0 | true | No |
| observaciones | varchar | 500 | 0/0 | true | No |
| fecha_actualizacion | datetime | 8 | 23/3 | false | No |

Índices: PK__FichaMed__427B0F8A65221531 (PK CLUSTERED); UQ__FichaMed__A63BAD20AD729F65 (UNIQUE NONCLUSTERED).

## dbo.AjustesMensualidades

| Columna | Tipo | Longitud bytes | Precisión/escala | Nullable | Identidad |
|---|---|---|---|---|---|
| id_ajuste | int | 4 | 10/0 | false | 1,1 |
| id_cargo | int | 4 | 10/0 | false | No |
| importe_anterior | decimal | 9 | 12/2 | false | No |
| importe_nuevo | decimal | 9 | 12/2 | false | No |
| motivo | nvarchar | 1000 | 0/0 | false | No |
| creado_por | int | 4 | 10/0 | false | No |
| creado_en | datetime2 | 8 | 27/7 | false | No |

Índices: PK__AjustesM__7B0665B782DA4C6B (PK CLUSTERED).

## Relaciones verificadas en metadatos visibles

- FK_SolicitudesMedicas_Huespedes: SolicitudesMedicas(id_residente) → Huespedes(id_residente); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK_VisitasMedicas_Solicitudes: VisitasMedicas(id_solicitud) → SolicitudesMedicas(id_solicitud); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK_Usuarios_Roles: Usuarios(id_rol) → Roles(id_rol); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__CargosFam__id_re__22751F6C: CargosFamiliares(id_residente) → Huespedes(id_residente); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__CargosFam__id_vi__236943A5: CargosFamiliares(id_visita) → VisitasMedicas(id_visita); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__CargosFam__cread__2645B050: CargosFamiliares(creado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__PagosFami__id_re__2B0A656D: PagosFamiliares(id_residente) → Huespedes(id_residente); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__PagosFami__cread__2CF2ADDF: PagosFamiliares(creado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Aplicacio__id_pa__31B762FC: AplicacionesPagos(id_pago) → PagosFamiliares(id_pago); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Aplicacio__id_ca__32AB8735: AplicacionesPagos(id_cargo) → CargosFamiliares(id_cargo); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Obligacio__id_vi__37703C52: ObligacionesFundacion(id_visita) → VisitasMedicas(id_visita); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Obligacio__cread__3A4CA8FD: ObligacionesFundacion(creado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__PagosFund__id_ob__3E1D39E1: PagosFundacion(id_obligacion) → ObligacionesFundacion(id_obligacion); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__PagosFund__cread__40058253: PagosFundacion(creado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Donacione__anula__47A6A41B: Donaciones(anulado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Donacione__cread__489AC854: Donaciones(creado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Gastos__anulado___51300E55: Gastos(anulado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Gastos__creado_p__5224328E: Gastos(creado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Operacion__id_us__56E8E7AB: OperacionesFinancieras(id_usuario) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Notificac__id_re__5CA1C101: NotificacionesCorreo(id_residente) → Huespedes(id_residente); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Auditoria__id_re__6442E2C9: AuditoriaContactoFinanciero(id_residente) → Huespedes(id_residente); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__Auditoria__cread__65370702: AuditoriaContactoFinanciero(creado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__CuotasRes__id_re__6FB49575: CuotasResidentes(id_residente) → Huespedes(id_residente); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK_FichaMedica_Huesped: FichaMedica(id_residente) → Huespedes(id_residente); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__CuotasRes__cread__72910220: CuotasResidentes(creado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__AjustesMe__id_ca__76619304: AjustesMensualidades(id_cargo) → CargosFamiliares(id_cargo); DELETE NO_ACTION; UPDATE NO_ACTION.
- FK__AjustesMe__cread__7A3223E8: AjustesMensualidades(creado_por) → Usuarios(id_usuario); DELETE NO_ACTION; UPDATE NO_ACTION.

## Comparación con scripts y backend

Los scripts 001–007 son incrementales: no contienen la creación base completa de Usuarios, Huespedes, FichaMedica, SolicitudesMedicas y VisitasMedicas. No bastan para reconstruir la base. sysdiagrams y los siete módulos de diagramas no están referenciados por el backend; deben inventariarse y revisar su compatibilidad por separado, sin confundirlos con lógica del sistema.

La comparación de contratos SQL está pendiente de las definiciones completas. No se afirma compatibilidad total de vistas, funciones o procedimientos ocultos. No existen triggers visibles, pero esto no demuestra su ausencia global con permisos restringidos.
