# Contraste backend / esquema

Referencias textuales comprobadas contra tablas reales. No equivale a ejecutar todas las consultas; SQL dinámico y aliases requieren QA en destino.

- finanzas-calculos.js: .
- finanzas.js: SolicitudesMedicas, VisitasMedicas, CargosFamiliares, PagosFamiliares, AplicacionesPagos, ObligacionesFundacion, PagosFundacion, Donaciones, Gastos, OperacionesFinancieras, NotificacionesCorreo, Huespedes, AuditoriaContactoFinanciero, FinanzasVersion, AjustesMensualidades.
- mensualidades.js: CargosFamiliares, Huespedes, ConfiguracionMensualidades, CuotasResidentes, AjustesMensualidades.
- notificaciones-correo.js: NotificacionesCorreo, Huespedes.
- reportes-calculos.js: PagosFundacion, Donaciones.
- reportes-exportar.js: .
- reportes.js: SolicitudesMedicas, VisitasMedicas, CargosFamiliares, PagosFamiliares, AplicacionesPagos, ObligacionesFundacion, PagosFundacion, Donaciones, OperacionesFinancieras, Huespedes, FichaMedica, AjustesMensualidades.
- server.js: SolicitudesMedicas, VisitasMedicas, Roles, Especialidades, Usuarios, Huespedes, FichaMedica.

Columnas INSERT explícitas comprobadas: 115. Faltantes: 0.

Los scripts incrementales existentes no crean las tablas originales Usuarios, Huespedes, FichaMedica, SolicitudesMedicas y VisitasMedicas; el esquema generado sí usa sus definiciones reales. No aplicar 001–007 como si la base generada estuviera sin migrar. FinanzasVersion y ConfiguracionMensualidades necesitan sus filas reales mediante la carga aprobada.
