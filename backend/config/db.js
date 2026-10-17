// ==========================================
// CONFIGURACIÓN DE CONEXIÓN A SQL SERVER
// ==========================================
// Aqui solo llamamos al archivo .env 


require('dotenv').config();

const produccion = process.env.NODE_ENV === 'production';
function booleano(nombre, predeterminado) {
    const valor = process.env[nombre];
    if (valor === undefined || valor === '') return predeterminado;
    if (valor !== 'true' && valor !== 'false') throw new Error(`${nombre} debe ser true o false.`);
    return valor === 'true';
}
const encrypt = booleano('DB_ENCRYPT', produccion);
const trustServerCertificate = booleano('DB_TRUST_SERVER_CERTIFICATE', !produccion);
if (produccion && (!encrypt || trustServerCertificate)) {
    throw new Error('Producción requiere cifrado SQL y validación del certificado.');
}

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    connectionTimeout: 15000,
    requestTimeout: 15000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000, acquireTimeoutMillis: 15000 },
    options: {
        encrypt,
        trustServerCertificate
    }
};

// Opcionales: la configuración existente se mantiene si no se proporcionan.
// Una instancia nombrada se resuelve por SQL Browser; un puerto explícito usa TCP directo.
if (process.env.DB_PORT && process.env.DB_INSTANCE) throw new Error('Configure DB_PORT o DB_INSTANCE, no ambos.');
if (process.env.DB_PORT) {
    const port = Number(process.env.DB_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT debe ser un puerto TCP válido.');
    dbConfig.port = port;
}
if (process.env.DB_INSTANCE) dbConfig.options.instanceName = process.env.DB_INSTANCE;

module.exports = dbConfig;
