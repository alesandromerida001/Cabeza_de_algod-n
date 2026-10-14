// ==========================================
// CONFIGURACIÓN DE CONEXIÓN A SQL SERVER
// ==========================================
// Aqui solo llamamos al archivo .env 


require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    connectionTimeout: 15000,
    requestTimeout: 15000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000, acquireTimeoutMillis: 15000 },
    options: {
        encrypt: false,
        trustServerCertificate: true
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
