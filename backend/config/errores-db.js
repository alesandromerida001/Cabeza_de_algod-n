const codigos = new Set(['ETIMEOUT','ESOCKET','ECONNCLOSED','ENOTOPEN','EINSTLOOKUP','ECANCEL','ECONNRESET','ECONNREFUSED','ENOTFOUND','ELOGIN']);
function esErrorConexion(error) {
    return !!error && (codigos.has(error.code) || codigos.has(error.originalError?.code) || error.name === 'ConnectionError');
}
const mensaje = 'La base de datos no está disponible o no respondió a tiempo. Si estaba guardando, consulte el registro antes de reintentar: no se pudo confirmar el resultado.';
function responder(error,res) {
    if(!esErrorConexion(error))return false;
    res.status(503).json({success:false,message:mensaje});return true;
}
module.exports={esErrorConexion,responder,mensaje};
