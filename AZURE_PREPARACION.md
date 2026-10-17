# Preparación técnica Azure — 16/oct/2026

Cambios mínimos: PORT del entorno con alternativa 3000; cookies Secure en production; proxy explícito; SQL TLS configurable y obligatorio en production. No se ejecutó despliegue, migración ni envío. No se modificó .env. El inicio existente `npm start` ejecuta `node backend/server.js` y no requiere compilación del frontend.

## Variables de App Service

Configurar en las variables privadas del servicio, nunca subir .env ni copiar secretos a Git:

| Variable | Valor/uso |
|---|---|
| NODE_ENV | production |
| PORT | Proporcionado por App Service; no fijar 3000 en Azure. |
| TRUST_PROXY | 1 para la topología de un proxy confiable de App Service. No usar en un servidor accesible directamente que permita falsificar cabeceras de proxy. Revisar si se añade Front Door u otro proxy. |
| DB_SERVER | Nombre DNS completo del servidor Azure SQL, por ejemplo nombre.database.windows.net; sin tcp: ni puerto incluido. |
| DB_DATABASE | Base destino existente y previamente preparada. |
| DB_USER / DB_PASSWORD | Credenciales SQL de esa base con permisos necesarios; no son las de SQL local. |
| DB_PORT | 1433 |
| DB_INSTANCE | Omitir; no usar instancias nombradas en Azure SQL Database. |
| DB_ENCRYPT | true (predeterminado en production). |
| DB_TRUST_SERVER_CERTIFICATE | false (predeterminado en production). |
| JWT_SECRET | Secreto fuerte privado, estable entre reinicios e instancias. Cambiarlo invalida sesiones existentes. |
| CORREO_HABILITADO | false durante preparación y pruebas de infraestructura; activar solo tras revisar cola y destinatarios autorizados. |
| SMTP_HOST / SMTP_PORT / SMTP_SECURE | smtp.gmail.com / 465 / true para la cuenta Gmail ya probada. |
| SMTP_USER / SMTP_PASS / SMTP_FROM | Cuenta, contraseña de aplicación y remitente autorizados; valores privados. |
| SMTP_MESSAGE_DOMAIN | Dominio apropiado para Message-ID; opcional. |
| SMTP_SOLO_NOTIFICACION_ID / SMTP_DESTINATARIO_PRUEBA | Ausentes o vacíos en operación general. Ambos definidos únicamente para prueba limitada. |
| MENSUALIDADES_AUTOMATICAS | false; esta preparación no autoriza su activación. |

Producción rechaza DB_ENCRYPT=false y DB_TRUST_SERVER_CERTIFICATE=true antes del arranque. Local sin NODE_ENV=production conserva SQL sin cifrado y certificado confiado, puerto HTTP 3000 y cookies sin Secure. También es posible probar SQL TLS local mediante las dos variables explícitas. Login y logout conservan HttpOnly, SameSite=Lax, ruta predeterminada / y expiración JWT/cookie de dos horas.

## Arranque en App Service Linux

1. Elegir un runtime Node compatible con las dependencias y disponible en la suscripción. Las pruebas locales se realizaron con Node 22; comprobar runtimes disponibles antes de elegir. No subir node_modules de Windows: restaurar dependencias desde package-lock.json en el entorno Linux (npm ci --omit=dev o compilación/restauración del servicio).
2. Publicar desde la raíz del proyecto: package.json, package-lock.json, backend/ y frontend/ completo, incluidas fuentes PDF y licencias. No se requiere build del frontend. No exponer .env.
3. Definir las variables anteriores. Configurar HTTPS Only. El navegador usa HTTPS aunque el proxy termine TLS y Express reciba HTTP interno. Secure depende de NODE_ENV, no de una cabecera aportada por el cliente.
4. Comando compatible: `npm start`. Para supervisión en la imagen integrada de App Service con PM2 disponible, Microsoft recomienda `pm2 start backend/server.js --no-daemon`; usar un solo proceso, sin modo cluster. No se añadió PM2 como dependencia del proyecto. Confirmar el comando soportado en la imagen seleccionada.
5. Habilitar Always On cuando el plan lo permita; un temporizador no funciona mientras el proceso esté suspendido. Verificar condiciones del plan de Students antes de asumir disponibilidad o coste.
6. Probar HTTPS, login/logout, residentes y recursos estáticos; luego conexión a la base migrada y reportes. Activar correo solo después de esa revisión. No habilitar simultáneamente el envío local y Azure contra la misma cola durante la transición.

## Compatibilidad SQL y límites pendientes

- Configuración continúa usando SQL Authentication con mssql; no se implementó identidad administrada. Validar usuario, permisos de metadatos/transacciones y esquema existente completo en la base destino.
- Azure SQL necesita conectividad/firewall o red privada adecuados desde App Service. Usar DNS y certificado válido; no resolver errores de certificado deshabilitando su validación.
- No se certificó contra Azure SQL real. Revisar manualmente scripts y esquema base antes de migrar. Los scripts incrementales del repositorio no sustituyen una exportación/revisión del esquema original. No ejecutar scripts DEMO ni de activación automáticamente.
- Las transacciones, restricciones únicas y bloqueos de aplicación existentes se conservan. Revisar configuración READ_COMMITTED_SNAPSHOT/aislamiento y la consulta de toma de cola (UPDLOCK, READPAST, READCOMMITTEDLOCK) en la base destino. No se cambió su comportamiento.
- No se agregaron reintentos transparentes a pagos ni transacciones: un fallo de conexión puede tener resultado incierto y no debe duplicar operaciones. Los tiempos actuales de conexión/consulta siguen siendo 15 segundos; validar latencia y arranques de la base elegida.
- No se encontraron rutas absolutas Windows en el código de producción. Estáticos y fuentes usan path.join con __dirname. Verificar mayúsculas/minúsculas y fuentes al desplegar en Linux.

## Procesador SMTP

Se conserva iniciarCorreos en app.listen y un aviso por ciclo de 30 segundos. Cada instancia inicia su propio temporizador. Los bloqueos SQL y el cambio atómico Pendiente→Enviando impiden normalmente tomar el mismo aviso simultáneamente; no constituyen una garantía de entrega exactamente una vez ante fallos de red/SMTP o reinicios. No se reintenta Incierta, ni se selecciona Enviada. Usar una sola instancia inicialmente y revisar escalado/slots antes de habilitar más trabajadores. La aceptación SMTP no garantiza recepción en bandeja.

## Verificación realizada

97 pruebas aprobadas (SQL/SMTP simulados), incluidas dos nuevas de producción. Arranque temporal real en puerto 31879 con correo y mensualidades desactivados: /, CSS, JS y fuente PDF HTTP 200; logout con Secure, HttpOnly y SameSite=Lax. Sin conexión SQL real ni envíos en estas pruebas. El proceso temporal se detuvo al finalizar; no se reinició el servidor habitual.

## Referencias oficiales

- https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs
- https://expressjs.com/en/guide/behind-proxies/
