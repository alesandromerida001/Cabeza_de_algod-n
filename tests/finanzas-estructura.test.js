const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const leer=p=>fs.readFileSync(path.join(root,p),'utf8');
const archivos=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?archivos(path.join(dir,e.name)):[path.join(dir,e.name)]);
test('enlaces locales y recursos frontend existen; IDs únicos y contrato del modal financiero',()=>{
    const frontend=path.join(root,'frontend');
    for(const p of archivos(frontend).filter(p=>p.endsWith('.html'))){
        const html=fs.readFileSync(p,'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
        assert.equal(ids.length,new Set(ids).size,p+' contiene IDs repetidos');
        for(const m of html.matchAll(/\b(?:src|href)="([^"#]+)"/g)){
            const url=m[1].split(/[?#]/)[0];if(!url||/^(?:https?:|data:|mailto:|tel:)/.test(url))continue;
            const destino=url.startsWith('/')?path.join(frontend,url):path.resolve(path.dirname(p),url);
            assert.ok(fs.existsSync(destino),p+' -> '+url);
        }
        if(p.includes(path.sep+'finanzas'+path.sep))for(const id of ['modalFinanzas','formFinanzas','tituloModal','camposModal','previewModal','errorModal','guardarModal','editarPreview','cancelarModal','cerrarX','contenido','tarjetas','acciones','filtros','mensaje','navegacion','volver','salir'])assert.ok(ids.includes(id),p+' falta '+id);
    }
    const js=leer('frontend/finanzas/finanzas.js');
    for(const [id,evento] of [['formFinanzas','submit'],['editarPreview','click'],['salir','click']])assert.equal(js.split(`$('${id}').addEventListener('${evento}'`).length-1,1);
    assert.doesNotMatch(js,/autorizarHistorico|seccion\('Cargos y saldos'\)/);
    assert.match(js,/revision'\)\s*===?\s*'visitas'/);
});
test('carga SQL descartada y verificación general sin dependencia de residentes ficticios',()=>{
    const sql=leer('sql/008_datos_demo.sql');
    assert.match(sql,/DESCARTADO/);assert.ok(sql.indexOf('THROW 51000')<sql.indexOf('DECLARE @AutorizarCarga'));
    assert.ok(sql.indexOf('RETURN;')<sql.indexOf('DECLARE @AutorizarCarga'));
    const revisar=leer('sql/010_verificar_mensualidades.sql');
    assert.doesNotMatch(revisar,/DEMO-CCA|@ids/);
    assert.doesNotMatch(revisar,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\s/i);
    assert.match(revisar,/p\.monto<>COALESCE/);
});
test('migración prepara sin activar ni inventar fechas; activación requiere aprobación separada',()=>{
    const sql=leer('sql/007_mensualidades.sql'),activar=leer('sql/009_activar_mensualidades.sql');
    assert.match(sql,/fecha_ingreso DATE NULL/);assert.match(sql,/fecha_retiro DATE NULL/);
    assert.doesNotMatch(sql,/UPDATE\s+dbo\.Huespedes/i);
    assert.doesNotMatch(sql,/INSERT\s+dbo\.(?:CargosFamiliares|PagosFamiliares|NotificacionesCorreo)/i);
    assert.match(sql,/importe_anterior/);assert.match(sql,/importe_nuevo/);assert.match(sql,/motivo/);
    assert.match(activar,/@AutorizarActivacion BIT=0/);assert.match(activar,/inicio IS NULL/);
    assert.match(leer('.env.example'),/MENSUALIDADES_AUTOMATICAS=false/);
    assert.match(leer('sql/005_finanzas.sql'),/UNIQUE INDEX UQ_Cargo_Mes/);
});
